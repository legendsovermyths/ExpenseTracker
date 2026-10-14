import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "react-native-elements";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { FONTS, SIZES } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import { ColorPalette } from "../constants/theme";
import HeaderNavigator from "../components/HeaderNavigator";
import HeaderText from "../components/HeaderText";
import { useExpensifyStore } from "../store/store";
import { formatAmountWithCommas } from "../services/Utils";
import { listAttachments, listDocumentedItems } from "../services/Attachments";
import { DOC_TYPE_LABELS, DocType, DocumentedItem } from "../types/entity/Attachment";

const FILTERS: { key: string | undefined; label: string }[] = [
  { key: undefined, label: "All" },
  { key: "BILL", label: "Bills" },
  { key: "INVOICE", label: "Invoices" },
  { key: "RECEIPT", label: "Receipts" },
  { key: "WARRANTY", label: "Warranties" },
  { key: "OTHER", label: "Other" },
  { key: "UNCLASSIFIED", label: "Unsorted" },
];

const formatDate = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

export default function DocumentsScreen() {
  const navigation = useNavigation<any>();
  const { COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
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
      setError(e?.message ?? "Couldn't open documents");
    }
  };

  const renderItem = ({ item }: { item: DocumentedItem }) => {
    const category = item.category_id != null ? categories[item.category_id] : undefined;
    const subtitle =
      item.owner_type === "SPLIT"
        ? `Split${item.counterparty_name ? ` with ${item.counterparty_name}` : ""}`
        : category?.name ?? "Transaction";
    const types = item.doc_types.filter((t): t is DocType => t !== "UNCLASSIFIED");
    return (
      <TouchableOpacity style={styles.row} onPress={() => open(item)} activeOpacity={0.7}>
        <View style={styles.thumb}>
          {item.thumbnail_b64 ? (
            <Image source={{ uri: `data:image/jpeg;base64,${item.thumbnail_b64}` }} style={styles.thumbImage} />
          ) : (
            <Icon name="file-document-outline" type="material-community" size={24} color={COLORS.darkgray} />
          )}
          {item.attachment_count > 1 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{item.attachment_count}</Text>
            </View>
          )}
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {item.description || "Untitled"}
          </Text>
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            {subtitle} · {formatDate(item.date_time)}
          </Text>
          {types.length > 0 && (
            <View style={styles.tags}>
              {types.map((t) => (
                <View key={t} style={styles.tag}>
                  <Text style={styles.tagText}>{DOC_TYPE_LABELS[t]}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
        <Text style={[styles.amount, item.is_credit && { color: COLORS.darkgreen }]}>
          ₹{formatAmountWithCommas(item.amount, false)}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <HeaderNavigator onBackPress={() => navigation.goBack()} />
        <HeaderText text="Documents" />
        <Text style={styles.description}>Bills, receipts and warranties attached to your expenses</Text>
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((f) => {
            const active = f.key === filter;
            return (
              <TouchableOpacity
                key={f.label}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setFilter(f.key)}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {items === null ? (
        <ActivityIndicator style={{ marginTop: SIZES.padding * 2 }} color={COLORS.darkgray} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => `${i.owner_type}:${i.owner_id}`}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name="paperclip" type="material-community" size={36} color={COLORS.gray} />
              <Text style={styles.emptyTitle}>{error ?? "Nothing here yet"}</Text>
              {!error && (
                <Text style={styles.emptyText}>
                  {filter
                    ? "No documents of this type."
                    : "Attach a bill, receipt or warranty card while adding a transaction or split, and it'll show up here."}
                </Text>
              )}
            </View>
          }
        />
      )}
    </View>
  );
}

const createStyles = (COLORS: ColorPalette) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.white,
      paddingTop: SIZES.padding,
    },
    header: {
      paddingHorizontal: SIZES.padding,
      paddingTop: (SIZES.padding * 4) / 3,
      paddingBottom: SIZES.base,
      backgroundColor: COLORS.white,
    },
    description: {
      ...FONTS.body4,
      color: COLORS.darkgray,
      marginTop: SIZES.base / 2,
      paddingHorizontal: SIZES.padding / 5,
    },
    filters: {
      gap: 8,
      paddingHorizontal: SIZES.padding,
      paddingVertical: SIZES.base,
    },
    filterChip: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 16,
      backgroundColor: COLORS.lightGray,
    },
    filterChipActive: {
      backgroundColor: COLORS.primary,
    },
    filterText: {
      ...FONTS.body4,
      fontSize: 13,
      color: COLORS.primary,
      fontWeight: "500",
    },
    filterTextActive: {
      color: COLORS.white,
    },
    list: {
      paddingHorizontal: SIZES.padding,
      paddingBottom: SIZES.padding * 3,
      flexGrow: 1,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: SIZES.base + 4,
      gap: 12,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: COLORS.gray,
      marginLeft: 64,
    },
    thumb: {
      width: 52,
      height: 52,
      borderRadius: 10,
      backgroundColor: COLORS.lightGray,
      alignItems: "center",
      justifyContent: "center",
      overflow: "visible",
    },
    thumbImage: {
      width: 52,
      height: 52,
      borderRadius: 10,
    },
    countBadge: {
      position: "absolute",
      right: -5,
      bottom: -5,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      paddingHorizontal: 4,
      backgroundColor: COLORS.primary,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: COLORS.white,
    },
    countText: {
      color: COLORS.white,
      fontSize: 10,
      fontWeight: "700",
    },
    rowBody: {
      flex: 1,
    },
    rowTitle: {
      ...FONTS.body3,
      color: COLORS.primary,
      fontWeight: "500",
    },
    rowSubtitle: {
      ...FONTS.body4,
      fontSize: 12,
      color: COLORS.darkgray,
      marginTop: 2,
    },
    tags: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 4,
      marginTop: 6,
    },
    tag: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
      backgroundColor: COLORS.lightGray,
    },
    tagText: {
      fontSize: 11,
      color: COLORS.darkgray,
      fontWeight: "600",
    },
    amount: {
      ...FONTS.body4,
      color: COLORS.primary,
      fontWeight: "600",
    },
    empty: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingTop: SIZES.padding * 3,
      paddingHorizontal: SIZES.padding,
      gap: 8,
    },
    emptyTitle: {
      ...FONTS.body3,
      color: COLORS.primary,
      fontWeight: "600",
    },
    emptyText: {
      ...FONTS.body4,
      color: COLORS.darkgray,
      textAlign: "center",
    },
  });
