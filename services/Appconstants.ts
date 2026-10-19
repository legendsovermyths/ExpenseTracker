import {
  Action,
  AddAppconstantPayload,
  UpdateAppconstantPayload,
} from "../types/actions/actions";
import { Appconstant } from "../types/entity/Appconstant";
import { invokeBackend } from "./api";

export const addAppconstant = async (
  appconstant: Omit<Appconstant, "id">,
): Promise<Appconstant> => {
  const addAppconstantPayload: AddAppconstantPayload = {
    appconstant: appconstant as Appconstant,
  };
  const response = await invokeBackend(
    Action.AddAppconstant,
    addAppconstantPayload,
  );
  return response.additions.appconstants[0];
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
