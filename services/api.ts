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
  if (parsed.status === "error") {
    throw new Error(parsed.message ?? "Backend request failed");
  }
  return parsed;
};
