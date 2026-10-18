import React, { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import { SPACE } from "../constants";
import { useFriendList } from "../services/FriendService";
import { matchesSearch } from "../services/Search";
import { Avatar, ListRow, SearchField, Sheet, SheetRef, Text } from "./ui";

export interface FundPartnerPickerRef {
  open: () => void;
  close: () => void;
}

type Props = {
  onSelect: (userId: string, userName: string) => void;
  /** Shown when the person isn't a friend yet; people are added by QR only. */
  onAddByQR: () => void;
};

// Picker sheet opened from CreateFundScreen. People are only ever added by
// QR, so this lists your friends (QR-added plus anyone you share a balance
// with) with a local filter; there's no server-side people search.
const FundPartnerPicker = forwardRef<FundPartnerPickerRef, Props>(({ onSelect, onAddByQR }, ref) => {
  const sheetRef = useRef<SheetRef>(null);
  const friends = useFriendList();
  const [query, setQuery] = useState("");

  useImperativeHandle(ref, () => ({
    open: () => sheetRef.current?.present(),
    close: () => sheetRef.current?.dismiss(),
  }));

  const q = query.trim().toLowerCase();
  const visible = q ? friends.filter((f) => matchesSearch(q, f.name)) : friends;

  const choose = (id: string, name: string) => {
    setQuery("");
    onSelect(id, name);
    sheetRef.current?.dismiss();
  };

  return (
    <Sheet ref={sheetRef} title="Share this fund" snapPoints={["70%"]}>
      {friends.length > 0 && (
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Search your friends"
          style={styles.search}
        />
      )}
      {visible.map((f) => (
        <ListRow
          key={f.id}
          padded={false}
          leading={<Avatar name={f.name} size={34} />}
          title={f.name}
          onPress={() => choose(f.id, f.name)}
        />
      ))}
      {q && visible.length === 0 && (
        <Text variant="callout" tone="muted" style={styles.empty}>
          No friends match "{query.trim()}"
        </Text>
      )}
      <ListRow
        padded={false}
        icon="qrcode-scan"
        title="Add a friend by QR code"
        onPress={() => {
          sheetRef.current?.dismiss();
          onAddByQR();
        }}
      />
    </Sheet>
  );
});

FundPartnerPicker.displayName = "FundPartnerPicker";

const styles = StyleSheet.create({
  search: { marginBottom: SPACE.sm },
  empty: { paddingVertical: SPACE.md },
});

export default FundPartnerPicker;
