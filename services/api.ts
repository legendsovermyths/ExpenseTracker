import { Action, Payloads } from "../types/actions/actions";
import { BackendResponse } from "../types/actions/response";
import { NativeModules } from "react-native";
const Bindings = NativeModules.Bindings;

export const invokeBackend = async (
  action: Action,
  payload: Payloads[Action],
): Promise<BackendResponse> => {
  if (!Bindings?.sendRequest) {
    throw new Error("Native backend (Bindings) is unavailable");
  }
  const request = JSON.stringify({ action, payload });
  const response = await Bindings.sendRequest(request);
  const parsed: BackendResponse = JSON.parse(response);
  // The SDK couldn't parse the request, e.g. an action this native build
  // doesn't know yet (JS updated without rebuilding the app).
  if ((parsed as any).success === false) {
    const msg = (parsed as any).data?.message ?? "Invalid request";
    throw new Error(`${msg}: "${action}" isn't supported by this app build`);
  }
  if (parsed.status === "error") {
    throw new Error(parsed.message ?? "Backend request failed");
  }
  return parsed;
};
