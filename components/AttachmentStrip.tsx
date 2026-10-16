import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../contexts/ThemeContext";
import { ColorPalette } from "../constants/theme";
import { FONT, RADIUS, SPACE, TYPE } from "../constants";
import { Icon, Pressable, toast } from "./ui";
import { Attachment, AttachmentOwnerType, DOC_TYPE_LABELS } from "../types/entity/Attachment";
import {
  StagedFile,
  deleteAttachments,
  listAttachments,
  onAttachmentUpdated,
  pickDocuments,
  pickFromCamera,
  pickFromLibrary,
  saveStagedFiles,
} from "../services/Attachments";

/**
 * Holds attachment edits for an add/edit screen until the user saves.
 * Nothing touches the database until `commit` runs, so backing out of the
 * screen leaves existing files untouched.
 */
export function useAttachmentDraft(ownerType: AttachmentOwnerType, existingOwnerId?: string | number | null) {
  const [existing, setExisting] = useState<Attachment[]>([]);
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (existingOwnerId == null || existingOwnerId === "") return;
    listAttachments(ownerType, existingOwnerId)
      .then((rows) => mounted.current && setExisting(rows))
      .catch((e) => console.warn("Failed to load attachments", e));
  }, [ownerType, existingOwnerId]);

  useEffect(
    () => onAttachmentUpdated((row) => setExisting((prev) => prev.map((a) => (a.id === row.id ? row : a)))),
    [],
  );

  const addStaged = useCallback((files: StagedFile[]) => setStaged((prev) => [...prev, ...files]), []);
  const removeStaged = useCallback((key: string) => setStaged((prev) => prev.filter((f) => f.key !== key)), []);
  const removeExisting = useCallback((id: string) => setRemovedIds((prev) => [...prev, id]), []);
  const reset = useCallback(() => {
    setExisting([]);
    setStaged([]);
    setRemovedIds([]);
  }, []);

  const visibleExisting = useMemo(() => existing.filter((a) => !removedIds.includes(a.id)), [existing, removedIds]);

  /**
   * Applies removals and stores new files against the saved owner. Runs after
   * the transaction/split itself is saved and never throws — the record is
   * already safe, so a failed file only gets an alert.
   */
  const commit = useCallback(
    async (ownerId: string | number) => {
      if (staged.length === 0 && removedIds.length === 0) return;
      try {
        await deleteAttachments(removedIds);
        await saveStagedFiles(ownerType, ownerId, staged);
      } catch (e: any) {
        toast(e?.message ? `Couldn't attach file: ${e.message}` : "Couldn't attach the file", "error");
      }
    },
    [ownerType, staged, removedIds],
  );

  return {
    existing: visibleExisting,
    staged,
    count: visibleExisting.length + staged.length,
    addStaged,
    removeStaged,
    removeExisting,
    reset,
    commit,
  };
}

export type AttachmentDraft = ReturnType<typeof useAttachmentDraft>;

const PICK_OPTIONS = ["Photo Library", "Take Photo", "Choose File", "Cancel"] as const;

async function runPicker(choice: number): Promise<StagedFile[]> {
  if (choice === 0) return pickFromLibrary();
  if (choice === 1) return pickFromCamera();
  if (choice === 2) return pickDocuments();
  return [];
}

function askSource(onChoice: (i: number) => void) {
  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: [...PICK_OPTIONS], cancelButtonIndex: 3, title: "Attach a bill, receipt or warranty" },
      onChoice,
    );
    return;
  }
  Alert.alert("Attach", undefined, [
    { text: PICK_OPTIONS[0], onPress: () => onChoice(0) },
    { text: PICK_OPTIONS[1], onPress: () => onChoice(1) },
    { text: PICK_OPTIONS[2], onPress: () => onChoice(2) },
    { text: "Cancel", style: "cancel" },
  ]);
}

interface Props {
  draft: AttachmentDraft;
  onBeforePick?: () => void;
}

/**
 * Quiet "attach" link that only grows into a thumbnail strip once files are
 * added, so the add screens stay clean for the many transactions without any.
 */
const AttachmentStrip: React.FC<Props> = ({ draft, onBeforePick }) => {
  const { COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const navigation = useNavigation<any>();
  const [busy, setBusy] = useState(false);

  const openPicker = useCallback(() => {
    onBeforePick?.();
    askSource(async (i) => {
      if (i > 2) return;
      try {
        setBusy(true);
        const files = await runPicker(i);
        draft.addStaged(files);
      } catch (e: any) {
        toast(e?.message ? `Couldn't add file: ${e.message}` : "Couldn't add the file", "error");
      } finally {
        setBusy(false);
      }
    });
  }, [draft, onBeforePick]);

  const openExisting = (index: number) => {
    navigation.navigate("AttachmentViewer", {
      attachments: draft.existing,
      index,
      // Removal from an edit screen goes through the strip's ✕ so it's only
      // applied when the user saves.
      allowDelete: false,
    });
  };

  if (draft.count === 0) {
    return (
      <Pressable style={styles.linkRow} onPress={openPicker} disabled={busy} hitSlop={8} haptic="light">
        {busy ? (
          <ActivityIndicator size="small" color={COLORS.inkMuted} />
        ) : (
          <Icon name="paperclip" size={16} color={COLORS.inkMuted} />
        )}
        <Text style={styles.linkText}>Attach bill, receipt or warranty</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <Icon name="paperclip" size={16} color={COLORS.inkMuted} />
        <Text style={styles.titleText}>
          {draft.count} {draft.count === 1 ? "file" : "files"}
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {draft.existing.map((a, i) => (
          <View key={a.id} style={styles.tileWrap}>
            <Pressable style={styles.tile} onPress={() => openExisting(i)}>
              <Thumb mimeType={a.mime_type} thumbnail={a.thumbnail_b64} styles={styles} COLORS={COLORS} />
              {a.doc_type && (
                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>{DOC_TYPE_LABELS[a.doc_type]}</Text>
                </View>
              )}
            </Pressable>
            <RemoveButton onPress={() => draft.removeExisting(a.id)} styles={styles} />
          </View>
        ))}
        {draft.staged.map((f) => (
          <View key={f.key} style={styles.tileWrap}>
            <View style={styles.tile}>
              <Thumb mimeType={f.mimeType} uri={f.isImage ? f.uri : undefined} styles={styles} COLORS={COLORS} />
            </View>
            <RemoveButton onPress={() => draft.removeStaged(f.key)} styles={styles} />
          </View>
        ))}
        <Pressable style={[styles.tile, styles.addTile]} onPress={openPicker} disabled={busy} haptic="light">
          {busy ? (
            <ActivityIndicator size="small" color={COLORS.inkMuted} />
          ) : (
            <Icon name="plus" size={22} color={COLORS.inkMuted} />
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
};

const Thumb: React.FC<{
  mimeType: string;
  thumbnail?: string | null;
  uri?: string;
  styles: ReturnType<typeof createStyles>;
  COLORS: ColorPalette;
}> = ({ mimeType, thumbnail, uri, styles, COLORS }) => {
  const source = uri ? { uri } : thumbnail ? { uri: `data:image/jpeg;base64,${thumbnail}` } : null;
  if (source) return <Image source={source} style={styles.thumbImage} />;
  const isPdf = mimeType === "application/pdf";
  return (
    <View style={styles.fileThumb}>
      <Icon
        name={isPdf ? "file-pdf-box" : "file-outline"}
        size={28}
        color={isPdf ? COLORS.deltaUp : COLORS.inkMuted}
      />
    </View>
  );
};

const RemoveButton: React.FC<{ onPress: () => void; styles: ReturnType<typeof createStyles> }> = ({
  onPress,
  styles,
}) => (
  <Pressable style={styles.remove} onPress={onPress} hitSlop={8} haptic="light" accessibilityLabel="Remove file">
    <Icon name="close" size={12} color="#fff" />
  </Pressable>
);

const TILE = 64;

const createStyles = (COLORS: ColorPalette) =>
  StyleSheet.create({
    linkRow: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 6,
      paddingVertical: SPACE.sm + 2,
      marginTop: SPACE.sm,
    },
    linkText: { ...TYPE.callout, color: COLORS.inkMuted },
    container: {
      marginTop: SPACE.md,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: SPACE.sm,
    },
    titleText: { ...TYPE.callout, color: COLORS.inkMuted },
    strip: {
      gap: 10,
      paddingTop: 6,
      paddingRight: 6,
    },
    tileWrap: {
      position: "relative",
    },
    tile: {
      width: TILE,
      height: TILE,
      borderRadius: RADIUS.md,
      overflow: "hidden",
      backgroundColor: COLORS.surface1,
      alignItems: "center",
      justifyContent: "center",
    },
    addTile: {
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: COLORS.hairline,
      backgroundColor: "transparent",
    },
    thumbImage: {
      width: TILE,
      height: TILE,
    },
    fileThumb: {
      width: TILE,
      height: TILE,
      alignItems: "center",
      justifyContent: "center",
    },
    typeBadge: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      paddingVertical: 2,
      backgroundColor: "rgba(0,0,0,0.55)",
    },
    typeBadgeText: {
      fontSize: 10,
      color: "#fff",
      textAlign: "center",
      fontFamily: FONT.bold,
    },
    remove: {
      position: "absolute",
      top: -6,
      right: -6,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: "rgba(0,0,0,0.7)",
      alignItems: "center",
      justifyContent: "center",
    },
  });

export default AttachmentStrip;
