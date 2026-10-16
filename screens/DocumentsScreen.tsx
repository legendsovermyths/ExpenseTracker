import React, { useCallback, useState } from "react";
import { Image, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { RADIUS, SPACE } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import { useExpensifyStore } from "../store/store";
import { listAttachments, listDocumentedItems } from "../services/Attachments";
import { DOC_TYPE_LABELS, DocType, DocumentedItem } from "../types/entity/Attachment";
import {
  Amount,
  EmptyState,
  Icon,
  PageList,
  Pressable,
  SkeletonList,
  Text,
  toast,
} from "../components/ui";

const FILTERS: { key: string | undefined; label: string }[] = [
  { key: undefined, label: "All" },
  { key: "BILL", label: "Bills" },
  { key: "INVOICE", label: "Invoices" },
  { key: "RECEIPT", label: "Receipts" },
  { key: "WARRANTY", label: "Warranties" },
  { key: "OTHER", label: "Other" },
  { key: "UNCLASSIFIED", label: "Unsorted" },
];

const THUMB = 52;

const formatDate = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

function DocumentsScreen() {
  const navigation = useNavigation<any>();
  const { COLORS } = useTheme();
  const categories = useExpensifyStore((s) => s.categories);

  const [filter, setFilter] = useState<string | undefined>(undefined);
  const [items, setItems] = useState<DocumentedItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setItems(await listDocumentedItems(filter));
    } catch (e: any) {
      setError(e?.message ?? "Couldn't load documents");
      setItems([]);
    }
  }, [filter]);

  // Refresh on focus so changes made in the viewer show up on return.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const open = async (item: DocumentedItem) => {
    try {
      const attachments = await listAttachments(item.owner_type, item.owner_id);
      if (attachments.length === 0) return load();
      navigation.navigate("AttachmentViewer", { attachments, index: 0 });
    } catch (e: any) {
      toast(e?.message ?? "Couldn't open documents", "error");
    }
  };

  const renderItem = ({ item, index }: { item: DocumentedItem; index: number }) => {
    const category = item.category_id != null ? categories[item.category_id] : undefined;
    const subtitle =
      item.owner_type === "SPLIT"
        ? `Split${item.counterparty_name ? ` with ${item.counterparty_name}` : ""}`
        : category?.name ?? "Transaction";
    const types = item.doc_types.filter((t): t is DocType => t !== "UNCLASSIFIED");
    return (
      <Pressable scale={false} onPress={() => open(item)} accessibilityLabel={item.description || "Untitled"}>
        {index > 0 && <View style={[styles.separator, { backgroundColor: COLORS.hairline }]} />}
        <View style={styles.row}>
          <View style={[styles.thumb, { backgroundColor: COLORS.surface1 }]}>
            {item.thumbnail_b64 ? (
              <Image source={{ uri: `data:image/jpeg;base64,${item.thumbnail_b64}` }} style={styles.thumbImage} />
            ) : (
              <Icon name="file-document-outline" size="lg" color={COLORS.inkMuted} />
            )}
            {item.attachment_count > 1 && (
              <View style={[styles.count, { backgroundColor: COLORS.ink, borderColor: COLORS.paper }]}>
                <Text variant="caption" tone="onAccent" style={styles.countText}>
                  {item.attachment_count}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.body}>
            <Text variant="headline" numberOfLines={1}>
              {item.description || "Untitled"}
            </Text>
            <Text variant="callout" tone="muted" numberOfLines={1} style={styles.meta}>
              {subtitle}  ·  {formatDate(item.date_time)}
            </Text>
            {types.length > 0 && (
              <Text variant="label" tone="subtle" numberOfLines={1} style={styles.types}>
                {types.map((t) => DOC_TYPE_LABELS[t]).join("  ·  ")}
              </Text>
            )}
          </View>
          <Amount cents={Math.round(item.amount * 100)} variant="amount" tone={item.is_credit ? "down" : "ink"} />
        </View>
      </Pressable>
    );
  };

  const filters = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filters}
      style={styles.filterRail}
    >
      {FILTERS.map((f) => {
        const active = f.key === filter;
        return (
          <Pressable
            key={f.label}
            haptic={active ? undefined : "selection"}
            onPress={() => setFilter(f.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={styles.filter}
          >
            <Text variant="headline" tone={active ? "ink" : "subtle"}>
              {f.label}
            </Text>
            <View style={[styles.underline, { backgroundColor: active ? COLORS.accent : "transparent" }]} />
          </Pressable>
        );
      })}
    </ScrollView>
  );

  return (
    <PageList
      title="Documents"
      subtitle="Bills, receipts and warranties attached to your expenses."
      header={filters}
      data={items ?? []}
      extraData={categories}
      keyExtractor={(i) => `${i.owner_type}:${i.owner_id}`}
      renderItem={renderItem}
      estimatedItemSize={84}
      ListEmptyComponent={
        items === null ? (
          <SkeletonList rows={6} padded />
        ) : error ? (
          <EmptyState icon="alert-circle-outline" title="Couldn't load documents" message={error} actionLabel="Try again" onAction={load} />
        ) : (
          <EmptyState
            icon="paperclip"
            title="Nothing here yet"
            message={
              filter
                ? "No documents of this type."
                : "Attach a bill, receipt or warranty card while adding a transaction or split, and it'll show up here."
            }
          />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  filterRail: { marginTop: SPACE.sm, marginBottom: SPACE.sm },
  filters: { gap: SPACE.xl, paddingHorizontal: SPACE.gutter },
  filter: { alignItems: "center", paddingVertical: SPACE.xs },
  underline: { height: 2, alignSelf: "stretch", borderRadius: RADIUS.pill, marginTop: SPACE.xs },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: SPACE.gutter + THUMB + SPACE.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.gutter,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  thumbImage: { width: THUMB, height: THUMB, borderRadius: RADIUS.md },
  count: {
    position: "absolute",
    right: -5,
    bottom: -5,
    minWidth: 20,
    height: 20,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACE.xs,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  countText: { fontSize: 10, lineHeight: 12 },
  body: { flex: 1, minWidth: 0 },
  meta: { marginTop: 2 },
  types: { marginTop: SPACE.xs },
});

export default DocumentsScreen;
