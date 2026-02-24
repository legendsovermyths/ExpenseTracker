import React, {
  useMemo,
  useCallback,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from "react-native";
import BottomSheet from "@gorhom/bottom-sheet";
import { Category } from "../types/entity/Category";
import { SIZES } from "../constants";
import { Icon } from "react-native-elements";
import { Portal } from "react-native-paper";
import { useTheme } from "../contexts/ThemeContext";

export interface CategoryBottomSheetRef {
  open: (parentId?: number) => void;
  close: () => void;
}

type Props = {
  /** full list that includes both main + sub */
  categories: Category[];
  /** called when user chooses ANY category (even a sub-category) */
  onSelect: (category: Category) => void;
};

const CategoryBottomSheet = forwardRef<CategoryBottomSheetRef, Props>(
  ({ categories, onSelect }, ref) => {
    const { COLORS } = useTheme();
    const sheetRef = useRef<BottomSheet>(null);
    const [displayCats, setDisplayCats] = useState<Category[]>([]);
    const snapPoints = useMemo(() => ["50%", "75%"], []);
    useImperativeHandle(ref, () => ({
      open: (parentId?: number) => {
        if (parentId) {
          setDisplayCats(
            categories.filter(
              (c) => c.parent_category === parentId && c.is_subcategory,
            ),
          );
        } else {
          setDisplayCats(categories.filter((c) => !c.is_subcategory));
        }
        sheetRef.current?.snapToIndex(0);
      },
      close() {
        sheetRef.current?.close();
      },
    }));

    //------------------------------------------------
    // helpers
    //------------------------------------------------
    const handlePress = useCallback(
      (cat: Category) => {
        const subs = categories.filter(
          (c) => c.parent_category === cat.id && c.is_subcategory,
        );
        if (subs.length) {
          onSelect(cat);
          setDisplayCats(subs);
        } else {
          onSelect(cat);
          sheetRef.current?.close();
        }
      },
      [categories, onSelect],
    );

    //------------------------------------------------
    // render
    //------------------------------------------------
    const styles = createStyles(COLORS);

    return (
      <Portal>
        <BottomSheet
          ref={sheetRef}
          index={-1}
          snapPoints={snapPoints}
          enablePanDownToClose
          backgroundStyle={styles.sheetBackground}
        >
          <FlatList
            contentContainerStyle={styles.grid}
            data={displayCats}
            numColumns={4}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.item}
                onPress={() => handlePress(item)}
                activeOpacity={0.7}
              >
                <Icon type={item.icon_type} name={item.icon_name} size={26} color={COLORS.primary} />
                <Text numberOfLines={1} style={styles.label}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            )}
          />
        </BottomSheet>
      </Portal>
    );
  },
);

export default CategoryBottomSheet;

//--------------------------------------------------
// Styles
//--------------------------------------------------
const createStyles = (COLORS: any) => StyleSheet.create({
  sheetBackground: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  grid: {
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding,
  },
  item: {
    flex: 1,
    alignItems: "center",
    marginVertical: 8,
  },
  label: {
    fontSize: 12,
    marginTop: 4,
    color: COLORS.darkgray,
    textAlign: "center",
  },
});
