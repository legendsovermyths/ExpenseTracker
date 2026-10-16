import React, { useMemo, useState } from "react";
import { StyleSheet, TextInput, View, Keyboard } from "react-native";
import { SPACE, TYPE } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import { useExpensifyStore } from "../store/store";
import { invokeBackend } from "../services/api";
import { Action } from "../types/actions/actions";
import {
  EmptyState,
  GlyphPlate,
  Icon,
  ListRow,
  Page,
  Pressable,
  RowGroup,
  Text,
  formatMoney,
} from "../components/ui";

const PLATE = 34;
const colorForId = (id: number, palette: readonly string[]) => palette[Math.abs(id) % palette.length];

const CategoryBudgetScreen: React.FC = () => {
  const { COLORS } = useTheme();

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
    <Page title="Category budgets" subtitle="Monthly limits for the categories you want to keep an eye on.">
      {parentCategories.length === 0 ? (
        <EmptyState icon="tag-outline" title="No categories yet" message="Add some categories first." />
      ) : (
        <RowGroup inset={SPACE.lg + PLATE + SPACE.md} style={styles.group}>
          {parentCategories.map((category) => {
            const budget = categoryBudgets[category.id];
            const isEditing = editingId === category.id;

            return (
              <ListRow
                key={category.id}
                leading={
                  <GlyphPlate
                    name={category.icon_name}
                    type={category.icon_type}
                    color={colorForId(category.id, COLORS.ordinal)}
                    size={PLATE}
                    radius={10}
                  />
                }
                title={category.name}
                value={isEditing ? undefined : budget ? `${formatMoney(Math.round(budget.amount * 100))} / mo` : "No limit"}
                valueTone={budget ? "ink" : "subtle"}
                chevron={!isEditing}
                onPress={() => handleStartEdit(category.id)}
                trailing={
                  isEditing ? (
                    <View style={styles.edit}>
                      <Text variant="amount" tone="subtle">
                        ₹
                      </Text>
                      <TextInput
                        style={[TYPE.amount, styles.input, { color: COLORS.ink }]}
                        value={editValue}
                        onChangeText={setEditValue}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={COLORS.inkSubtle}
                        selectionColor={COLORS.accent}
                        autoFocus
                        onSubmitEditing={() => handleSave(category.id)}
                        returnKeyType="done"
                        accessibilityLabel={`${category.name} monthly budget`}
                      />
                      {budget && (
                        <Pressable onPress={() => handleClear(category.id)} hitSlop={8} accessibilityLabel="Remove budget">
                          <Icon name="close-circle" size="md" color={COLORS.inkSubtle} />
                        </Pressable>
                      )}
                      <Pressable
                        onPress={() => handleSave(category.id)}
                        hitSlop={8}
                        haptic="light"
                        accessibilityLabel="Save budget"
                      >
                        <Icon name="check-circle" size="lg" color={COLORS.accent} />
                      </Pressable>
                    </View>
                  ) : undefined
                }
              />
            );
          })}
        </RowGroup>
      )}
    </Page>
  );
};

const styles = StyleSheet.create({
  group: { marginTop: SPACE.sm },
  edit: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
  input: { minWidth: 64, textAlign: "right", padding: 0, margin: 0 },
});

export default CategoryBudgetScreen;
