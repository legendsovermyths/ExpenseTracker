import React, { useMemo, useState } from "react";
import { StyleSheet, Alert } from "react-native";
import { SPACE } from "../constants";
import {
  Avatar,
  Button,
  EmptyState,
  HeaderIconButton,
  ListRow,
  PageList,
  SearchField,
} from "../components/ui";
import { useExpensifyStore } from "../store/store";
import { deleteFriend } from "../services/FriendService";

interface FriendRow {
  id: string;
  name: string;
  isSaved: boolean;
}

export default function UserSearchScreen({ navigation }) {
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

  return (
    <PageList
      title="Split with"
      subtitle="Pick a friend to share a cost"
      right={<HeaderIconButton icon="qrcode-scan" label="Scan a QR code" tone="ink" onPress={() => navigation.navigate("ScanFriendQR")} />}
      header={
        allFriends.length > 0 ? (
          <SearchField value={query} onChangeText={setQuery} placeholder="Search friends" style={styles.search} />
        ) : null
      }
      data={results}
      keyExtractor={(item: FriendRow) => item.id}
      estimatedItemSize={60}
      ListEmptyComponent={
        <EmptyState
          icon="account-multiple-plus-outline"
          title={query ? "No matching friends" : "No friends yet"}
          message="Scan a friend's Expensify QR code, or share yours, to start splitting expenses."
          actionLabel="Scan a QR code"
          onAction={() => navigation.navigate("ScanFriendQR")}
        />
      }
      ListFooterComponent={
        results.length ? (
          <ListRow
            icon="plus"
            title="Add a friend via QR code"
            onPress={() => navigation.navigate("ScanFriendQR")}
            style={styles.gutter}
            padded={false}
          />
        ) : allFriends.length === 0 ? (
          <Button title="Show my QR code" variant="secondary" onPress={() => navigation.navigate("MyQRCode")} />
        ) : null
      }
      renderItem={({ item }: { item: FriendRow }) => (
        <ListRow
          padded={false}
          style={styles.gutter}
          leading={<Avatar name={item.name} size={36} />}
          title={item.name}
          chevron
          onPress={() => navigation.navigate("SplitInputScreen", { userId: item.id, userName: item.name })}
          onLongPress={() => confirmRemove(item)}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  search: { marginHorizontal: SPACE.gutter, marginTop: SPACE.sm, marginBottom: SPACE.xs },
  gutter: { paddingHorizontal: SPACE.gutter },
});
