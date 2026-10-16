import React, { useMemo, useRef, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { SPACE, TYPE } from "../constants";
import { useExpensifyStore } from "../store/store";
import { updateAppconstant } from "../services/Appconstants";
import { useTheme } from "../contexts/ThemeContext";
import { formatAmountWithCommas } from "../services/Utils";
import { Form, FormRef, Text, toast } from "../components/ui";

const BalanceEditScreen: React.FC = () => {
  const { COLORS } = useTheme();
  const form = useRef<FormRef>(null);
  const appconstant = useExpensifyStore((state) => state.getAppconstantByKey("balance"));
  const updateAppConstantUI = useExpensifyStore((state) => state.updateAppconstant);

  const initial = String(appconstant?.value ?? "0");
  const [budget, setBudget] = useState(initial === "0" ? "" : initial);
  const [saving, setSaving] = useState(false);

  const value = parseInt(budget || "0", 10) || 0;
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dirty = budget !== (initial === "0" ? "" : initial);
  const perDay = useMemo(() => (value > 0 ? value / daysInMonth : 0), [value, daysInMonth]);

  const save = async () => {
    if (!appconstant || saving) return;
    setSaving(true);
    try {
      const updated = { id: appconstant.id, key: appconstant.key, value: String(value) };
      await updateAppconstant(updated);
      updateAppConstantUI(updated);
      toast("Monthly budget updated");
      form.current?.close();
    } catch {
      toast("Couldn't save the budget", "error");
      setSaving(false);
    }
  };

  return (
    <Form ref={form} title="Monthly budget" onSave={save} canSave={dirty} saving={saving} dirty={dirty}>
      <Text variant="callout" tone="muted" style={styles.lead}>
        How much do you want to spend each month? The dashboard tracks your pace against it.
      </Text>

      <View style={styles.amountRow}>
        <Text variant="amountLarge" tone="subtle" style={styles.currency}>
          ₹
        </Text>
        <TextInput
          value={budget}
          onChangeText={(t) => setBudget(t.replace(/[^0-9]/g, "").slice(0, 9))}
          placeholder="0"
          placeholderTextColor={COLORS.inkSubtle}
          keyboardType="number-pad"
          autoFocus
          selectionColor={COLORS.accent}
          style={[TYPE.display, styles.input, { color: COLORS.ink }]}
          accessibilityLabel="Monthly budget"
        />
      </View>

      <Text variant="callout" tone="muted">
        {value > 0 ? `About ₹${formatAmountWithCommas(perDay, false)} a day this month` : "Set to 0 to turn the budget off"}
      </Text>
    </Form>
  );
};

const styles = StyleSheet.create({
  lead: { marginTop: SPACE.sm, marginBottom: SPACE.xl },
  amountRow: { flexDirection: "row", alignItems: "center", gap: SPACE.xs, marginBottom: SPACE.sm },
  currency: { marginTop: 4 },
  input: { flex: 1, padding: 0, margin: 0 },
});

export default BalanceEditScreen;
