import React, { useRef, useState } from "react";
import { Keyboard, StyleSheet, Switch, View, useWindowDimensions } from "react-native";
import { IconPicker } from "@grassper/react-native-icon-picker";
import { useRoute } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import uuid from "react-native-uuid";
import { RADIUS, SPACE, TYPE } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import { useExpensifyStore } from "../store/store";
import { upsertFund, deleteFund } from "../services/Funds";
import { CustomKeyboard, useCustomKeyboard } from "../components/CustomKeyboard";
import FundPartnerPicker, { FundPartnerPickerRef } from "../components/FundPartnerPicker";
import {
  Avatar,
  Button,
  Field,
  Form,
  FormRef,
  GlyphPlate,
  ListRow,
  Pressable,
  RowGroup,
  Sheet,
  SheetRef,
  Text,
  confirm,
  formatMoney,
  toast,
} from "../components/ui";
import { Fund } from "../types/entity/Fund";

// Same package->iconset key mapping the icon picker's callback needs —
// kept in sync with CategoryInputScreen.tsx's copy rather than shared,
// matching how that screen already keeps this local to itself.
const packageToIconsetMapping: Record<string, string> = {
  AntDesign: "antdesign",
  Entypo: "entypo",
  EvilIcons: "evilicon",
  Feather: "feather",
  FontAwesome: "font-awesome",
  FontAwesome5: "font-awesome-5",
  Fontisto: "fontisto",
  Foundation: "foundation",
  Ionicons: "ionicon",
  MaterialCommunityIcons: "material-community",
  MaterialIcons: "material",
  Octicons: "octicon",
  SimpleLineIcons: "simple-line-icon",
  Zocial: "zocial",
};

const formatDate = (d: Date) => {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

const ICON_INSET = SPACE.lg + 34 + SPACE.md;

const CreateFundScreen: React.FC = () => {
  const { COLORS, isDark } = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const form = useRef<FormRef>(null);
  const route = useRoute<any>();

  const fundId: string | undefined = route.params?.fundId;
  const existingFund = useExpensifyStore((s) => (fundId ? s.funds[fundId] : undefined));
  const isEditing = Boolean(existingFund);

  const userId = useExpensifyStore((s) => s.getUserId());
  const mergeFundsInUI = useExpensifyStore((s) => s.mergeFunds);
  const removeFundLocal = useExpensifyStore((s) => s.removeFundLocal);
  const userBalancesById = useExpensifyStore((s) => s.userbalances);

  const iconSheetRef = useRef<SheetRef>(null);
  const partnerPickerRef = useRef<FundPartnerPickerRef>(null);

  const [name, setName] = useState(existingFund?.name ?? "");
  const [selectedIcon, setSelectedIcon] = useState(
    existingFund?.icon_name
      ? { name: existingFund.icon_name, type: existingFund.icon_type ?? "material-community" }
      : { name: "piggy-bank-outline", type: "material-community" },
  );
  const [isShared, setIsShared] = useState(existingFund?.is_shared ?? false);
  const [otherParticipantId, setOtherParticipantId] = useState(existingFund?.other_participant_id);
  const [otherParticipantName, setOtherParticipantName] = useState(
    existingFund?.other_participant_name ??
      (existingFund?.other_participant_id
        ? userBalancesById[existingFund.other_participant_id]?.name
        : undefined),
  );
  const [hasGoal, setHasGoal] = useState(existingFund?.target_cents != null);
  const [targetDate, setTargetDate] = useState(
    existingFund?.target_date ? new Date(existingFund.target_date) : new Date(),
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [saving, setSaving] = useState(false);

  const initialAmount = existingFund?.target_cents
    ? (existingFund.target_cents / 100).toString()
    : "";
  const { expression, onKeyPress, evaluateExpression } = useCustomKeyboard(initialAmount);
  const [targetAmount, setTargetAmount] = useState(initialAmount);

  const snapshot = JSON.stringify([
    name,
    selectedIcon,
    isShared,
    otherParticipantId ?? null,
    hasGoal,
    targetAmount,
    targetDate.toDateString(),
  ]);
  const initialSnapshot = useRef(snapshot);
  const dirty = snapshot !== initialSnapshot.current;

  const dismissAll = () => {
    Keyboard.dismiss();
    setShowDatePicker(false);
    setShowKeyboard(false);
  };

  const handleIconPick = (_id: any, _iconName: any, iconSet: any, iconColor: any, _bg: any) => {
    setSelectedIcon({
      name: iconSet,
      type: packageToIconsetMapping[iconColor] || "material-community",
    });
    iconSheetRef.current?.dismiss();
  };

  const handleDateChange = (_: any, selectedDate?: Date) => {
    if (!selectedDate) {
      setShowDatePicker(false);
      return;
    }
    setTargetDate(selectedDate);
    setShowDatePicker(false);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast("Give this fund a name", "error");
      return;
    }
    if (!userId) {
      toast("You need to be signed in", "error");
      return;
    }

    if (isShared && !otherParticipantId) {
      toast("Choose who this fund is shared with, or turn sharing off", "error");
      return;
    }

    const now = new Date().toISOString();
    const targetCents = hasGoal && targetAmount ? Math.round(parseFloat(targetAmount) * 100) : undefined;
    if (hasGoal && (targetCents == null || isNaN(targetCents) || targetCents <= 0)) {
      toast("Enter a valid goal amount, or turn the goal off", "error");
      return;
    }

    const fund: Fund = {
      id: existingFund?.id ?? (uuid.v4() as string),
      name: name.trim(),
      icon_name: selectedIcon.name,
      icon_type: selectedIcon.type,
      is_shared: isShared,
      owner_id: existingFund?.owner_id ?? userId,
      other_participant_id: isShared ? otherParticipantId : undefined,
      other_participant_name: isShared ? otherParticipantName : undefined,
      target_cents: hasGoal ? targetCents : undefined,
      target_date: hasGoal ? targetDate.toISOString() : undefined,
      created_at: existingFund?.created_at ?? now,
      updated_at: now,
      is_deleted: false,
    };

    setSaving(true);
    try {
      const saved = await upsertFund(fund);
      mergeFundsInUI([saved ?? fund]);
      toast(isEditing ? "Fund updated" : "Fund created");
      form.current?.close();
    } catch {
      toast("Couldn't save the fund", "error");
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!existingFund) return;
    const ok = await confirm({
      title: "Delete this fund?",
      message:
        "This won't delete individual contributions from your records, but they'll no longer be grouped together.",
    });
    if (!ok) return;
    try {
      await deleteFund(existingFund.id);
      removeFundLocal(existingFund.id);
      toast("Fund deleted");
      form.current?.close();
    } catch {
      toast("Couldn't delete the fund", "error");
    }
  };

  const goalLabel = showKeyboard
    ? `₹${expression || "0"}`
    : targetAmount
      ? formatMoney(Math.round(parseFloat(targetAmount) * 100))
      : undefined;

  return (
    <Form
      ref={form}
      title={isEditing ? "Edit fund" : "New fund"}
      onSave={handleSave}
      canSave={dirty}
      saving={saving}
      dirty={dirty}
      footer={
        showKeyboard ? (
          <CustomKeyboard
            onKeyPress={(key) => {
              if (key === "Done") {
                const result = evaluateExpression();
                setTargetAmount(result);
                setShowKeyboard(false);
              } else {
                const result = onKeyPress(key);
                setTargetAmount(String(result));
              }
            }}
          />
        ) : undefined
      }
    >
      <Pressable
        accessibilityLabel="Change icon"
        style={styles.iconHero}
        onPress={() => {
          dismissAll();
          iconSheetRef.current?.present();
        }}
      >
        <GlyphPlate name={selectedIcon.name} type={selectedIcon.type} color={COLORS.accent} size={80} radius={RADIUS.xl} />
        <Text variant="caption" tone="muted" style={styles.iconHint}>
          Tap to change icon
        </Text>
      </Pressable>

      <RowGroup>
        <Field
          icon="pencil-outline"
          placeholder="Fund name"
          value={name}
          onChangeText={setName}
          onFocus={() => {
            setShowKeyboard(false);
            setShowDatePicker(false);
          }}
          returnKeyType="done"
        />
      </RowGroup>

      <RowGroup inset={ICON_INSET} style={styles.group}>
        <ListRow
          icon="account-multiple-outline"
          title="Shared with someone"
          onPress={() => setIsShared(!isShared)}
          trailing={<Switch value={isShared} onValueChange={setIsShared} trackColor={{ true: COLORS.accent }} />}
        />
        {isShared && (
          <ListRow
            leading={otherParticipantName ? <Avatar name={otherParticipantName} size={34} /> : undefined}
            icon="account-outline"
            iconColor={COLORS.inkMuted}
            title={otherParticipantName || "Choose partner"}
            placeholder={!otherParticipantName}
            chevron
            onPress={() => {
              dismissAll();
              partnerPickerRef.current?.open();
            }}
          />
        )}
      </RowGroup>

      <RowGroup inset={ICON_INSET} style={styles.group}>
        <ListRow
          icon="flag-outline"
          title="Set a savings goal"
          onPress={() => setHasGoal(!hasGoal)}
          trailing={<Switch value={hasGoal} onValueChange={setHasGoal} trackColor={{ true: COLORS.accent }} />}
        />
        {hasGoal && (
          <ListRow
            icon="target"
            title="Goal amount"
            value={goalLabel ?? "Add"}
            valueTone={showKeyboard ? "accent" : goalLabel ? "ink" : "subtle"}
            chevron
            onPress={() => {
              dismissAll();
              setShowKeyboard(true);
            }}
          />
        )}
        {hasGoal && (
          <ListRow
            icon="calendar-outline"
            title="Target date"
            value={formatDate(targetDate)}
            valueTone={showDatePicker ? "accent" : "ink"}
            chevron
            onPress={() => {
              dismissAll();
              setShowDatePicker(!showDatePicker);
            }}
          />
        )}
        {hasGoal && showDatePicker && (
          <View style={styles.datePicker}>
            <DateTimePicker
              value={targetDate}
              mode="date"
              display="inline"
              onChange={handleDateChange}
              minimumDate={new Date()}
              themeVariant={isDark ? "dark" : "light"}
              accentColor={COLORS.accent}
              style={styles.datePickerInner}
            />
          </View>
        )}
      </RowGroup>

      {isEditing && (
        <Button title="Delete fund" variant="destructive" onPress={handleDelete} style={styles.delete} />
      )}

      <Sheet ref={iconSheetRef} title="Icon">
        <View style={{ height: windowHeight * 0.6 }}>
          <IconPicker
            searchTitle=""
            iconsTitle=""
            numColumns={6}
            iconSize={25}
            iconColor={COLORS.ink}
            backgroundColor={COLORS.paper}
            placeholderText="Search icons..."
            placeholderTextColor={COLORS.inkSubtle}
            onClick={handleIconPick}
            iconContainerStyle={StyleSheet.flatten([styles.iconPickerItem, { backgroundColor: COLORS.surface1 }])}
            textInputStyle={StyleSheet.flatten([
              TYPE.body,
              styles.iconPickerSearch,
              { backgroundColor: COLORS.surface1, color: COLORS.ink },
            ])}
          />
        </View>
      </Sheet>

      <FundPartnerPicker
        ref={partnerPickerRef}
        onSelect={(id, name) => {
          setOtherParticipantId(id);
          setOtherParticipantName(name);
        }}
      />
    </Form>
  );
};

const styles = StyleSheet.create({
  iconHero: { alignItems: "center", paddingTop: SPACE.md, paddingBottom: SPACE.xl },
  iconHint: { marginTop: SPACE.sm },
  group: { marginTop: SPACE.xl },
  datePicker: { alignItems: "center", paddingBottom: SPACE.sm },
  datePickerInner: { height: 320 },
  delete: { marginTop: SPACE.xxl },
  iconPickerItem: {
    width: 50,
    height: 50,
    borderRadius: RADIUS.md,
    margin: SPACE.xs,
    justifyContent: "center",
    alignItems: "center",
  },
  iconPickerSearch: { borderRadius: RADIUS.md, paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, alignSelf: "stretch" },
});

export default CreateFundScreen;
