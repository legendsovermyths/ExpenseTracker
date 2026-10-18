import * as ImagePicker from "expo-image-picker";
import { keepLocalCopy, pick, types, isErrorWithCode, errorCodes } from "@react-native-documents/picker";
import { Image as ImageCompressor } from "react-native-compressor";
import RNFS from "react-native-fs";
import uuid from "react-native-uuid";
import { invokeBackend } from "./api";
import { invokeAI } from "./ImageParser";
import { Action } from "../types/actions/actions";
import {
  Attachment,
  AttachmentOwnerType,
  DOC_TYPES,
  DocType,
  DocumentedItem,
  NewAttachment,
  attachmentOwnerKey,
} from "../types/entity/Attachment";
import { useExpensifyStore } from "../store/store";

// Hard cap per file after compression. Everything lives inside the SQLite DB
// (and therefore the export / cloud backup), so keep it reasonable.
export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
const IMAGE_MAX_SIDE = 2000;
const THUMB_MAX_SIDE = 240;

/** A file picked on the add screen, not yet written to the database. */
export interface StagedFile {
  key: string;
  uri: string;
  name: string;
  mimeType: string;
  isImage: boolean;
}

const stripFileScheme = (uri: string) =>
  decodeURIComponent(uri.startsWith("file://") ? uri.slice(7) : uri);

const stripDataPrefix = (b64: string) =>
  b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64;

const guessName = (uri: string, fallback: string) => {
  const last = uri.split("/").pop();
  return last && last.includes(".") ? decodeURIComponent(last) : fallback;
};

const stage = (uri: string, name: string, mimeType: string): StagedFile => ({
  key: uuid.v4() as string,
  uri,
  name,
  mimeType,
  isImage: mimeType.startsWith("image/"),
});

// ---- picking --------------------------------------------------------------

export async function pickFromLibrary(): Promise<StagedFile[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    selectionLimit: 10,
    quality: 1,
  });
  if (result.canceled) return [];
  return result.assets.map((a) =>
    stage(a.uri, a.fileName ?? guessName(a.uri, "Photo.jpg"), a.mimeType ?? "image/jpeg"),
  );
}

export async function pickFromCamera(): Promise<StagedFile[]> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) throw new Error("Camera access is turned off for Expensify in Settings");
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 1 });
  if (result.canceled) return [];
  return result.assets.map((a) => stage(a.uri, a.fileName ?? "Photo.jpg", a.mimeType ?? "image/jpeg"));
}

export async function pickDocuments(): Promise<StagedFile[]> {
  let picked;
  try {
    picked = await pick({ allowMultiSelection: true, type: [types.pdf, types.images] });
  } catch (e) {
    if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) return [];
    throw e;
  }
  const withNames = picked.map((f, i) => ({ ...f, name: f.name ?? `Document ${i + 1}` }));
  const copies = await keepLocalCopy({
    files: withNames.map((f) => ({ uri: f.uri, fileName: f.name })) as any,
    destination: "cachesDirectory",
  });
  const staged: StagedFile[] = [];
  copies.forEach((c, i) => {
    if (c.status !== "success") return;
    const f = withNames[i];
    const mime = f.type ?? (f.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
    staged.push(stage(c.localUri, f.name, mime));
  });
  return staged;
}

// ---- preparing & saving ---------------------------------------------------

async function prepare(file: StagedFile, ownerType: AttachmentOwnerType, ownerId: string): Promise<NewAttachment> {
  let dataB64: string;
  let mimeType = file.mimeType;
  let fileName = file.name;
  let thumbnail: string | null = null;

  if (file.isImage) {
    const full = await ImageCompressor.compress(file.uri, {
      compressionMethod: "manual",
      maxWidth: IMAGE_MAX_SIDE,
      maxHeight: IMAGE_MAX_SIDE,
      quality: 0.7,
      output: "jpg",
      returnableOutputType: "base64",
    });
    dataB64 = stripDataPrefix(full);
    mimeType = "image/jpeg";
    fileName = fileName.replace(/\.(heic|heif|png|webp|jpeg)$/i, ".jpg");
    const thumb = await ImageCompressor.compress(file.uri, {
      compressionMethod: "manual",
      maxWidth: THUMB_MAX_SIDE,
      maxHeight: THUMB_MAX_SIDE,
      quality: 0.6,
      output: "jpg",
      returnableOutputType: "base64",
    });
    thumbnail = stripDataPrefix(thumb);
  } else {
    dataB64 = await RNFS.readFile(stripFileScheme(file.uri), "base64");
  }

  const sizeBytes = Math.floor((dataB64.length * 3) / 4);
  if (sizeBytes > MAX_ATTACHMENT_BYTES) {
    throw new Error(`"${file.name}" is larger than 15 MB`);
  }

  return {
    id: uuid.v4() as string,
    owner_type: ownerType,
    owner_id: ownerId,
    file_name: fileName,
    mime_type: mimeType,
    size_bytes: sizeBytes,
    doc_type: null,
    doc_type_source: null,
    thumbnail_b64: thumbnail,
    created_at: new Date().toISOString(),
    data_b64: dataB64,
  };
}

/**
 * Compresses and stores staged files against an owner, then kicks off
 * background classification. Returns the saved metadata rows.
 */
export async function saveStagedFiles(
  ownerType: AttachmentOwnerType,
  ownerId: string | number,
  files: StagedFile[],
): Promise<Attachment[]> {
  if (files.length === 0) return [];
  const id = String(ownerId);
  const saved: Attachment[] = [];
  // One file at a time keeps the bridge payload (and memory) bounded.
  for (const f of files) {
    const prepared = await prepare(f, ownerType, id);
    const res = await invokeBackend(Action.AddAttachments, {
      owner_type: ownerType,
      owner_id: id,
      attachments: [prepared],
    });
    const row = res.additions?.attachments?.[0];
    if (row) {
      saved.push(row);
      classifyInBackground(row, prepared.data_b64);
    }
  }
  await refreshAttachmentOwners();
  return saved;
}

// ---- reading & editing ----------------------------------------------------

export async function listAttachments(ownerType: AttachmentOwnerType, ownerId: string | number): Promise<Attachment[]> {
  const res = await invokeBackend(Action.ListAttachments, { owner_type: ownerType, owner_id: String(ownerId) });
  return res.additions?.attachments ?? [];
}

/** Loads the full file content. Only call when the user actually opens a file. */
export async function loadAttachmentData(attachmentId: string): Promise<string> {
  const res = await invokeBackend(Action.GetAttachmentData, { attachment_id: attachmentId });
  if (!res.data) throw new Error("File not found");
  return res.data;
}

export async function setAttachmentDocType(attachmentId: string, docType: DocType | null): Promise<Attachment | undefined> {
  const res = await invokeBackend(Action.UpdateAttachmentType, {
    attachment_id: attachmentId,
    doc_type: docType,
    source: docType ? "USER" : null,
  });
  const row = res.updates?.attachments?.[0];
  if (row) emitUpdated(row);
  return row;
}

export async function deleteAttachments(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await invokeBackend(Action.DeleteAttachments, { attachment_ids: ids });
  await refreshAttachmentOwners();
}

export async function refreshAttachmentOwners(): Promise<void> {
  const res = await invokeBackend(Action.ListAttachmentOwners, {});
  const owners = res.additions?.attachment_owners ?? [];
  useExpensifyStore.getState().setAttachmentOwners(owners.map((o) => attachmentOwnerKey(o.owner_type, o.owner_id)));
}

export async function listDocumentedItems(docType?: string): Promise<DocumentedItem[]> {
  const meId = useExpensifyStore.getState().getUserId();
  const res = await invokeBackend(Action.ListDocumentedItems, {
    doc_type: docType,
    me_id: meId || undefined,
  });
  return res.additions?.documented_items ?? [];
}

/** Writes an attachment to a temp file (for sharing / opening PDFs). */
export async function writeAttachmentToTemp(att: Attachment, dataB64: string): Promise<string> {
  const safe = att.file_name.replace(/[^\w.\- ]+/g, "_");
  const path = `${RNFS.CachesDirectoryPath}/${att.id}-${safe}`;
  await RNFS.writeFile(path, dataB64, "base64");
  return `file://${path}`;
}

// ---- AI classification ----------------------------------------------------

const updateListeners = new Set<(row: Attachment) => void>();

/** Lets open screens refresh when a file's type changes (AI or user). */
export function onAttachmentUpdated(cb: (row: Attachment) => void): () => void {
  updateListeners.add(cb);
  return () => {
    updateListeners.delete(cb);
  };
}

function emitUpdated(row: Attachment) {
  updateListeners.forEach((cb) => cb(row));
}

async function classify(att: Attachment, dataB64: string): Promise<DocType | null> {
  const isImage = att.mime_type.startsWith("image/");
  const isPdf = att.mime_type === "application/pdf";
  if (!isImage && !isPdf) return null;
  // Mirrors the Edge Function's limits; skip rather than upload a 413.
  if (dataB64.length > (isPdf ? 8 : 4) * 1024 * 1024) return null;

  // Prompt and model live in supabase/functions/ai.
  const text = await invokeAI("classify_document", {
    mime_type: att.mime_type,
    file_name: att.file_name,
    data_b64: dataB64,
  });
  if (!text) return null;
  const parsed = JSON.parse(text);
  const t = String(parsed?.doc_type ?? "").toUpperCase();
  return (DOC_TYPES as readonly string[]).includes(t) ? (t as DocType) : null;
}

function classifyInBackground(att: Attachment, dataB64: string) {
  classify(att, dataB64)
    .then(async (docType) => {
      if (!docType) return;
      const res = await invokeBackend(Action.UpdateAttachmentType, {
        attachment_id: att.id,
        doc_type: docType,
        source: "AI",
      });
      const row = res.updates?.attachments?.[0];
      if (row) emitUpdated(row);
    })
    .catch((e) => console.warn("Attachment classification skipped:", e?.message ?? e));
}
