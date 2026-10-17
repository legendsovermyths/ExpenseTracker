import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import { Category } from "../types/entity/Category";
import { SPACE } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import { GlyphPlate, Pressable, Sheet, SheetRef, Text, haptic } from "./ui";

export interface CategoryBottomSheetRef {
  open: (parentId?: number) => void;
  close: () => void;
}

type Props = {
  /** Full list that includes both main and sub categories. */
  categories: Category[];
  /** Called for any choice. A parent with subcategories is reported first, then the sheet shows its subs. */
  onSelect: (category: Category) => void;
};

// Four icons per row; pull the grid out so the outer icons (not their
// columns) line up with the sheet's title and hint.
const PLATE = 52;
const CELL = (Dimensions.get("window").width - SPACE.gutter * 2) / 4;
const EDGE = (CELL - PLATE) / 2;

const colorForId = (id: number, palette: readonly string[]) => palette[Math.abs(id) % palette.length];

/** Category picker sheet: a glyph grid that drills into subcategories. */
const CategoryBottomSheet = forwardRef<CategoryBottomSheetRef, Props>(({ categories, onSelect }, ref) => {
  const { COLORS } = useTheme();
  const sheet = useRef<SheetRef>(null);
  const [parent, setParent] = useState<Category | null>(null);

  const topLevel = categories.filter((c) => !c.is_subcategory);
  const subsOf = useCallback(
    (id: number) => categories.filter((c) => c.parent_category === id && c.is_subcategory),
    [categories],
  );
  const shown = parent ? subsOf(parent.id) : topLevel;

  useImperativeHandle(ref, () => ({
    open: (parentId?: number) => {
      setParent(parentId ? categories.find((c) => c.id === parentId) ?? null : null);
      sheet.current?.present();
    },
    close: () => sheet.current?.dismiss(),
  }));

  const choose = (cat: Category) => {
    haptic("selection");
    onSelect(cat);
    if (!cat.is_subcategory && subsOf(cat.id).length > 0) setParent(cat);
    else sheet.current?.dismiss();
  };

  return (
    <Sheet
      ref={sheet}
      title={parent ? parent.name : "Category"}
      actionLabel={parent ? "Done" : undefined}
      snapPoints={["60%", "90%"]}
      onDismiss={() => setParent(null)}
    >
      {parent && (
        <Text variant="callout" tone="muted" style={styles.hint}>
          Pick a subcategory, or tap Done to keep {parent.name}.
        </Text>
      )}
      <View style={styles.grid}>
        {shown.map((cat) => (
          <Pressable key={cat.id} onPress={() => choose(cat)} style={styles.cell} accessibilityLabel={cat.name}>
            <GlyphPlate
              name={cat.icon_name}
              type={cat.icon_type}
              color={colorForId(cat.id, COLORS.ordinal)}
              size={PLATE}
              radius={16}
            />
            <Text variant="caption" tone="muted" numberOfLines={1} align="center" style={styles.label}>
              {cat.name}
            </Text>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
});

CategoryBottomSheet.displayName = "CategoryBottomSheet";

const styles = StyleSheet.create({
  hint: { marginBottom: SPACE.md },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: SPACE.lg, marginHorizontal: -EDGE },
  cell: { width: CELL, alignItems: "center" },
  label: { marginTop: SPACE.xs },
});

export default CategoryBottomSheet;
