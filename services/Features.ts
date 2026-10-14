import {
  Action,
  DeleteDataPayload,
  ExportDataPayload,
  ImportDataPayload,
} from "../types/actions/actions";
import { invokeBackend } from "./api";

// Returns the .exp archive as a base64 string.
export const exportData = async (): Promise<string> => {
  const exportDataPayload: ExportDataPayload = {};
  const response = await invokeBackend(Action.ExportData, exportDataPayload);
  if (!response.file) throw new Error("Export returned no data");
  return response.file;
};

export const deleteData = async () => {
  const deleteDataPayload: DeleteDataPayload = {};
  const response = await invokeBackend(Action.DeleteData, deleteDataPayload);
  return response;
};

export const importData = async (base64Archive: string) => {
  const imporDataPayload: ImportDataPayload = {
    file: base64Archive,
  };
  const response = await invokeBackend(Action.ImportData, imporDataPayload);
  return response;
};
