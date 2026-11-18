import { groupDigits } from "./numberFormat";

describe("groupDigits", () => {
  it("groups western amounts in threes", () => {
    expect(groupDigits("2522543", "western")).toBe("2,522,543");
    expect(groupDigits("1000", "western")).toBe("1,000");
  });
  it("groups indian amounts as lakhs and crores", () => {
    expect(groupDigits("2522543", "indian")).toBe("25,22,543");
    expect(groupDigits("100000", "indian")).toBe("1,00,000");
    expect(groupDigits("123456789", "indian")).toBe("12,34,56,789");
    expect(groupDigits("6999", "indian")).toBe("6,999");
  });
  it("leaves short numbers alone", () => {
    expect(groupDigits("999", "indian")).toBe("999");
    expect(groupDigits("0")).toBe("0");
  });
});
