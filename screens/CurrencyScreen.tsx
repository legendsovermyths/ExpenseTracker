import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { SPACE } from "../constants";
import {
  CURRENCIES,
  CURRENCY_CONSTANT_KEY,
  Currency,
  useCurrency,
} from "../constants/currency";
import { useTheme } from "../contexts/ThemeContext";
import { useExpensifyStore } from "../store/store";
import { updateAppconstant } from "../services/Appconstants";
import { matchesSearch } from "../services/Search";
import {
  EmptyState,
  Icon,
  ListRow,
  Page,
  RowGroup,
  SearchField,
  SectionLabel,
  Text,
  haptic,
  toast,
} from "../components/ui";

const PLATE = 34;
const ICON_INSET = SPACE.lg + PLATE + SPACE.md;

const SymbolPlate = ({ symbol }: { symbol: string }) => {
  const { COLORS } = useTheme();
  const glyph = symbol.trim();
  return (
    <View style={[styles.plate, { backgroundColor: COLORS.accentSoft }]}>
      <Text
        variant={glyph.length > 2 ? "caption" : "headline"}
        tone="accent"
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {glyph}
      </Text>
    </View>
  );
};

export default function CurrencyScreen() {
  const { COLORS } = useTheme();
  const active = useCurrency();
  const constant = useExpensifyStore((s) => s.getAppconstantByKey(CURRENCY_CONSTANT_KEY));
  const updateInStore = useExpensifyStore((s) => s.updateAppconstant);
  const [query, setQuery] = useState("");

  const results = useMemo(
    () => CURRENCIES.filter((c) => matchesSearch(query, c.name, c.code, c.symbol)),
    [query],
  );

  const select = useCallback(
    async (currency: Currency) => {
      if (!constant || currency.code === active.code) return;
      haptic("selection");
      const previous = constant;
      const updated = { ...constant, value: currency.code };
      updateInStore(updated);
      try {
        await updateAppconstant(updated);
      } catch (err: any) {
        updateInStore(previous);
        toast(err?.message || "Couldn't change currency", "error");
      }
    },
    [constant, active.code, updateInStore],
  );

  return (
    <Page title="Currency" subtitle="Amounts across the app use this symbol">
      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder="Search currencies"
        autoCorrect={false}
        style={styles.search}
      />
      <SectionLabel title={query ? "Results" : "All currencies"} />
      {results.length === 0 ? (
        <EmptyState icon="currency-usd-off" title="No matching currency" />
      ) : (
        <RowGroup inset={ICON_INSET}>
          {results.map((c) => {
            const selected = c.code === active.code;
            return (
              <ListRow
                key={c.code}
                leading={<SymbolPlate symbol={c.symbol} />}
                title={c.name}
                subtitle={c.code}
                trailing={
                  selected ? <Icon name="check-circle" size="md" color={COLORS.accent} /> : undefined
                }
                onPress={() => select(c)}
              />
            );
          })}
        </RowGroup>
      )}
      <Text variant="caption" tone="subtle" style={styles.note}>
        Changing currency only changes the symbol shown. Saved amounts are not converted.
      </Text>
    </Page>
  );
}

const styles = StyleSheet.create({
  search: { marginBottom: SPACE.sm },
  plate: {
    width: PLATE,
    height: PLATE,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  note: { marginTop: SPACE.lg, paddingHorizontal: SPACE.xs },
});
