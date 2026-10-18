import React, { useEffect, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import uuid from "react-native-uuid";
import { SPACE } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import { useExpensifyStore } from "../store/store";
import { useFriendList } from "../services/FriendService";
import { matchesSearch } from "../services/Search";
import {
  deleteGroup,
  fetchGroupDetail,
  fetchGroups,
  upsertGroup,
} from "../services/Groups";
import { syncSplitsNow } from "../services/BackgroundSync";
import {
  Avatar,
  Button,
  Field,
  Form,
  FormRef,
  Icon,
  ListRow,
  RowGroup,
  SearchField,
  SectionLabel,
  Text,
  confirm,
  toast,
  haptic,
  hapticRhythm,
} from "../components/ui";
import { GroupMember } from "../types/entity/Group";
import { markChanged } from "../services/Feedback";

interface Person {
  id: string;
  name: string;
}

const now = () => new Date().toISOString();
const AVATAR_INSET = SPACE.lg + 34 + SPACE.md;

// Create a group, or (with `grpId`) rename it / add / remove members.
const CreateGroupScreen: React.FC = () => {
  const { COLORS } = useTheme();
  const form = useRef<FormRef>(null);
  const navigation: any = useNavigation();
  const route = useRoute<any>();
  const grpId: string | undefined = route.params?.grpId;
  const isEdit = !!grpId;

  const me = useExpensifyStore((s) => s.getUserId());
  const friends = useFriendList();
  const setGroupsInUI = useExpensifyStore((s) => s.setGroups);

  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Person[]>([]);
  // Existing members (edit mode) — removing them is a soft delete, and only
  // allowed when they're settled within the group.
  const [existing, setExisting] = useState<GroupMember[]>([]);
  const [groupBalances, setGroupBalances] = useState<Record<string, number>>(
    {},
  );
  const [createdBy, setCreatedBy] = useState<string>(me);
  const [createdAt, setCreatedAt] = useState<string>(now());
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  // Snapshot of the loaded name + members, so `dirty` reflects real edits.
  const [initial, setInitial] = useState<string>(JSON.stringify(["", []]));
  // Set after a save/delete: clears `dirty` for one render, then navigates
  // (replace/pop would otherwise trip the form's discard guard).
  const [exit, setExit] = useState<(() => void) | null>(null);

  useEffect(() => {
    if (!grpId) return;
    (async () => {
      const d = await fetchGroupDetail(grpId, me);
      if (!d) return;
      const others = d.members
        .filter((m) => m.user_id !== me)
        .map((m) => ({ id: m.user_id, name: m.user_name || "Unknown" }));
      setName(d.group.name);
      setCreatedBy(d.group.created_by);
      setCreatedAt(d.group.created_at);
      setExisting(d.members);
      setSelected(others);
      setInitial(JSON.stringify([d.group.name, others.map((p) => p.id)]));
      const b: Record<string, number> = {};
      d.member_balances.forEach((mb) => (b[mb.user_id] = mb.net_cents));
      setGroupBalances(b);
    })();
  }, [grpId]);

  useEffect(() => {
    exit?.();
  }, [exit]);

  const selectedIds = new Set(selected.map((p) => p.id));
  const dirty =
    !exit && JSON.stringify([name, selected.map((p) => p.id)]) !== initial;

  // People are only ever added by QR, so the picker is your friend list.
  const q = query.trim().toLowerCase();
  const friendOptions: Person[] = friends
    .filter((f) => !selectedIds.has(f.id))
    .filter((f) => !q || matchesSearch(q, f.name))
    .map((f) => ({ id: f.id, name: f.name }));

  const add = (p: Person) => {
    if (selectedIds.has(p.id)) return;
    setSelected((prev) => [...prev, p]);
    setQuery("");
  };

  const remove = (p: Person) => {
    const bal = groupBalances[p.id] ?? 0;
    if (Math.abs(bal) > 1) {
      toast(`${p.name} isn't settled up in this group yet`, "error");
      return;
    }
    setSelected((prev) => prev.filter((x) => x.id !== p.id));
  };

  const save = async () => {
    if (!name.trim()) {
      toast("Give the group a name", "error");
      return;
    }
    if (selected.length === 0) {
      toast("Add at least one person", "error");
      return;
    }
    setSaving(true);
    try {
      const id = grpId ?? (uuid.v4() as string);
      const ts = now();
      const existingById = new Map(existing.map((m) => [m.user_id, m]));
      const members: GroupMember[] = [];
      const memberFor = (
        userId: string,
        userName: string | null,
      ): GroupMember => ({
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
        .forEach((m) =>
          members.push({ ...m, updated_at: ts, is_deleted: true }),
        );

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
      markChanged("group", [id], isEdit ? "edited" : "added");
      hapticRhythm("saveLanded");
      if (isEdit) form.current?.close();
      else
        setExit(() => () => navigation.replace("GroupDetail", { grpId: id }));
    } catch (e: any) {
      toast(e?.message ?? "Couldn't save the group", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const unsettled = Object.values(groupBalances).some((v) => Math.abs(v) > 1);
    const ok = await confirm({
      title: "Delete this group?",
      message: unsettled
        ? "It still has unsettled balances. Its expenses will stay in each friend's ledger."
        : "Its expenses will stay in each friend's ledger.",
    });
    if (!ok) return;
    try {
      await deleteGroup(grpId!);
      setGroupsInUI(await fetchGroups(me));
      syncSplitsNow().catch(() => {});
      haptic("light");
      setExit(() => () => navigation.pop(2));
    } catch {
      toast("Couldn't delete the group", "error");
    }
  };

  const addIcon = (
    <Icon name="plus-circle-outline" size="lg" color={COLORS.accent} />
  );

  return (
    <Form
      ref={form}
      title={isEdit ? "Edit group" : "New group"}
      onSave={save}
      canSave={dirty}
      saving={saving}
      dirty={dirty}
    >
      <RowGroup>
        <Field
          icon="account-group-outline"
          placeholder="Group name (e.g. Goa trip)"
          value={name}
          onChangeText={setName}
          autoFocus={!isEdit}
          returnKeyType="done"
        />
      </RowGroup>

      <SectionLabel title={`Members  ·  ${selected.length + 1}`} />
      <RowGroup inset={AVATAR_INSET}>
        <ListRow leading={<Avatar name="You" size={34} />} title="You" />
        {selected.map((p) => (
          <ListRow
            key={p.id}
            leading={<Avatar name={p.name} size={34} />}
            title={p.name}
            trailing={
              <Icon name="close-circle" size="md" color={COLORS.inkSubtle} />
            }
            onPress={() => remove(p)}
          />
        ))}
      </RowGroup>

      <SectionLabel title="Add friends" />
      {friends.length > 0 && (
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Search your friends"
          style={styles.search}
        />
      )}
      {friendOptions.map((f) => (
        <ListRow
          key={f.id}
          padded={false}
          leading={<Avatar name={f.name} size={34} />}
          title={f.name}
          trailing={addIcon}
          onPress={() => add(f)}
        />
      ))}
      {q && friendOptions.length === 0 && (
        <Text variant="callout" tone="muted" style={styles.searching}>
          No friends match "{query.trim()}"
        </Text>
      )}
      <ListRow
        padded={false}
        icon="qrcode-scan"
        title="Add a friend by QR code"
        onPress={() => navigation.navigate("ScanFriendQR")}
      />

      {isEdit && (
        <Button
          title="Delete group"
          variant="destructive"
          onPress={handleDelete}
          style={styles.delete}
        />
      )}
    </Form>
  );
};

const styles = StyleSheet.create({
  search: { marginBottom: SPACE.sm },
  searching: { paddingVertical: SPACE.sm },
  delete: { marginTop: SPACE.xxl },
});

export default CreateGroupScreen;
