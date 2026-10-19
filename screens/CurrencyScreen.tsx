import React, { useCallback, useMemo, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import { SPACE } from "../constants";
import {
  CURRENCIES,
  CURRENCY_CONSTANT_KEY,
  Currency,
  useCurrency,
} from "../constants/currency";
import { useTheme } from "../contexts/ThemeContext";
import { useExpensifyStore } from "../store/store";
import { addAppconstant, updateAppconstant } from "../services/Appconstants";
import { matchesSearch } from "../services/Search";
import { EmptyState, Icon, ListRow, PageList, SearchField, haptic, toast } from "../components/ui";

export default function CurrencyScreen() {
  const { COLORS } = useTheme();
  const active = useCurrency();
  const constant = useExpensifyStore((s) => s.getAppconstantByKey(CURRENCY_CONSTANT_KEY));
  const updateInStore = useExpensifyStore((s) => s.updateAppconstant);
  const addToStore = useExpensifyStore((s) => s.addAppconstant);
  const [query, setQuery] = useState("");
  const saving = useRef(false);

  const results = useMemo(
    () => CURRENCIES.filter((c) => matchesSearch(query, c.name, c.code, c.symbol)),
    [query],
  );

  const select = useCallback(
    async (currency: Currency) => {
      if (currency.code === active.code || saving.current) return;
      haptic("selection");
      saving.current = true;
      try {
        if (constant) {
          const updated = { ...constant, value: currency.code };
          updateInStore(updated);
          try {
            await updateAppconstant(updated);
          } catch (err) {
            updateInStore(constant);
            throw err;
          }
        } else {
          // Databases created by an SDK build without the `currency` default.
          const created = await addAppconstant({
            key: CURRENCY_CONSTANT_KEY,
            value: currency.code,
          });
          addToStore(created);
        }
      } catch (err: any) {
        toast(err?.message || "Couldn't change currency", "error");
      } finally {
        saving.current = false;
      }
    },
    [constant, active.code, updateInStore, addToStore],
  );

  return (
    <PageList
      title="Currency"
      subtitle="Only the symbol changes. Amounts aren't converted."
      header={
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Search currencies"
          autoCorrect={false}
          style={styles.search}
        />
      }
      data={results}
      extraData={active.code}
      keyExtractor={(c: Currency) => c.code}
      estimatedItemSize={64}
      ListEmptyComponent={<EmptyState icon="magnify" title="No matching currency" />}
      renderItem={({ item }: { item: Currency }) => (
        <ListRow
          padded={false}
          style={styles.gutter}
          title={item.name}
          subtitle={`${item.code} · ${item.symbol.trim()}`}
          trailing={
            item.code === active.code ? (
              <Icon name="check-circle" size="md" color={COLORS.accent} />
            ) : undefined
          }
          onPress={() => select(item)}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  search: { marginHorizontal: SPACE.gutter, marginTop: SPACE.sm, marginBottom: SPACE.xs },
  gutter: { paddingHorizontal: SPACE.gutter },
});
