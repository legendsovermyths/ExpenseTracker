import React, { useCallback, useState, useRef } from "react";
import { StyleSheet, View } from "react-native";
import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from "@react-navigation/native";
import { SPACE } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import { useExpensifyStore } from "../store/store";
import { fetchGroupDetail } from "../services/Groups";
import { syncSplitsNow } from "../services/BackgroundSync";
import {
  Amount,
  Avatar,
  BottomBar,
  Button,
  EmptyState,
  GlyphPlate,
  HeaderIconButton,
  ListRow,
  Page,
  PageList,
  SectionLabel,
  SkeletonList,
  Text,
  Tone,
  formatMoney,
  FeedbackRow,
  DeltaChip,
  useListChangeAnimation,
} from "../components/ui";
import { GroupDetail, GroupExpense } from "../types/entity/Group";

const toneFor = (cents: number): Tone =>
  Math.abs(cents) <= 1 ? "muted" : cents > 0 ? "down" : "up";

const GroupDetailScreen: React.FC = () => {
  const { COLORS } = useTheme();
  const navigation: any = useNavigation();
  const route = useRoute<any>();
  const { grpId } = route.params as { grpId: string };
  const me = useExpensifyStore((s) => s.getUserId());
  const transactionsById = useExpensifyStore((s) => s.transactions);
  const categoriesById = useExpensifyStore((s) => s.categories);
  const cachedName = useExpensifyStore((s) => s.groups[grpId]?.group.name);

  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      setDetail(await fetchGroupDetail(grpId, me));
    } catch (e) {
      console.warn("fetchGroupDetail failed", e);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      await syncSplitsNow();
    } catch {
      // offline — show local data
    }
    await load();
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [grpId]),
  );

  const settings = (
    <HeaderIconButton
      icon="cog-outline"
      label="Group settings"
      tone="ink"
      onPress={() => navigation.navigate("CreateGroupScreen", { grpId })}
    />
  );

  const expensesListRef = useRef<any>(null);
  useListChangeAnimation(
    detail?.expenses.map((e) => e.entry_id) ?? [],
    expensesListRef,
  );

  if (!detail) {
    return (
      <Page title={cachedName || "Group"} right={settings}>
        <SkeletonList rows={6} />
      </Page>
    );
  }

  const nameOf = (id: string) =>
    id === me
      ? "You"
      : detail.members.find((m) => m.user_id === id)?.user_name || "Someone";

  const net = detail.my_net_cents;
  const settled = Math.abs(net) <= 1;

  const renderExpense = ({ item }: { item: GroupExpense }) => {
    const txn = item.transaction_id
      ? transactionsById[String(item.transaction_id)]
      : null;
    const category = txn
      ? categoriesById[String(txn.subcategory_id || txn.category_id)]
      : null;
    const plateColor =
      COLORS.ordinal[
        Math.abs(item.entry_id.charCodeAt(0)) % COLORS.ordinal.length
      ];
    const payers = item.payer_ids.map(nameOf);
    const paidBy =
      payers.length === 0
        ? ""
        : payers.length === 1
          ? `${payers[0]} paid`
          : `${payers.length} people paid`;
    const mine = item.my_net_cents;
    const isPayment = item.kind === "PAYMENT";
    const mineLabel =
      mine === 0 ? "not involved" : mine > 0 ? "you lent" : "you borrowed";
    const mineTone: Tone = mine === 0 ? "muted" : mine > 0 ? "down" : "up";
    const subtitle = [
      new Date(item.created_at).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
      }),
      paidBy ? `${paidBy} ${formatMoney(item.total_cents)}` : null,
      item.is_dirty ? "Pending" : null,
    ]
      .filter(Boolean)
      .join("  ·  ");

    return (
      <FeedbackRow kind="groupExpense" id={item.entry_id}>
        <ListRow
          padded={false}
          style={styles.gutter}
          leading={
            <GlyphPlate
              name={
                isPayment
                  ? "swap-horizontal"
                  : category
                    ? category.icon_name
                    : "receipt"
              }
              type={
                category && !isPayment
                  ? category.icon_type
                  : "material-community"
              }
              color={plateColor}
              size={36}
              radius={10}
            />
          }
          title={item.description || (isPayment ? "Payment" : "Expense")}
          subtitle={subtitle}
          trailing={
            <View style={styles.trailing}>
              <Text variant="caption" tone={mineTone}>
                {mineLabel}
              </Text>
              {mine !== 0 && <Amount cents={Math.abs(mine)} tone={mineTone} />}
            </View>
          }
          onPress={() =>
            navigation.navigate("GroupExpenseSummary", {
              entryId: item.entry_id,
              grpId,
            })
          }
        />
      </FeedbackRow>
    );
  };

  const header = (
    <View style={styles.gutter}>
      <View style={styles.net}>
        {settled ? (
          <Text variant="title" tone="muted">
            You're all settled up
          </Text>
        ) : (
          <>
            <Text variant="body" tone="muted">
              {net > 0 ? "You're owed" : "You owe"}
            </Text>
            <View style={styles.netRow}>
              <Amount
                cents={Math.abs(net)}
                variant="amountLarge"
                tone={toneFor(net)}
                animated
              />
              <DeltaChip totalKey={`group:${grpId}`} positiveIsGood />
            </View>
          </>
        )}
      </View>

      {detail.member_balances.length > 0 && (
        <>
          <SectionLabel title="Balances" />
          {detail.member_balances.map((b) => {
            const n = nameOf(b.user_id);
            const zero = Math.abs(b.net_cents) <= 1;
            return (
              <ListRow
                key={b.user_id}
                padded={false}
                dense
                leading={<Avatar name={n} size={32} />}
                title={n}
                trailing={
                  zero ? (
                    <Text variant="callout" tone="muted">
                      settled
                    </Text>
                  ) : (
                    <View style={styles.trailing}>
                      <Text variant="caption" tone={toneFor(b.net_cents)}>
                        {b.net_cents > 0 ? "owes you" : "you owe"}
                      </Text>
                      <Amount
                        cents={Math.abs(b.net_cents)}
                        tone={toneFor(b.net_cents)}
                      />
                    </View>
                  )
                }
                onPress={() =>
                  navigation.navigate("FriendLedgerScreen", {
                    friendId: b.user_id,
                    friendName: n,
                  })
                }
              />
            );
          })}
        </>
      )}

      <SectionLabel title="Expenses" />
    </View>
  );

  return (
    <PageList
      listRef={expensesListRef}
      title={detail.group.name}
      subtitle={`${detail.members.length} members  ·  ${formatMoney(detail.total_spent_cents)} spent`}
      right={settings}
      header={header}
      data={detail.expenses}
      keyExtractor={(e) => e.entry_id}
      renderItem={renderExpense}
      estimatedItemSize={64}
      ListEmptyComponent={
        <EmptyState
          icon="receipt"
          title="No expenses yet"
          message="Add the first shared expense and everyone's balance updates."
        />
      }
      refreshing={refreshing}
      onRefresh={refresh}
      footer={
        <BottomBar>
          <Button
            title="Add expense"
            icon="plus"
            onPress={() => navigation.navigate("AddGroupExpense", { grpId })}
          />
        </BottomBar>
      }
    />
  );
};

const styles = StyleSheet.create({
  netRow: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  gutter: { paddingHorizontal: SPACE.gutter },
  net: { paddingTop: SPACE.lg, gap: SPACE.xs },
  trailing: { alignItems: "flex-end", gap: 2 },
});

export default GroupDetailScreen;
