import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Keyboard,
  Text,
  TouchableOpacity,
} from "react-native";
import { Button, Provider, Menu, DefaultTheme } from "react-native-paper";
import { useNavigation, useRoute } from "@react-navigation/native";

import { COLORS, SIZES } from "../constants";
import HeaderNavigator from "../components/HeaderNavigator";
import HeaderText from "../components/HeaderText";
import AmountInput from "../components/AmountInput";
import DescriptionInput from "../components/DescriptionInput";
import PopupMenu from "../components/PopupMenu";
import {
  CustomKeyboard,
  useCustomKeyboard,
} from "../components/CustomKeyboard";
import { supabase } from "../services/Supabase";
const menuTheme = {
  ...DefaultTheme,
  roundness: 20,
  colors: {
    ...DefaultTheme.colors,
    elevation: {
      ...DefaultTheme.colors.elevation,
      level2: COLORS.white,
    },
  },
};
export type SplitType =
  | "ME_PAY_EQUAL"
  | "OTHER_PAY_EQUAL"
  | "ME_OWE_ALL"
  | "OTHER_OWE_ALL";
const SPLIT_OPTIONS = (
  userName: string,
): { key: string; title: string; value: string }[] => [
    {
      key: "me_split_equal",
      title: "Paid by me, split equally",
      value: "ME_PAY_EQUAL",
    },
    {
      key: "other_split_equal",
      title: `Paid by ${userName}, split equally`,
      value: "OTHER_PAY_EQUAL",
    },
    {
      key: "other_owes_all",
      title: `${userName} owes the entire amount`,
      value: "OTHER_OWES_ALL",
    },
    {
      key: "me_owe_all",
      title: "I owe the entire amount",
      value: "ME_OWE_ALL",
    },
  ];

const SplitInputScreen: React.FC = () => {
  const route = useRoute<any>();
  const { userId: otherUserId, userName } = route.params as {
    userId: string;
    userName: string;
  };
  const navigation = useNavigation();

  const { onKeyPress, evaluateExpression } = useCustomKeyboard("0");
  const [description, setDescription] = useState<String>("");
  const [amount, setAmount] = useState<string>("0");
  const [activePopup, setActivePopup] = useState<string | null>(null);
  const [selectedSplitType, setSelectedSplitType] =
    useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isPopupActive = (popup: string) => activePopup === popup;
  const handlePopupChange = (popup: string) => {
    const result = evaluateExpression();
    setAmount(result);
    setActivePopup(popup);
  };

  const addSplit = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser();
      if (authErr || !user) throw authErr || new Error("Not authenticated");
      const me = user.id;

      const amt = Number(amount);
      if (!amt || isNaN(amt)) throw new Error("Invalid amount");

      // 2. insert ledger_entry
      const { data: entryData, error: entryErr } = await supabase
        .from("ledger_entry")
        .insert({
          kind: "SPLIT",
          description,
          created_by: me,
        })
        .select("id")
        .single();
      console.log(entryErr);
      if (entryErr) throw entryErr;
      const entryId = entryData.id as string;

      // 3. build line_item rows (2‑person split only for now)
      let lineItems: {
        entry_id: string;
        user_id: string;
        amount_cents: number;
      }[] = [];
      const cents = Math.round(amt * 100);
      switch (selectedSplitType) {
        case "ME_PAY_EQUAL": {
          const each = cents / 2;
          lineItems = [
            { entry_id: entryId, user_id: me, amount_cents: cents - each }, // creditor
            { entry_id: entryId, user_id: otherUserId, amount_cents: -each },
          ];
          break;
        }
        case "OTHER_PAY_EQUAL": {
          const each = cents / 2;
          lineItems = [
            {
              entry_id: entryId,
              user_id: otherUserId,
              amount_cents: cents - each,
            },
            { entry_id: entryId, user_id: me, amount_cents: -each },
          ];
          break;
        }
        case "ME_OWE_ALL": {
          lineItems = [
            { entry_id: entryId, user_id: otherUserId, amount_cents: cents },
            { entry_id: entryId, user_id: me, amount_cents: -cents },
          ];
          break;
        }
        case "OTHER_OWE_ALL": {
          lineItems = [
            { entry_id: entryId, user_id: me, amount_cents: cents },
            { entry_id: entryId, user_id: otherUserId, amount_cents: -cents },
          ];
          break;
        }
      }

      const { error: liErr } = await supabase
        .from("line_item")
        .insert(lineItems);
      console.log(liErr);
      if (liErr) throw liErr;
      return entryId;
    } finally {
      setLoading(false);
    }
  };

  return (
    <Provider>
      <View style={styles.wrapper}>
        <View style={styles.headerContainer}>
          <HeaderNavigator
            onBackPress={() => navigation.goBack()}
            onTickPress={addSplit}
          />
          <HeaderText text={`Split with ${userName}`} />
        </View>
        <View style={styles.container}>
          <DescriptionInput
            label="Description"
            value={description}
            onFocus={() => handlePopupChange("None")}
            onChangeValue={(value) => setDescription(value)}
          />
          <AmountInput
            keyboardVisible={isPopupActive("customKeyboard")}
            setKeyboardVisible={() => handlePopupChange("customKeyboard")}
            value={amount}
            setValue={setAmount}
          />
          <TouchableOpacity onPress={() => handlePopupChange("splitMenu")}>
            <Menu
              visible={isPopupActive("splitMenu")}
              onDismiss={() => handlePopupChange("None")}
              theme={menuTheme}
              anchor={
                <Button
                  onPress={() => {
                    handlePopupChange("splitMenu");
                  }}
                  style={styles.menuButtonStyle}
                  textColor="black"
                >
                  {SPLIT_OPTIONS(userName).find(
                    (o) => o.value === selectedSplitType,
                  )?.title || "Select Split Type"}
                </Button>
              }
              style={styles.menuStyle}
            >
              {SPLIT_OPTIONS(userName).map((item: any) => (
                <Menu.Item
                  key={item.key}
                  onPress={() => {
                    setSelectedSplitType(item.value);
                    handlePopupChange("None");
                  }}
                  title={item.title}
                />
              ))}
            </Menu>
          </TouchableOpacity>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Button
            mode="contained"
            onPress={addSplit}
            style={styles.addButton}
            loading={loading}
          >
            Add Split
          </Button>
        </View>
        {isPopupActive("customKeyboard") && (
          <View style={styles.modalContent}>
            <CustomKeyboard
              onKeyPress={(key) => {
                if (key === "Done") handlePopupChange("None");
                const result: any = onKeyPress(key);
                setAmount(result);
              }}
            />
          </View>
        )}
      </View>
    </Provider>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: COLORS.white,
    paddingTop: SIZES.padding,
  },
  headerContainer: {
    paddingHorizontal: SIZES.padding,
    paddingTop: (4 * SIZES.padding) / 3,
    backgroundColor: COLORS.white,
  },
  container: {
    flex: 1,
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding,
    backgroundColor: COLORS.white,
  },
  addButton: {
    marginTop: 20,
    backgroundColor: COLORS.primary,
    borderRadius: 20,
  },
  modalContent: {
    width: "100%",
    backgroundColor: COLORS.white,
  },
  errorText: {
    color: COLORS.red,
    marginLeft: 10,
  },
  menuStyle: {
    width: 300,
  },
  menuButtonStyle: {
    borderColor: COLORS.primary,
    borderRadius: 30,
    borderWidth: 1,
    backgroundColor: COLORS.white,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 15,
  },
});

export default SplitInputScreen;
