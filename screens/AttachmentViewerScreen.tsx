import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  View,
  ViewToken,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import RNFS from "react-native-fs";
import Share from "react-native-share";
import { FONT, RADIUS, SPACE } from "../constants";
import { Icon, Pressable, Text, confirm, toast } from "../components/ui";
import { Attachment, DOC_TYPES, DOC_TYPE_LABELS, DocType } from "../types/entity/Attachment";
import {
  deleteAttachments,
  loadAttachmentData,
  onAttachmentUpdated,
  setAttachmentDocType,
  writeAttachmentToTemp,
} from "../services/Attachments";

const { width: SCREEN_W } = Dimensions.get("window");
const BG = "#000";
const ON_MEDIA = "#fff";
const ON_MEDIA_MUTED = "rgba(255,255,255,0.6)";
const ON_MEDIA_SUBTLE = "rgba(255,255,255,0.4)";
const SCRIM = "rgba(255,255,255,0.12)";

// Files are pulled from the database only when their page becomes visible,
// and are cached for this screen's lifetime only.
type Loaded = { data: string; fileUri?: string };

const AttachmentViewerScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const allowDelete: boolean = route.params?.allowDelete ?? true;

  const [items, setItems] = useState<Attachment[]>(route.params?.attachments ?? []);
  const [index, setIndex] = useState<number>(route.params?.index ?? 0);
  const [loaded, setLoaded] = useState<Record<string, Loaded>>({});
  const [failed, setFailed] = useState<Record<string, string>>({});
  const inFlight = useRef(new Set<string>());

  const current = items[index];

  useEffect(
    () => onAttachmentUpdated((row) => setItems((prev) => prev.map((a) => (a.id === row.id ? row : a)))),
    [],
  );

  const ensureLoaded = useCallback(async (att: Attachment | undefined) => {
    if (!att || inFlight.current.has(att.id)) return;
    inFlight.current.add(att.id);
    try {
      const data = await loadAttachmentData(att.id);
      // PDFs render in a WebView, which needs a file on disk.
      const fileUri = att.mime_type.startsWith("image/") ? undefined : await writeAttachmentToTemp(att, data);
      setLoaded((prev) => ({ ...prev, [att.id]: { data, fileUri } }));
    } catch (e: any) {
      inFlight.current.delete(att.id);
      setFailed((prev) => ({ ...prev, [att.id]: e?.message ?? "Couldn't open file" }));
    }
  }, []);

  useEffect(() => {
    ensureLoaded(items[index]);
  }, [index, items, ensureLoaded]);

  // Temp copies of PDFs are only needed while the viewer is open.
  const loadedRef = useRef(loaded);
  loadedRef.current = loaded;
  useEffect(
    () => () => {
      Object.values(loadedRef.current).forEach((l) => {
        if (l.fileUri) RNFS.unlink(l.fileUri.replace("file://", "")).catch(() => {});
      });
    },
    [],
  );

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (first?.index != null) setIndex(first.index);
  }).current;

  const handleShare = async () => {
    if (!current) return;
    try {
      const l = loaded[current.id];
      const data = l?.data ?? (await loadAttachmentData(current.id));
      const uri = l?.fileUri ?? (await writeAttachmentToTemp(current, data));
      await Share.open({ url: uri, type: current.mime_type, filename: current.file_name, failOnCancel: false });
    } catch (e: any) {
      if (e?.message && !/cancel/i.test(e.message)) toast(`Couldn't share: ${e.message}`, "error");
    }
  };

  const handleDelete = async () => {
    if (!current) return;
    const ok = await confirm({ title: "Delete file?", message: `"${current.file_name}" will be removed from this record.` });
    if (!ok) return;
    try {
      await deleteAttachments([current.id]);
      toast("File deleted");
      const next = items.filter((a) => a.id !== current.id);
      if (next.length === 0) {
        navigation.goBack();
        return;
      }
      setItems(next);
      setIndex((i) => Math.min(i, next.length - 1));
    } catch (e: any) {
      toast(e?.message ? `Couldn't delete: ${e.message}` : "Couldn't delete the file", "error");
    }
  };

  const handleType = async (t: DocType) => {
    if (!current) return;
    const next = current.doc_type === t && current.doc_type_source === "USER" ? null : t;
    try {
      await setAttachmentDocType(current.id, next);
    } catch (e: any) {
      toast(e?.message ? `Couldn't update: ${e.message}` : "Couldn't update the file type", "error");
    }
  };

  const renderPage = ({ item }: { item: Attachment }) => {
    const l = loaded[item.id];
    const err = failed[item.id];
    let body: React.ReactNode;
    if (err) {
      body = (
        <Text variant="body" align="center" style={styles.message}>
          {err}
        </Text>
      );
    } else if (!l) {
      body = <ActivityIndicator color={ON_MEDIA} />;
    } else if (item.mime_type.startsWith("image/")) {
      body = (
        <ScrollView
          style={styles.zoom}
          contentContainerStyle={styles.zoomContent}
          maximumZoomScale={4}
          minimumZoomScale={1}
          centerContent
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
        >
          <Image source={{ uri: `data:${item.mime_type};base64,${l.data}` }} style={styles.image} resizeMode="contain" />
        </ScrollView>
      );
    } else if (item.mime_type === "application/pdf" && l.fileUri) {
      body = (
        <WebView
          source={{ uri: l.fileUri }}
          originWhitelist={["*"]}
          allowingReadAccessToURL={`file://${RNFS.CachesDirectoryPath}`}
          allowFileAccess
          style={styles.pdf}
        />
      );
    } else {
      body = (
        <View style={styles.center}>
          <Icon name="file-outline" size={56} color={ON_MEDIA_SUBTLE} />
          <Text variant="body" align="center" style={styles.message}>
            Preview isn't available. Use Share to open it.
          </Text>
        </View>
      );
    }
    return <View style={styles.page}>{body}</View>;
  };

  const sizeLabel = useMemo(() => {
    if (!current) return "";
    const kb = current.size_bytes / 1024;
    return kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(kb))} KB`;
  }, [current]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={[styles.header, { paddingTop: insets.top + SPACE.sm }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn} accessibilityLabel="Close" haptic="light">
          <Icon name="close" size="lg" color={ON_MEDIA} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text variant="headline" numberOfLines={1} style={styles.title}>
            {current?.file_name ?? ""}
          </Text>
          <Text variant="caption" style={styles.subtitle}>
            {items.length > 1 ? `${index + 1} of ${items.length}  ·  ` : ""}
            {sizeLabel}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={handleShare} style={styles.headerBtn} accessibilityLabel="Share" haptic="light">
            <Icon name="export-variant" size="md" color={ON_MEDIA} />
          </Pressable>
          {allowDelete && (
            <Pressable onPress={handleDelete} style={styles.headerBtn} accessibilityLabel="Delete file" haptic="light">
              <Icon name="trash-can-outline" size="md" color={ON_MEDIA} />
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(a) => a.id}
        renderItem={renderPage}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={Math.min(route.params?.index ?? 0, Math.max(items.length - 1, 0))}
        getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        style={styles.list}
      />

      {current && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + SPACE.sm }]}>
          <Text variant="caption" style={styles.footerLabel}>
            {current.doc_type_source === "AI" ? "Auto-detected type · tap to change" : "What is this?"}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.types}>
            {DOC_TYPES.map((t) => {
              const active = current.doc_type === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => handleType(t)}
                  haptic="selection"
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  style={styles.type}
                >
                  <Text variant="headline" style={{ color: active ? ON_MEDIA : ON_MEDIA_SUBTLE }}>
                    {DOC_TYPE_LABELS[t]}
                  </Text>
                  <View style={[styles.underline, { backgroundColor: active ? ON_MEDIA : "transparent" }]} />
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACE.lg,
    paddingBottom: SPACE.sm,
    gap: SPACE.sm,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.pill,
    backgroundColor: SCRIM,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  title: { color: ON_MEDIA, fontFamily: FONT.bold },
  subtitle: { color: ON_MEDIA_MUTED, marginTop: 2 },
  list: { flex: 1 },
  page: { width: SCREEN_W, flex: 1, alignItems: "center", justifyContent: "center" },
  zoom: { width: SCREEN_W, flex: 1 },
  zoomContent: { flexGrow: 1, alignItems: "center", justifyContent: "center" },
  image: { width: SCREEN_W, height: "100%" },
  pdf: { width: SCREEN_W, flex: 1, backgroundColor: BG },
  center: { alignItems: "center", gap: SPACE.md, paddingHorizontal: SPACE.xxl },
  message: { color: ON_MEDIA_MUTED },
  footer: { paddingTop: SPACE.md, paddingHorizontal: SPACE.gutter },
  footerLabel: { color: ON_MEDIA_MUTED, marginBottom: SPACE.sm },
  types: { gap: SPACE.xl },
  type: { alignItems: "center", paddingVertical: SPACE.xs },
  underline: { height: 2, alignSelf: "stretch", borderRadius: RADIUS.pill, marginTop: SPACE.xs },
});

export default AttachmentViewerScreen;
