import {
  Action,
  AddAppconstantPayload,
  UpdateAppconstantPayload,
} from "../types/actions/actions";
import { Appconstant } from "../types/entity/Appconstant";
import { invokeBackend } from "./api";

export const addAppconstant = async (appconstant: Appconstant) => {
  const addAppconstantPayload: AddAppconstantPayload = {
    appconstant: appconstant,
  };
  const response = await invokeBackend(
    Action.AddAppconstant,
    addAppconstantPayload,
  );
  return response.additions.appconstant[0];
};

export const updateAppconstant = async (appconstant: Appconstant) => {
  const updateAppconstantPayload: UpdateAppconstantPayload = {
    appconstant: appconstant,
  };
  const response = await invokeBackend(
    Action.UpdateAppconstant,
    updateAppconstantPayload,
  );
  return response.updates.appconstants[0];
};
