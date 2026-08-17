import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { Icon } from "react-native-elements";
import { SIZES, FONTS } from "../constants";
import { ColorPalette } from "../constants/theme";
import { useTheme } from "../contexts/ThemeContext";
import { useExpensifyStore } from "../store/store";
import { supabase } from "../services/Supabase";
import { Avatar } from "./primitives";

export interface FundPartnerPickerRef {
  open: () => void;
  close: () => void;
}

type Props = {
  onSelect: (userId: string, userName: string) => void;
};

type Profile = { id: string; full_name: string; email: string };

// Opened as a BottomSheetModal from CreateFundScreen — a "quick pick" from
// existing friends (userbalances, already loaded, zero round trip) above a
// copy of SearchPeople.tsx's live profiles search. Kept as its own small
// component rather than modifying SearchPeople.tsx, which stays a standalone
// full-screen entry point for the (unrelated) Splits flow.
const FundPartnerPicker = forwardRef<FundPartnerPickerRef, Props>(({ onSelect }, ref) => {
  const { COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const sheetRef = useRef<BottomSheetModal>(null);
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
    <BottomSheetModal
      ref={sheetRef}
      index={0}
      snapPoints={["70%"]}
      backgroundStyle={{ backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
    >
      <BottomSheetView style={styles.sheetContent}>
        <Text style={styles.sheetTitle}>Share this fund</Text>

        {friends.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Your friends</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickPickRow}>
              {friends.map((f) => (
                <TouchableOpacity key={f.id} style={styles.quickPickItem} onPress={() => choose(f.id, f.name)}>
                  <Avatar name={f.name} size={44} />
                  <Text style={styles.quickPickName} numberOfLines={1}>{f.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        <Text style={styles.sectionLabel}>Or search by email/phone</Text>
        <View style={styles.searchBox}>
          <Icon name="magnify" type="material-community" size={18} color={COLORS.inkMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search people"
            placeholderTextColor={COLORS.inkSubtle}
            value={query}
            onChangeText={handleQueryChange}
          />
        </View>

        {loading && <ActivityIndicator style={{ marginTop: SIZES.padding }} color={COLORS.accent} />}

        <ScrollView keyboardShouldPersistTaps="handled">
          {results.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.resultRow}
              onPress={() => choose(item.id, item.full_name || item.email)}
            >
              <Avatar name={item.full_name || item.email} size={38} />
              <View style={{ flex: 1 }}>
                <Text style={styles.resultName}>{item.full_name || item.email}</Text>
                <Text style={styles.resultSub}>{item.email}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </BottomSheetView>
    </BottomSheetModal>
  );
});

const createStyles = (COLORS: ColorPalette) =>
  StyleSheet.create({
    sheetContent: { flex: 1, paddingHorizontal: SIZES.padding },
    sheetTitle: { ...FONTS.h3, fontWeight: "600", color: COLORS.primary, marginBottom: SIZES.base + 2 },
    sectionLabel: { ...FONTS.body4, color: COLORS.darkgray, marginBottom: SIZES.base, marginTop: SIZES.base },

    quickPickRow: { gap: SIZES.padding, paddingBottom: SIZES.base + 2 },
    quickPickItem: { alignItems: "center", width: 64 },
    quickPickName: { ...FONTS.caption, color: COLORS.primary, marginTop: 4, textAlign: "center" },

    searchBox: {
      flexDirection: "row", alignItems: "center", gap: SIZES.base,
      backgroundColor: COLORS.surface1, borderRadius: 10, paddingHorizontal: SIZES.base + 2,
      marginBottom: SIZES.base,
    },
    searchInput: { flex: 1, ...FONTS.body3, color: COLORS.ink, paddingVertical: SIZES.base },

    resultRow: {
      flexDirection: "row", alignItems: "center", gap: SIZES.base + 2,
      paddingVertical: SIZES.base + 2,
    },
    resultName: { ...FONTS.body3, fontWeight: "500", color: COLORS.primary },
    resultSub: { ...FONTS.caption, color: COLORS.darkgray },
  });

export default FundPartnerPicker;
