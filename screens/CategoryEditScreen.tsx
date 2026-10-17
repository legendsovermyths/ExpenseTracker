import React from "react";
import { StyleSheet } from "react-native";
import { SPACE } from "../constants";
import { useNavigation } from "@react-navigation/native";
import { useExpensifyStore } from "../store/store";
import { Category } from "../types/entity/Category";
import { useTheme } from "../contexts/ThemeContext";
import {
  EmptyState,
  GlyphPlate,
  ListRow,
  PageList,
  FeedbackRow,
} from "../components/ui";

const colorForId = (id: number, palette: readonly string[]) =>
  palette[Math.abs(id) % palette.length];

const CategoryEditScreen: React.FC = () => {
  const { COLORS } = useTheme();
  const categoriesById = useExpensifyStore((state) => state.categories);
  const categories = Object.values(categoriesById);
  const undeletedCategories = categories.filter(
    (category) => !category.is_deleted,
  );
  const navigation = useNavigation<any>();

  const handleEdit = (category: Category) => {
    navigation.navigate("EditCategory", { category: category });
  };

  return (
    <PageList
      title="Categories"
      data={undeletedCategories}
      keyExtractor={(item) => String(item.id)}
      estimatedItemSize={64}
      renderItem={({ item }) => {
        const parent =
          item.is_subcategory && item.parent_category
            ? categoriesById[item.parent_category]
            : null;
        return (
          <FeedbackRow kind="category" id={item.id}>
            <ListRow
              leading={
                <GlyphPlate
                  name={item.icon_name}
                  type={item.icon_type}
                  color={colorForId(item.id, COLORS.ordinal)}
                  size={34}
                  radius={10}
                />
              }
              title={item.name}
              subtitle={parent ? `in ${parent.name}` : undefined}
              chevron
              onPress={() => handleEdit(item)}
              style={styles.row}
            />
          </FeedbackRow>
        );
      }}
      ListEmptyComponent={
        <EmptyState
          icon="shape-outline"
          title="No categories"
          message="Categories you add show up here."
        />
      }
    />
  );
};

const styles = StyleSheet.create({ row: { paddingHorizontal: SPACE.gutter } });

export default CategoryEditScreen;
