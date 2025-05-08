import React, { useState } from "react";
import { View, StyleSheet, Text, TextInput } from "react-native";
import { Button, Provider } from "react-native-paper";
import { useNavigation, useRoute } from "@react-navigation/native";
import { supabase } from "../services/Supabase";
import { COLORS, FONTS, SIZES } from "../constants";
import HeaderText from "../components/HeaderText";

interface Params {
  payerId: string;
  payerName: string;
  payeeId: string;
  payeeName: string;
  amountCents: number;
}

const SettleScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { payerId, payerName, payeeId, payeeName, amountCents } =
    route.params as Params;

  const [amount, setAmount] = useState<string>((amountCents / 100).toString());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, "");
    setAmount(cleaned);
  };

  const handleSettle = async () => {
    const amtNum = Number(amount);
    if (!amtNum || amtNum <= 0) {
      setError("Enter a valid amount");
      return;
    }
    setLoading(true);
    try {
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser();
      if (authErr || !user) throw authErr || new Error("Not authenticated");
      const meId = user.id;

      const cents = Math.round(amtNum * 100);
      // create entry with created_by = meId so RLS passes
      const { data: entry, error: entryErr } = await supabase
        .from("ledger_entry")
        .insert({
          kind: "PAYMENT",
          description: "Settle Up",
          created_by: meId,
          total_cents: cents,
        })
        .select("id")
        .single();
      if (entryErr) throw entryErr;
      const entryId = entry.id as string;

      const { error: liErr } = await supabase.from("line_item").insert([
        {
          entry_id: entryId,
          user_id: payeeId,
          amount_cents: -cents,
          paid_cents: 0,
          owed_cents: cents,
        },
        {
          entry_id: entryId,
          user_id: payerId,
          amount_cents: cents,
          paid_cents: cents,
          owed_cents: 0,
        },
      ]);
      if (liErr) throw liErr;
      navigation.goBack();
    } catch (e: any) {
      setError(e.message || "Failed to settle");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Provider>
      <View style={styles.wrapper}>
        <View>
          <HeaderText text="Record Payment" />
        </View>
        <View style={styles.directionRow}>
          <Text style={styles.personText}>{payerName}</Text>
          <Text style={styles.arrow}>➜</Text>
          <Text style={styles.personText}>{payeeName}</Text>
        </View>

        <TextInput
          style={styles.amountInput}
          keyboardType="numeric"
          value={amount}
          onChangeText={handleChange}
          placeholder="0"
          placeholderTextColor={COLORS.darkgray}
        />
        {error && <Text style={styles.error}>{error}</Text>}

        <Button
          mode="contained"
          buttonColor={COLORS.primary}
          textColor={COLORS.white}
          style={styles.settleButton}
          labelStyle={{ ...FONTS.h3 }}
          loading={loading}
          onPress={handleSettle}
        >
          Settle Up
        </Button>
      </View>
    </Provider>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: COLORS.white,
    paddingTop: (SIZES.padding * 5) / 2,
    paddingHorizontal: SIZES.padding,
  },
  directionRow: {
    marginTop: SIZES.padding * 4,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginVertical: SIZES.padding,
  },
  personText: { ...FONTS.h2, color: COLORS.primary },
  arrow: { ...FONTS.h2, color: COLORS.darkgray, marginHorizontal: 8 },
  amountInput: {
    alignSelf: "center",
    borderBottomWidth: 2,
    borderColor: COLORS.primary,
    width: "60%",
    textAlign: "center",
    ...FONTS.h1,
    color: COLORS.primary,
    marginVertical: SIZES.padding,
  },
  settleButton: {
    marginTop: SIZES.padding,
    marginHorizontal: SIZES.padding * 2,
    borderRadius: 30,
  },
  error: { color: COLORS.red, textAlign: "center", marginTop: 4 },
});

export default SettleScreen;
