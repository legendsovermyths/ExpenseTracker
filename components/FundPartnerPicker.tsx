import React, { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { SPACE } from "../constants";
import { useExpensifyStore } from "../store/store";
import { supabase } from "../services/Supabase";
import { Avatar, ListRow, Pressable, SearchField, SectionLabel, Sheet, SheetRef, Text } from "./ui";

export interface FundPartnerPickerRef {
  open: () => void;
  close: () => void;
}

type Props = {
  onSelect: (userId: string, userName: string) => void;
};

type Profile = { id: string; full_name: string; email: string };

// Picker sheet opened from CreateFundScreen — a "quick pick" from existing
// friends (userbalances, already loaded, zero round trip) above a live
// profiles search. Kept as its own small component rather than modifying
// SearchPeople.tsx, which stays a standalone entry point for the Splits flow.
const FundPartnerPicker = forwardRef<FundPartnerPickerRef, Props>(({ onSelect }, ref) => {
  const sheetRef = useRef<SheetRef>(null);
  const userBalancesById = useExpensifyStore((s) => s.userbalances);
  const friends = Object.values(userBalancesById);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useImperativeHandle(ref, () => ({
    open: () => sheetRef.current?.present(),
    close: () => sheetRef.current?.dismiss(),
  }));

  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .or(`email.ilike.%${text}%,phone.ilike.%${text}%`);
      setLoading(false);
      if (!error) setResults(data ?? []);
    }, 300);
  };

  const choose = (id: string, name: string) => {
    setQuery("");
    setResults([]);
    onSelect(id, name);
    sheetRef.current?.dismiss();
  };

  return (
    <Sheet ref={sheetRef} title="Share this fund" snapPoints={["70%"]}>
      {friends.length > 0 && (
        <>
          <SectionLabel title="Your friends" style={styles.firstLabel} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.quickPickRow}
          >
            {friends.map((f) => (
              <Pressable
                key={f.id}
                haptic="selection"
                accessibilityLabel={f.name}
                style={styles.quickPickItem}
                onPress={() => choose(f.id, f.name)}
              >
                <Avatar name={f.name} size={44} />
                <Text variant="caption" numberOfLines={1} align="center" style={styles.quickPickName}>
                  {f.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}

      <SectionLabel title="Or search by email or phone" />
      <SearchField
        value={query}
        onChangeText={handleQueryChange}
        placeholder="Search people"
        autoCapitalize="none"
        keyboardType="email-address"
      />

      {loading && results.length === 0 && (
        <Text variant="callout" tone="muted" style={styles.searching}>
          Searching…
        </Text>
      )}
      {results.map((item) => (
        <ListRow
          key={item.id}
          padded={false}
          leading={<Avatar name={item.full_name || item.email} size={34} />}
          title={item.full_name || item.email}
          subtitle={item.email}
          onPress={() => choose(item.id, item.full_name || item.email)}
        />
      ))}
    </Sheet>
  );
});

FundPartnerPicker.displayName = "FundPartnerPicker";

const styles = StyleSheet.create({
  firstLabel: { marginTop: 0 },
  quickPickRow: { gap: SPACE.lg, paddingBottom: SPACE.xs },
  quickPickItem: { alignItems: "center", width: 64 },
  quickPickName: { marginTop: SPACE.xs },
  searching: { paddingVertical: SPACE.md },
});

export default FundPartnerPicker;
