import React, { useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { Icon } from "@rneui/themed";
import { SIZES, FONTS } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import { useExpensifyStore } from "../store/store";
import { deleteFriend } from "../services/FriendService";

interface FriendRow {
  id: string;
  name: string;
  isSaved: boolean;
}

const getInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";

export default function UserSearchScreen({ navigation }) {
  const { COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const [query, setQuery] = useState("");
  const me = useExpensifyStore((s) => s.userId);
  const friends = useExpensifyStore((s) => s.friends);
  const userBalances = useExpensifyStore((s) => s.userbalances);
  const removeFriendFromUI = useExpensifyStore((s) => s.removeFriend);

  // Friends added via QR, plus anyone you already share a balance with.
  const allFriends = useMemo<FriendRow[]>(() => {
    const byId: Record<string, FriendRow> = {};
    Object.values(userBalances).forEach((b) => {
      if (b.id !== me) byId[b.id] = { id: b.id, name: b.name, isSaved: false };
    });
    Object.values(friends).forEach((f) => {
      if (f.id !== me) byId[f.id] = { id: f.id, name: f.name, isSaved: true };
    });
    return Object.values(byId).sort((a, b) => a.name.localeCompare(b.name));
  }, [friends, userBalances, me]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? allFriends.filter((f) => f.name.toLowerCase().includes(q)) : allFriends;
  }, [allFriends, query]);

  const confirmRemove = (friend: FriendRow) => {
    if (!friend.isSaved) return;
    Alert.alert("Remove friend", `Remove ${friend.name} from your friend list?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteFriend(friend.id);
            removeFriendFromUI(friend.id);
          } catch (e: any) {
            Alert.alert("Couldn't remove friend", e?.message ?? "Please try again.");
          }
        },
      },
    ]);
  };

  const renderEmpty = () => (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name="account-multiple-plus-outline" type="material-community" size={40} color={COLORS.primary} />
      </View>
      <Text style={styles.emptyTitle}>{query ? "No matching friends" : "No friends yet"}</Text>
      <Text style={styles.emptyText}>
        Scan a friend's Expensify QR code, or share yours, to start splitting expenses.
      </Text>
      <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate("ScanFriendQR")}>
        <Icon name="qrcode-scan" type="material-community" size={18} color={COLORS.white} />
        <Text style={styles.primaryBtnText}>Scan a QR code</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.linkBtn} onPress={() => navigation.navigate("MyQRCode")}>
        <Text style={styles.linkBtnText}>Show my QR code</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Icon name="arrow-left" type="material-community" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Split with</Text>
        <TouchableOpacity onPress={() => navigation.navigate("ScanFriendQR")} style={styles.headerBtn}>
          <Icon name="qrcode-scan" type="material-community" size={22} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {allFriends.length > 0 && (
        <View style={styles.searchBox}>
          <Icon name="magnify" type="material-community" size={20} color={COLORS.darkgray} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search friends"
            placeholderTextColor={COLORS.darkgray}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
          />
        </View>
      )}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={results.length ? styles.list : styles.listEmpty}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={
          results.length ? (
            <TouchableOpacity style={styles.addRow} onPress={() => navigation.navigate("ScanFriendQR")}>
              <View style={[styles.avatar, styles.addAvatar]}>
                <Icon name="plus" type="material-community" size={20} color={COLORS.primary} />
              </View>
              <Text style={styles.addText}>Add a friend via QR code</Text>
            </TouchableOpacity>
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            activeOpacity={0.7}
            onPress={() => navigation.navigate("SplitInputScreen", { userId: item.id, userName: item.name })}
            onLongPress={() => confirmRemove(item)}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
            </View>
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
            <Icon name="chevron-right" type="material-community" size={22} color={COLORS.darkgray} />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const createStyles = (COLORS: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.white },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: SIZES.padding,
      paddingTop: SIZES.padding * 2.5,
      paddingBottom: SIZES.base,
    },
    headerBtn: { padding: 4, width: 32 },
    headerTitle: { ...FONTS.h2, fontWeight: "700", color: COLORS.primary },
    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: SIZES.padding,
      marginVertical: SIZES.base,
      paddingHorizontal: SIZES.padding * 0.75,
      height: 46,
      borderRadius: 23,
      backgroundColor: COLORS.lightGray,
    },
    searchInput: { flex: 1, marginLeft: 8, color: COLORS.black, ...FONTS.body3 },
    list: { paddingHorizontal: SIZES.padding, paddingBottom: SIZES.padding * 2 },
    listEmpty: { flexGrow: 1 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: SIZES.base * 1.5,
      borderBottomWidth: 1,
      borderBottomColor: COLORS.lightGray,
    },
    avatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: COLORS.primary + "18",
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { ...FONTS.h4, fontWeight: "700", color: COLORS.primary },
    name: { ...FONTS.body3, flex: 1, color: COLORS.black, marginLeft: SIZES.padding * 0.75 },
    addRow: { flexDirection: "row", alignItems: "center", paddingVertical: SIZES.base * 1.5 },
    addAvatar: { borderWidth: 1.5, borderColor: COLORS.primary, borderStyle: "dashed", backgroundColor: "transparent" },
    addText: { ...FONTS.body3, color: COLORS.primary, marginLeft: SIZES.padding * 0.75 },
    empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: SIZES.padding * 2 },
    emptyIcon: {
      width: 84,
      height: 84,
      borderRadius: 42,
      backgroundColor: COLORS.primary + "14",
      alignItems: "center",
      justifyContent: "center",
    },
    emptyTitle: { ...FONTS.h3, fontWeight: "700", color: COLORS.primary, marginTop: SIZES.padding },
    emptyText: { ...FONTS.body4, color: COLORS.darkgray, textAlign: "center", marginTop: SIZES.base },
    primaryBtn: {
      marginTop: SIZES.padding * 1.5,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: SIZES.padding * 1.5,
      height: 48,
      borderRadius: 24,
      backgroundColor: COLORS.primary,
    },
    primaryBtnText: { ...FONTS.h4, fontWeight: "700", color: COLORS.white },
    linkBtn: { marginTop: SIZES.base * 1.5, padding: SIZES.base },
    linkBtnText: { ...FONTS.body3, color: COLORS.primary, fontWeight: "600" },
  });
