// Icons.ts with the SDK bridge, Supabase and the RN-only modules mocked.
const mockBackend = jest.fn();
const mockInvoke = jest.fn();
const mockUpsert = jest.fn();

jest.mock("./api", () => ({
  invokeBackend: (...a: unknown[]) => mockBackend(...a),
}));
jest.mock("./Supabase", () => ({
  supabase: {
    functions: { invoke: (...a: unknown[]) => mockInvoke(...a) },
    from: () => ({ upsert: (...a: unknown[]) => mockUpsert(...a) }),
  },
}));
jest.mock("./ImageParser", () => ({
  AiError: class AiError extends Error {
    status?: number;
    constructor(message: string, code?: number) {
      super(message);
      this.status = code;
    }
  },
}));
jest.mock("react-native-uuid", () => ({
  __esModule: true,
  default: { v4: () => "new-id" },
}));
const mockState = {
  userId: "me",
  customIcons: {} as Record<string, any>,
  getUserId: () => "me",
  mergeCustomIcons: jest.fn(),
  setCustomIcons: jest.fn(),
};
jest.mock("../store/store", () => ({
  useExpensifyStore: { getState: () => mockState },
}));

import { generateIcon, myIcons, pushIcons, saveIcon } from "./Icons";

const httpError = (status: number, body: unknown) => ({
  data: null,
  error: {
    message: "Edge Function returned a non-2xx status code",
    context: { status, json: async () => body },
  },
});

beforeEach(() => {
  mockBackend.mockReset();
  mockInvoke.mockReset();
  mockUpsert.mockReset();
  mockState.mergeCustomIcons.mockReset();
});

describe("generateIcon", () => {
  it("sends only the trimmed subject and returns the traced path", async () => {
    mockInvoke.mockResolvedValue({
      data: { image_b64: "/9j/AAA", mime_type: "image/jpeg" },
      error: null,
    });
    mockBackend.mockResolvedValue({
      status: "success",
      data: "M2 2L22 2L22 22Z",
    });
    const draft = await generateIcon("  surfboard ");
    expect(mockInvoke).toHaveBeenCalledWith("ai", {
      body: { task: "generate_icon", prompt: "surfboard" },
    });
    expect(mockBackend).toHaveBeenCalledWith("vectorize_icon", {
      image_b64: "/9j/AAA",
    });
    expect(draft).toEqual({ path: "M2 2L22 2L22 22Z", prompt: "surfboard" });
  });

  it("rejects empty and over-long prompts without calling the server", async () => {
    await expect(generateIcon("   ")).rejects.toMatchObject({ status: 400 });
    await expect(generateIcon("x".repeat(61))).rejects.toMatchObject({
      status: 413,
    });
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("turns the daily limit into a friendly message", async () => {
    mockInvoke.mockResolvedValue(
      httpError(429, { error: "Daily icon limit reached" }),
    );
    await expect(generateIcon("cat")).rejects.toMatchObject({
      status: 429,
      message: "You've made today's icons. More tomorrow",
    });
  });

  it("passes the server's content-filter message through", async () => {
    mockInvoke.mockResolvedValue(
      httpError(422, {
        error: "That can't be drawn. Try describing it differently.",
      }),
    );
    await expect(generateIcon("x")).rejects.toMatchObject({
      status: 422,
      message: expect.stringContaining("can't be drawn"),
    });
  });

  it("survives a non-JSON error body (offline / gateway)", async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: "Failed to send", context: undefined },
    });
    await expect(generateIcon("cat")).rejects.toMatchObject({
      message: expect.stringContaining("Try again"),
    });
  });

  it("reports a tracer rejection as a retryable error", async () => {
    mockInvoke.mockResolvedValue({
      data: { image_b64: "/9j/AAA" },
      error: null,
    });
    mockBackend.mockRejectedValue(
      new Error("That came out as a picture, not an icon. Try again"),
    );
    await expect(generateIcon("cat")).rejects.toMatchObject({
      status: 422,
      message: expect.stringContaining("picture"),
    });
  });

  it("treats a response without an image as a failure", async () => {
    mockInvoke.mockResolvedValue({ data: { text: "hi" }, error: null });
    await expect(generateIcon("cat")).rejects.toMatchObject({ status: 502 });
  });
});

describe("saveIcon", () => {
  it("saves as mine, updates the store and returns a custom reference", async () => {
    mockBackend.mockImplementation(async (action: string, payload: any) =>
      action === "save_icon"
        ? { additions: { icons: [payload.icon] } }
        : { updates: { icons: [] } },
    );
    const ref = await saveIcon({ path: "M0 0Z", prompt: "cup" });
    expect(ref).toEqual({ name: "new-id", type: "custom" });
    const saved = mockBackend.mock.calls.find((c) => c[0] === "save_icon")![1]
      .icon;
    expect(saved).toMatchObject({
      id: "new-id",
      owner_id: "me",
      path: "M0 0Z",
      prompt: "cup",
      is_deleted: false,
    });
    expect(mockState.mergeCustomIcons).toHaveBeenCalledWith([saved]);
  });
});

describe("myIcons", () => {
  it("lists only my live icons, newest first", () => {
    const all = {
      a: {
        id: "a",
        owner_id: "me",
        path: "M0 0Z",
        created_at: "2026-01-01",
        is_deleted: false,
      },
      b: {
        id: "b",
        owner_id: "me",
        path: "M0 0Z",
        created_at: "2026-03-01",
        is_deleted: false,
      },
      c: {
        id: "c",
        owner_id: "friend",
        path: "M0 0Z",
        created_at: "2026-04-01",
        is_deleted: false,
      },
      d: {
        id: "d",
        owner_id: "me",
        path: "M0 0Z",
        created_at: "2026-05-01",
        is_deleted: true,
      },
    };
    expect(myIcons(all, "me").map((i) => i.id)).toEqual(["b", "a"]);
  });
});

describe("pushIcons", () => {
  const dirty = (ids: string[]) => ({
    updates: {
      icons: ids.map((id) => ({
        id,
        owner_id: "me",
        path: "M0 0Z",
        created_at: "t",
        updated_at: `u-${id}`,
        is_deleted: false,
      })),
    },
  });

  it("does nothing when nothing is dirty", async () => {
    mockBackend.mockResolvedValue({ updates: {} });
    await pushIcons();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("clears the pushed rows on success", async () => {
    mockBackend.mockImplementation(async (a: string) =>
      a === "get_dirty_icons" ? dirty(["a", "b"]) : {},
    );
    mockUpsert.mockResolvedValue({ error: null });
    await pushIcons();
    expect(mockBackend).toHaveBeenCalledWith("sync_icons", {
      pushed: [
        { id: "a", updated_at: "u-a" },
        { id: "b", updated_at: "u-b" },
      ],
    });
  });

  it("a row the server rejects for good doesn't wedge the rest", async () => {
    mockBackend.mockImplementation(async (a: string) =>
      a === "get_dirty_icons" ? dirty(["good", "bad"]) : {},
    );
    mockUpsert.mockImplementation(async (rows: any[]) =>
      rows.length > 1 || rows[0].id === "bad"
        ? { error: { code: "23514", message: "violates check constraint" } }
        : { error: null },
    );
    await pushIcons();
    expect(mockBackend).toHaveBeenCalledWith("sync_icons", {
      pushed: [
        { id: "good", updated_at: "u-good" },
        { id: "bad", updated_at: "u-bad" },
      ],
    });
  });

  it("a push requested mid-flight runs again afterwards", async () => {
    let round = 0;
    let release: () => void = () => {};
    mockBackend.mockImplementation(async (a: string) => {
      if (a !== "get_dirty_icons") return {};
      round++;
      return round === 1
        ? dirty(["a"])
        : round === 2
          ? dirty(["a-deleted"])
          : { updates: {} };
    });
    mockUpsert.mockImplementation(
      () => new Promise((r) => (release = () => r({ error: null }))),
    );
    const first = pushIcons();
    await new Promise((r) => setImmediate(r));
    const second = pushIcons(); // e.g. deleteIcon while the first is in flight
    expect(second).toBe(first);
    release();
    await new Promise((r) => setImmediate(r));
    release();
    await first;
    expect(mockUpsert).toHaveBeenCalledTimes(2);
    expect(mockBackend).toHaveBeenCalledWith("sync_icons", {
      pushed: [{ id: "a-deleted", updated_at: "u-a-deleted" }],
    });
  });

  it("network errors keep rows dirty and fail the sync", async () => {
    mockBackend.mockImplementation(async (a: string) =>
      a === "get_dirty_icons" ? dirty(["a"]) : {},
    );
    mockUpsert.mockResolvedValue({
      error: { code: undefined, message: "Network request failed" },
    });
    await expect(pushIcons()).rejects.toMatchObject({
      message: "Network request failed",
    });
    expect(mockBackend).not.toHaveBeenCalledWith(
      "sync_icons",
      expect.anything(),
    );
  });
});
