import React, { useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Keyboard,
} from "react-native";
import { Provider } from "react-native-paper";
import { IconPicker } from "@grassper/react-native-icon-picker";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Icon } from "react-native-elements";
import DateTimePicker from "@react-native-community/datetimepicker";
import uuid from "react-native-uuid";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetModalProvider,
} from "@gorhom/bottom-sheet";
import { SIZES, FONTS } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import { ColorPalette } from "../constants/theme";
import { useExpensifyStore } from "../store/store";
import { upsertFund, deleteFund } from "../services/Funds";
import { CustomKeyboard, useCustomKeyboard } from "../components/CustomKeyboard";
import FundPartnerPicker, { FundPartnerPickerRef } from "../components/FundPartnerPicker";
import { formatAmountWithCommas } from "../services/Utils";
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

const CreateFundScreen: React.FC = () => {
  const { COLORS, isDark } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const route = useRoute<any>();
  const navigation = useNavigation<any>();

  const fundId: string | undefined = route.params?.fundId;
  const existingFund = useExpensifyStore((s) => (fundId ? s.funds[fundId] : undefined));
  const isEditing = Boolean(existingFund);

  const userId = useExpensifyStore((s) => s.getUserId());
  const mergeFundsInUI = useExpensifyStore((s) => s.mergeFunds);
  const removeFundLocal = useExpensifyStore((s) => s.removeFundLocal);
  const userBalancesById = useExpensifyStore((s) => s.userbalances);

  const iconSheetRef = useRef<BottomSheetModal>(null);
  const partnerPickerRef = useRef<FundPartnerPickerRef>(null);

  const [name, setName] = useState(existingFund?.name ?? "");
  const [error, setError] = useState("");
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

  const initialAmount = existingFund?.target_cents
    ? (existingFund.target_cents / 100).toString()
    : "";
  const { expression, onKeyPress, evaluateExpression } = useCustomKeyboard(initialAmount);
  const [targetAmount, setTargetAmount] = useState(initialAmount);

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
      setError("Give this fund a name");
      return;
    }
    if (!userId) {
      setError("You need to be signed in");
      return;
    }

    if (isShared && !otherParticipantId) {
      setError("Choose who this fund is shared with, or turn sharing off");
      return;
    }

    const now = new Date().toISOString();
    const targetCents = hasGoal && targetAmount ? Math.round(parseFloat(targetAmount) * 100) : undefined;
    if (hasGoal && (targetCents == null || isNaN(targetCents) || targetCents <= 0)) {
      setError("Enter a valid goal amount, or turn the goal off");
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

    const saved = await upsertFund(fund);
    mergeFundsInUI([saved ?? fund]);
    navigation.pop();
  };

  const handleDelete = () => {
    if (!existingFund) return;
    Alert.alert("Delete Fund", "Are you sure? This won't delete individual contributions from your records, but they'll no longer be grouped together.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteFund(existingFund.id);
          removeFundLocal(existingFund.id);
          navigation.pop();
        },
      },
    ]);
  };

  return (
    <Provider>
      <BottomSheetModalProvider>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.pop()} style={styles.headerBtn}>
              <Icon name="close" type="material-community" size={24} color={COLORS.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{isEditing ? "Edit Fund" : "New Fund"}</Text>
            <TouchableOpacity onPress={handleSave} style={styles.headerBtn}>
              <Icon name="check" type="material-community" size={24} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          {/* Icon hero */}
          <TouchableOpacity
            style={styles.iconHero}
            activeOpacity={0.8}
            onPress={() => {
              dismissAll();
              iconSheetRef.current?.present();
            }}
          >
            <View style={[styles.iconCircle, { backgroundColor: COLORS.primary + "12" }]}>
              <Icon name={selectedIcon.name} type={selectedIcon.type} color={COLORS.primary} size={36} />
            </View>
            <Text style={styles.iconHint}>Tap to change icon</Text>
          </TouchableOpacity>

          <ScrollView style={styles.detailsScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Name */}
            <View style={styles.nameRow}>
              <Icon name="pencil-outline" type="material-community" size={20} color={COLORS.darkgray} />
              <TextInput
                style={styles.nameInput}
                placeholder="Fund name"
                placeholderTextColor={COLORS.darkgray}
                value={name}
                onChangeText={setName}
                returnKeyType="done"
              />
            </View>

            <View style={styles.optionsCard}>
              {/* Shared toggle */}
              <TouchableOpacity
                style={styles.fieldRow}
                onPress={() => setIsShared(!isShared)}
                activeOpacity={0.7}
              >
                <Icon
                  name={isShared ? "checkbox-marked" : "checkbox-blank-outline"}
                  type="material-community"
                  size={22}
                  color={isShared ? COLORS.primary : COLORS.darkgray}
                />
                <Text style={styles.fieldText}>Shared with someone</Text>
              </TouchableOpacity>

              {isShared && (
                <>
                  <View style={styles.fieldDivider} />
                  <TouchableOpacity
                    style={styles.fieldRow}
                    onPress={() => {
                      dismissAll();
                      partnerPickerRef.current?.open();
                    }}
                  >
                    <Icon name="account-outline" type="material-community" size={20} color={COLORS.darkgray} />
                    <Text style={[styles.fieldText, !otherParticipantName && styles.fieldPlaceholder]}>
                      {otherParticipantName || "Choose partner"}
                    </Text>
                    <Icon name="chevron-right" type="material-community" size={20} color={COLORS.gray} />
                  </TouchableOpacity>
                </>
              )}

              <View style={styles.fieldDivider} />

              {/* Goal toggle */}
              <TouchableOpacity
                style={styles.fieldRow}
                onPress={() => setHasGoal(!hasGoal)}
                activeOpacity={0.7}
              >
                <Icon
                  name={hasGoal ? "checkbox-marked" : "checkbox-blank-outline"}
                  type="material-community"
                  size={22}
                  color={hasGoal ? COLORS.primary : COLORS.darkgray}
                />
                <Text style={styles.fieldText}>Set a savings goal</Text>
              </TouchableOpacity>

              {hasGoal && (
                <>
                  <View style={styles.fieldDivider} />
                  <TouchableOpacity
                    style={styles.fieldRow}
                    onPress={() => {
                      dismissAll();
                      setShowKeyboard(true);
                    }}
                  >
                    <Icon name="target" type="material-community" size={20} color={COLORS.darkgray} />
                    <Text style={[styles.fieldText, !targetAmount && styles.fieldPlaceholder]}>
                      {targetAmount ? `₹${formatAmountWithCommas(parseFloat(targetAmount), true)}` : "Goal amount"}
                    </Text>
                    <Icon name="chevron-right" type="material-community" size={20} color={COLORS.gray} />
                  </TouchableOpacity>

                  <View style={styles.fieldDivider} />

                  <TouchableOpacity
                    style={styles.fieldRow}
                    onPress={() => {
                      dismissAll();
                      setShowDatePicker(!showDatePicker);
                    }}
                  >
                    <Icon name="calendar-outline" type="material-community" size={20} color={COLORS.darkgray} />
                    <Text style={styles.fieldText}>{formatDate(targetDate)}</Text>
                    <Icon name="chevron-right" type="material-community" size={20} color={COLORS.gray} />
                  </TouchableOpacity>

                  {showDatePicker && (
                    <View style={{ alignItems: "center", paddingBottom: SIZES.base }}>
                      <DateTimePicker
                        value={targetDate}
                        mode="date"
                        display="inline"
                        onChange={handleDateChange}
                        minimumDate={new Date()}
                        themeVariant={isDark ? "dark" : "light"}
                        style={{ height: 320 }}
                      />
                    </View>
                  )}
                </>
              )}
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {isEditing && (
              <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                <Icon name="trash-can-outline" type="material-community" size={18} color={COLORS.red2} />
                <Text style={styles.deleteBtnText}>Delete Fund</Text>
              </TouchableOpacity>
            )}

            <View style={{ height: 120 }} />
          </ScrollView>

          {showKeyboard && (
            <View style={styles.keyboardContainer}>
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
            </View>
          )}

          {/* Icon picker sheet */}
          <BottomSheetModal
            ref={iconSheetRef}
            index={0}
            snapPoints={["80%"]}
            backgroundStyle={{ backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
          >
            <BottomSheetView style={styles.sheetContent}>
              <IconPicker
                searchTitle=""
                iconsTitle=""
                numColumns={6}
                iconSize={25}
                iconColor={COLORS.primary}
                backgroundColor={COLORS.white}
                placeholderText="Search icons..."
                placeholderTextColor={COLORS.darkgray}
                onClick={handleIconPick}
                iconContainerStyle={styles.iconPickerItem}
                textInputStyle={styles.iconPickerSearch}
              />
            </BottomSheetView>
          </BottomSheetModal>

          <FundPartnerPicker
            ref={partnerPickerRef}
            onSelect={(id, name) => {
              setOtherParticipantId(id);
              setOtherParticipantName(name);
            }}
          />
        </View>
      </BottomSheetModalProvider>
    </Provider>
  );
};

const createStyles = (COLORS: ColorPalette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.white },

    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: SIZES.padding, paddingTop: SIZES.padding * 2.5, paddingBottom: SIZES.base,
    },
    headerBtn: { padding: 4 },
    headerTitle: { ...FONTS.h3, fontWeight: "600", color: COLORS.primary },

    iconHero: { alignItems: "center", paddingVertical: SIZES.padding },
    iconCircle: {
      width: 80, height: 80, borderRadius: 24,
      justifyContent: "center", alignItems: "center",
    },
    iconHint: { ...FONTS.body4, fontSize: 12, color: COLORS.darkgray, marginTop: SIZES.base },

    detailsScroll: { flex: 1, paddingHorizontal: SIZES.padding },

    nameRow: {
      flexDirection: "row", alignItems: "center", gap: SIZES.base + 2,
      marginBottom: SIZES.padding, paddingHorizontal: 4,
    },
    nameInput: {
      flex: 1, ...FONTS.body2, color: COLORS.primary, fontWeight: "500",
      paddingVertical: SIZES.base,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.gray + "50",
    },

    optionsCard: {
      backgroundColor: COLORS.lightGray, borderRadius: 14, overflow: "hidden",
      marginBottom: SIZES.base + 4,
    },
    fieldRow: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: SIZES.padding * 0.7, paddingVertical: SIZES.base + 5, gap: SIZES.base + 2,
    },
    fieldText: { ...FONTS.body3, color: COLORS.primary, fontWeight: "500", flex: 1 },
    fieldPlaceholder: { color: COLORS.darkgray, fontWeight: "400" },
    fieldDivider: {
      height: StyleSheet.hairlineWidth, backgroundColor: COLORS.gray,
      marginHorizontal: SIZES.padding * 0.7, opacity: 0.3,
    },

    errorText: { ...FONTS.body4, color: COLORS.red2, marginTop: SIZES.base, marginLeft: 4 },

    deleteBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 6, marginTop: SIZES.padding, paddingVertical: SIZES.base + 4,
    },
    deleteBtnText: { ...FONTS.body3, color: COLORS.red2, fontWeight: "500" },

    keyboardContainer: { position: "absolute", bottom: 0, left: 0, right: 0 },

    sheetContent: { flex: 1, alignItems: "center" },
    iconPickerItem: {
      width: 50, height: 50, borderRadius: 14, margin: 5,
      justifyContent: "center", alignItems: "center", backgroundColor: COLORS.lightGray,
    },
    iconPickerSearch: { backgroundColor: COLORS.white, color: COLORS.primary, width: 370 },
  });

export default CreateFundScreen;
