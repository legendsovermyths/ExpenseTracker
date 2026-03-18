import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Keyboard,
} from "react-native";
import { FONTS, SIZES } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import { ColorPalette } from "../constants/theme";
import { Icon } from "react-native-elements";
import { useNavigation } from "@react-navigation/native";
import { useExpensifyStore } from "../store/store";
import { invokeBackend } from "../services/api";
import { Action } from "../types/actions/actions";
import { formatAmountWithCommas } from "../services/Utils";

const CategoryBudgetScreen: React.FC = () => {
  const { COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const navigation = useNavigation();

  const categoriesById = useExpensifyStore((state) => state.categories);
  const categoryBudgets = useExpensifyStore((state) => state.categoryBudgets);
  const upsertBudgetUI = useExpensifyStore((state) => state.upsertCategoryBudget);
  const deleteBudgetUI = useExpensifyStore((state) => state.deleteCategoryBudget);

  // Only show parent categories (not subcategories, not deleted)
  const parentCategories = useMemo(
    () => Object.values(categoriesById).filter((c) => !c.is_subcategory && !c.is_deleted),
    [categoriesById],
  );

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const handleStartEdit = (categoryId: number) => {
    const existing = categoryBudgets[categoryId];
    setEditValue(existing ? existing.amount.toString() : "");
    setEditingId(categoryId);
  };

  const handleSave = async (categoryId: number) => {
    const amount = parseFloat(editValue);
    if (!editValue.trim() || isNaN(amount) || amount <= 0) {
      // Clear the budget
      await invokeBackend(Action.DeleteCategoryBudget, { category_id: categoryId });
      deleteBudgetUI(categoryId);
    } else {
      const response = await invokeBackend(Action.UpsertCategoryBudget, {
        category_budget: { category_id: categoryId, amount },
      });
      const added = response.additions?.category_budgets?.[0];
      if (added) upsertBudgetUI(added);
    }
    setEditingId(null);
    Keyboard.dismiss();
  };

  const handleClear = async (categoryId: number) => {
    await invokeBackend(Action.DeleteCategoryBudget, { category_id: categoryId });
    deleteBudgetUI(categoryId);
    setEditingId(null);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Icon name="arrow-left" type="material-community" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Category Budgets</Text>
        <View style={styles.headerBtn} />
      </View>

      <Text style={styles.subtitle}>
        Set monthly spending limits for the categories you want to track
      </Text>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          {parentCategories.map((category, i) => {
            const budget = categoryBudgets[category.id];
            const isEditing = editingId === category.id;

            return (
              <View key={category.id}>
                {i > 0 && <View style={styles.divider} />}
                <TouchableOpacity
                  style={styles.row}
                  activeOpacity={0.7}
                  onPress={() => handleStartEdit(category.id)}
                >
                  {/* Icon */}
                  <View style={[styles.catIcon, { backgroundColor: COLORS.primary + "12" }]}>
                    <Icon
                      name={category.icon_name}
                      type={category.icon_type}
                      size={18}
                      color={COLORS.primary}
                    />
                  </View>

                  {/* Name + budget */}
                  <View style={styles.rowInfo}>
                    <Text style={styles.catName}>{category.name}</Text>
                    {!isEditing && (
                      <Text style={budget ? styles.budgetAmount : styles.noBudget}>
                        {budget ? `₹${formatAmountWithCommas(budget.amount, false)} / mo` : "No limit"}
                      </Text>
                    )}
                  </View>

                  {/* Edit state or chevron */}
                  {isEditing ? (
                    <View style={styles.editRow}>
                      <Text style={styles.currencyPrefix}>₹</Text>
                      <TextInput
                        style={styles.editInput}
                        value={editValue}
                        onChangeText={setEditValue}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={COLORS.gray}
                        autoFocus
                        onSubmitEditing={() => handleSave(category.id)}
                        returnKeyType="done"
                      />
                      {budget && (
                        <TouchableOpacity
                          onPress={() => handleClear(category.id)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Icon name="close-circle" type="material-community" size={18} color={COLORS.gray} />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        onPress={() => handleSave(category.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Icon name="check-circle" type="material-community" size={22} color={COLORS.primary} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Icon name="chevron-right" type="material-community" size={20} color={COLORS.gray} />
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {parentCategories.length === 0 && (
          <View style={styles.emptyState}>
            <Icon name="tag-outline" type="material-community" size={48} color={COLORS.gray} />
            <Text style={styles.emptyText}>Add some categories first</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const createStyles = (COLORS: ColorPalette) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.white },

    // Header
    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: SIZES.padding, paddingTop: SIZES.padding * 2.5, paddingBottom: SIZES.base,
    },
    headerBtn: { padding: 4, width: 32 },
    headerTitle: { ...FONTS.h2, fontWeight: "700", color: COLORS.primary },

    subtitle: {
      ...FONTS.body4, color: COLORS.darkgray,
      paddingHorizontal: SIZES.padding, marginBottom: SIZES.padding,
    },

    scrollContent: { paddingHorizontal: SIZES.padding },

    // Card
    card: {
      backgroundColor: COLORS.lightGray, borderRadius: 14, overflow: "hidden",
    },
    divider: {
      height: StyleSheet.hairlineWidth, backgroundColor: COLORS.gray,
      marginHorizontal: SIZES.padding * 0.7, opacity: 0.3,
    },
    row: {
      flexDirection: "row", alignItems: "center",
      paddingHorizontal: SIZES.padding * 0.7, paddingVertical: SIZES.base + 5,
      gap: SIZES.base + 2,
    },
    catIcon: {
      width: 36, height: 36, borderRadius: 10,
      justifyContent: "center", alignItems: "center",
    },
    rowInfo: { flex: 1 },
    catName: { ...FONTS.body3, fontWeight: "500", color: COLORS.primary },
    budgetAmount: { ...FONTS.body4, fontSize: 12, color: COLORS.darkgreen, marginTop: 1 },
    noBudget: { ...FONTS.body4, fontSize: 12, color: COLORS.darkgray, marginTop: 1 },

    // Edit
    editRow: {
      flexDirection: "row", alignItems: "center", gap: 6,
    },
    currencyPrefix: {
      ...FONTS.body3, fontWeight: "600", color: COLORS.darkgray,
    },
    editInput: {
      ...FONTS.body3, fontWeight: "600", color: COLORS.primary,
      borderBottomWidth: 1, borderBottomColor: COLORS.primary,
      minWidth: 60, textAlign: "right", paddingVertical: 2,
    },

    // Empty
    emptyState: {
      alignItems: "center", justifyContent: "center",
      paddingTop: SIZES.padding * 4, gap: SIZES.base,
    },
    emptyText: { ...FONTS.body3, color: COLORS.darkgray },
  });

export default CategoryBudgetScreen;
