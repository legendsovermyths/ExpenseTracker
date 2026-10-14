import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewToken,
} from "react-native";
import { Icon } from "react-native-elements";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import RNFS from "react-native-fs";
import Share from "react-native-share";
import { FONTS, SIZES } from "../constants";
import { Attachment, DOC_TYPES, DOC_TYPE_LABELS, DocType } from "../types/entity/Attachment";
import {
  deleteAttachments,
  loadAttachmentData,
  onAttachmentUpdated,
  setAttachmentDocType,
  writeAttachmentToTemp,
} from "../services/Attachments";

const { width: SCREEN_W } = Dimensions.get("window");
const BG = "#0b0b0c";

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
      if (e?.message && !/cancel/i.test(e.message)) Alert.alert("Couldn't share", e.message);
    }
  };

  const handleDelete = () => {
    if (!current) return;
    Alert.alert("Delete file?", `"${current.file_name}" will be removed from this record.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteAttachments([current.id]);
            const next = items.filter((a) => a.id !== current.id);
            if (next.length === 0) {
              navigation.goBack();
              return;
            }
            setItems(next);
            setIndex((i) => Math.min(i, next.length - 1));
          } catch (e: any) {
            Alert.alert("Couldn't delete", e?.message ?? "Please try again.");
          }
        },
      },
    ]);
  };

  const handleType = async (t: DocType) => {
    if (!current) return;
    const next = current.doc_type === t && current.doc_type_source === "USER" ? null : t;
    try {
      await setAttachmentDocType(current.id, next);
    } catch (e: any) {
      Alert.alert("Couldn't update", e?.message ?? "Please try again.");
    }
  };

  const renderPage = ({ item }: { item: Attachment }) => {
    const l = loaded[item.id];
    const err = failed[item.id];
    let body: React.ReactNode;
    if (err) {
      body = <Text style={styles.message}>{err}</Text>;
    } else if (!l) {
      body = <ActivityIndicator color="#fff" />;
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
          <Icon name="file-outline" type="material-community" size={56} color="#888" />
          <Text style={styles.message}>Preview isn't available. Use Share to open it.</Text>
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
      <View style={[styles.header, { paddingTop: insets.top + SIZES.base }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn} hitSlop={8}>
          <Icon name="close" type="material-community" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title} numberOfLines={1}>
            {current?.file_name ?? ""}
          </Text>
          <Text style={styles.subtitle}>
            {items.length > 1 ? `${index + 1} of ${items.length} · ` : ""}
            {sizeLabel}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleShare} style={styles.headerBtn} hitSlop={8}>
            <Icon name="export-variant" type="material-community" size={22} color="#fff" />
          </TouchableOpacity>
          {allowDelete && (
            <TouchableOpacity onPress={handleDelete} style={styles.headerBtn} hitSlop={8}>
              <Icon name="trash-can-outline" type="material-community" size={22} color="#fff" />
            </TouchableOpacity>
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
        <View style={[styles.footer, { paddingBottom: insets.bottom + SIZES.base }]}>
          <Text style={styles.footerLabel}>
            {current.doc_type_source === "AI" ? "Auto-detected type · tap to change" : "What is this?"}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {DOC_TYPES.map((t) => {
              const active = current.doc_type === t;
              return (
                <TouchableOpacity
                  key={t}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => handleType(t)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{DOC_TYPE_LABELS[t]}</Text>
                </TouchableOpacity>
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
    paddingHorizontal: SIZES.padding * 0.6,
    paddingBottom: SIZES.base,
    gap: SIZES.base,
  },
  headerBtn: { padding: 6 },
  headerCenter: { flex: 1, alignItems: "center" },
  headerActions: { flexDirection: "row", alignItems: "center" },
  title: { ...FONTS.body4, color: "#fff", fontWeight: "600" },
  subtitle: { fontSize: 12, color: "#9a9a9f", marginTop: 2 },
  list: { flex: 1 },
  page: { width: SCREEN_W, flex: 1, alignItems: "center", justifyContent: "center" },
  zoom: { width: SCREEN_W, flex: 1 },
  zoomContent: { flexGrow: 1, alignItems: "center", justifyContent: "center" },
  image: { width: SCREEN_W, height: "100%" },
  pdf: { width: SCREEN_W, flex: 1, backgroundColor: BG },
  center: { alignItems: "center", gap: 12, paddingHorizontal: 32 },
  message: { color: "#c7c7cc", textAlign: "center", fontSize: 14 },
  footer: { paddingTop: SIZES.base + 2, paddingHorizontal: SIZES.padding * 0.7 },
  footerLabel: { color: "#9a9a9f", fontSize: 12, marginBottom: SIZES.base },
  chips: { gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#3a3a3c",
  },
  chipActive: { backgroundColor: "#fff", borderColor: "#fff" },
  chipText: { color: "#e5e5ea", fontSize: 13, fontWeight: "500" },
  chipTextActive: { color: "#000" },
});

export default AttachmentViewerScreen;
