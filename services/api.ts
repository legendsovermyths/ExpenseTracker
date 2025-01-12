import {Action, Payloads} from "../types/actions/actions"
import { NativeModules } from "react-native";
const Bindings = NativeModules.Bindings;


export const invokeBackend = async (action:Action, payload:Payloads[Action]) => {
  const request = JSON.stringify({ action, payload });
  console.log(request);
  const response = await Bindings.sendRequest(request);
  console.log(response);
  //return JSON.parse(response) as any;
};
