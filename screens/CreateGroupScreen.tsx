import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Icon } from "react-native-elements";
import uuid from "react-native-uuid";
import { FONTS, SIZES, FONT } from "../constants";
import { ColorPalette } from "../constants/theme";
import { useTheme } from "../contexts/ThemeContext";
import { useExpensifyStore } from "../store/store";
import { supabase } from "../services/Supabase";
import {
  deleteGroup,
  fetchGroupDetail,
  fetchGroups,
  upsertGroup,
} from "../services/Groups";
import { syncSplitsNow } from "../services/BackgroundSync";
import { Avatar } from "../components/primitives";
import { GroupMember } from "../types/entity/Group";

interface Person {
  id: string;
  name: string;
  email?: string | null;
}

const now = () => new Date().toISOString();

// Create a group, or (with `grpId`) rename it / add / remove members.
const CreateGroupScreen: React.FC = () => {
  const { COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const navigation: any = useNavigation();
  const route = useRoute<any>();
  const grpId: string | undefined = route.params?.grpId;
  const isEdit = !!grpId;

  const me = useExpensifyStore((s) => s.getUserId());
  const userBalancesById = useExpensifyStore((s) => s.userbalances);
  const setGroupsInUI = useExpensifyStore((s) => s.setGroups);

  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Person[]>([]);
  // Existing members (edit mode) — removing them is a soft delete, and only
  // allowed when they're settled within the group.
  const [existing, setExisting] = useState<GroupMember[]>([]);
  const [groupBalances, setGroupBalances] = useState<Record<string, number>>({});
  const [createdBy, setCreatedBy] = useState<string>(me);
  const [createdAt, setCreatedAt] = useState<string>(now());
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Person[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!grpId) return;
    (async () => {
      const d = await fetchGroupDetail(grpId, me);
      if (!d) return;
      setName(d.group.name);
      setCreatedBy(d.group.created_by);
      setCreatedAt(d.group.created_at);
      setExisting(d.members);
      setSelected(
        d.members
          .filter((m) => m.user_id !== me)
          .map((m) => ({ id: m.user_id, name: m.user_name || "Unknown" })),
      );
      const b: Record<string, number> = {};
      d.member_balances.forEach((mb) => (b[mb.user_id] = mb.net_cents));
      setGroupBalances(b);
    })();
  }, [grpId]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      const { data, error: err } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone")
        .or(`email.ilike.%${q}%,phone.ilike.%${q}%,full_name.ilike.%${q}%`)
        .neq("id", me)
        .limit(20);
      setSearching(false);
      if (!err && data) {
        setResults(
          data.map((p: any) => ({ id: p.id, name: p.full_name || p.email, email: p.email })),
        );
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const selectedIds = new Set(selected.map((p) => p.id));

  // People you already split with — quick add without searching.
  const friendSuggestions: Person[] = Object.values(userBalancesById)
    .filter((b) => b.id !== me && !selectedIds.has(b.id))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((b) => ({ id: b.id, name: b.name }));

  const add = (p: Person) => {
    if (selectedIds.has(p.id)) return;
    setSelected((prev) => [...prev, p]);
    setQuery("");
    setResults([]);
  };

  const remove = (p: Person) => {
    const bal = groupBalances[p.id] ?? 0;
    if (Math.abs(bal) > 1) {
      Alert.alert(
        "Can't remove yet",
        `${p.name} isn't settled up in this group. Settle their balance first.`,
      );
      return;
    }
    setSelected((prev) => prev.filter((x) => x.id !== p.id));
  };

  const save = async () => {
    if (!name.trim()) {
      setError("Give the group a name");
      return;
    }
    if (selected.length === 0) {
      setError("Add at least one person");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const id = grpId ?? (uuid.v4() as string);
      const ts = now();
      const existingById = new Map(existing.map((m) => [m.user_id, m]));
      const members: GroupMember[] = [];
      const memberFor = (userId: string, userName: string | null): GroupMember => ({
        grp_id: id,
        user_id: userId,
        user_name: userName,
        joined_at: existingById.get(userId)?.joined_at ?? ts,
        updated_at: ts,
        is_deleted: false,
      });
      members.push(memberFor(me, existingById.get(me)?.user_name ?? null));
      selected.forEach((p) => members.push(memberFor(p.id, p.name)));
      existing
        .filter((m) => m.user_id !== me && !selectedIds.has(m.user_id))
        .forEach((m) => members.push({ ...m, updated_at: ts, is_deleted: true }));

      await upsertGroup(
        {
          id,
          name: name.trim(),
          created_by: createdBy,
          created_at: createdAt,
          updated_at: ts,
          is_deleted: false,
        },
        members,
      );
      setGroupsInUI(await fetchGroups(me));
      syncSplitsNow().catch(() => {});
      if (isEdit) navigation.goBack();
      else navigation.replace("GroupDetail", { grpId: id });
    } catch (e: any) {
      setError(e?.message ?? "Couldn't save the group");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    const unsettled = Object.values(groupBalances).some((v) => Math.abs(v) > 1);
    Alert.alert(
      "Delete group",
      unsettled
        ? "This group still has unsettled balances. Its expenses will stay in each friend's ledger. Delete anyway?"
        : "Delete this group? Its expenses will stay in each friend's ledger.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteGroup(grpId!);
            setGroupsInUI(await fetchGroups(me));
            syncSplitsNow().catch(() => {});
            navigation.pop(2);
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Icon name="close" type="material-community" size={24} color={COLORS.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEdit ? "Edit group" : "New group"}</Text>
        <TouchableOpacity onPress={save} style={styles.headerBtn} disabled={saving}>
          {saving ? (
            <ActivityIndicator color={COLORS.ink} />
          ) : (
            <Icon name="check" type="material-community" size={24} color={COLORS.ink} />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: SIZES.padding, paddingBottom: 80 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.nameRow}>
          <Icon name="account-group-outline" type="material-community" size={22} color={COLORS.inkMuted} />
          <TextInput
            style={styles.nameInput}
            placeholder="Group name (e.g. Goa trip)"
            placeholderTextColor={COLORS.inkMuted}
            value={name}
            onChangeText={setName}
            autoFocus={!isEdit}
          />
        </View>

        <Text style={styles.sectionLabel}>Members</Text>
        <View style={styles.chipsWrap}>
          <View style={[styles.memberChip, styles.memberChipMe]}>
            <Avatar name="You" size={22} />
            <Text style={styles.memberChipText}>You</Text>
          </View>
          {selected.map((p) => (
            <TouchableOpacity key={p.id} style={styles.memberChip} onPress={() => remove(p)}>
              <Avatar name={p.name} size={22} />
              <Text style={styles.memberChipText} numberOfLines={1}>
                {p.name}
              </Text>
              <Icon name="close" type="material-community" size={14} color={COLORS.inkMuted} />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.searchBox}>
          <Icon name="magnify" type="material-community" size={18} color={COLORS.inkMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Add people by name, email or phone"
            placeholderTextColor={COLORS.inkSubtle}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
          />
          {searching && <ActivityIndicator size="small" color={COLORS.inkMuted} />}
        </View>

        {results
          .filter((r) => !selectedIds.has(r.id))
          .map((r) => (
            <TouchableOpacity key={r.id} style={styles.personRow} onPress={() => add(r)}>
              <Avatar name={r.name} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={styles.personName}>{r.name}</Text>
                {r.email ? <Text style={styles.personSub}>{r.email}</Text> : null}
              </View>
              <Icon name="plus-circle-outline" type="material-community" size={22} color={COLORS.ink} />
            </TouchableOpacity>
          ))}

        {!query.trim() && friendSuggestions.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: SIZES.padding }]}>Friends</Text>
            {friendSuggestions.map((f) => (
              <TouchableOpacity key={f.id} style={styles.personRow} onPress={() => add(f)}>
                <Avatar name={f.name} size={36} />
                <Text style={[styles.personName, { flex: 1 }]}>{f.name}</Text>
                <Icon name="plus-circle-outline" type="material-community" size={22} color={COLORS.ink} />
              </TouchableOpacity>
            ))}
          </>
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}

        {isEdit && (
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
            <Icon name="trash-can-outline" type="material-community" size={18} color={COLORS.deltaUp} />
            <Text style={styles.deleteText}>Delete group</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
};

const createStyles = (COLORS: ColorPalette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.paper },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: SIZES.padding,
      paddingTop: SIZES.padding * 2.5,
      paddingBottom: SIZES.base,
    },
    headerBtn: { padding: 4, minWidth: 32, alignItems: "center" },
    headerTitle: { ...FONTS.h3, fontFamily: FONT.bold, color: COLORS.ink },
    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: SIZES.base + 2,
      marginVertical: SIZES.padding,
      paddingHorizontal: 4,
    },
    nameInput: {
      flex: 1,
      ...FONTS.h3,
      color: COLORS.ink,
      paddingVertical: SIZES.base,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: COLORS.hairline + "80",
    },
    sectionLabel: {
      ...FONTS.caption,
      color: COLORS.inkMuted,
      letterSpacing: 0.8,
      textTransform: "uppercase",
      marginBottom: SIZES.base,
    },
    chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: SIZES.base, marginBottom: SIZES.padding },
    memberChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: COLORS.surface1,
      borderRadius: 18,
      paddingLeft: 4,
      paddingRight: 10,
      paddingVertical: 4,
      maxWidth: 180,
    },
    memberChipMe: { paddingRight: 12 },
    memberChipText: { ...FONTS.body4, color: COLORS.ink, fontFamily: FONT.medium, flexShrink: 1 },
    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: SIZES.base,
      backgroundColor: COLORS.surface1,
      borderRadius: 10,
      paddingHorizontal: SIZES.base + 2,
      marginBottom: SIZES.base,
    },
    searchInput: { flex: 1, ...FONTS.body3, color: COLORS.ink, paddingVertical: SIZES.base },
    personRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: SIZES.base,
    },
    personName: { ...FONTS.body3, color: COLORS.ink, fontFamily: FONT.medium },
    personSub: { ...FONTS.caption, color: COLORS.inkMuted },
    errorText: { ...FONTS.body4, color: COLORS.deltaUp, marginTop: SIZES.padding },
    deleteBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      marginTop: SIZES.padding * 2,
      paddingVertical: SIZES.base + 4,
    },
    deleteText: { ...FONTS.body3, color: COLORS.deltaUp, fontFamily: FONT.medium },
  });

export default CreateGroupScreen;
