import {
  Action,
  DeleteDataPayload,
  ExportDataPayload,
  ImportDataPayload,
} from "../types/actions/actions";
import { invokeBackend } from "./api";

export const exportData = async () => {
  const exportDataPayload: ExportDataPayload = {};
  const response = await invokeBackend(Action.ExportData, exportDataPayload);
  return response.file;
};

export const deleteData = async () => {
  const deleteDataPayload: DeleteDataPayload = {};
  const response = await invokeBackend(Action.DeleteData, deleteDataPayload);
  return response;
};

export const importData = async (byteArray: Uint8Array) => {
  const imporDataPayload: ImportDataPayload = {
    file: byteArray,
  };
  const response = await invokeBackend(Action.ImportData, imporDataPayload);
  return response;
};
