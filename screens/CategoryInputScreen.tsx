import React, { useCallback, useRef, useState } from "react";
import { Keyboard, StyleSheet, Switch } from "react-native";
import { IconPicker } from "@grassper/react-native-icon-picker";
import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { useRoute } from "@react-navigation/native";
import { RADIUS, SPACE, TYPE } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import {
  addCategory,
  getMainCategories,
  editCategory,
  deleteCategory,
} from "../services/CategoryService";
import { useExpensifyStore } from "../store/store";
import CategoryBottomSheet, { CategoryBottomSheetRef } from "../components/CategoryBottomSheet";
import {
  Button,
  Field,
  Form,
  FormRef,
  GlyphPlate,
  ListRow,
  Pressable,
  RowGroup,
  Text,
  confirm,
  toast,
} from "../components/ui";

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

const PARENT_ERROR = "Pick a parent category";
const colorForId = (id: number, palette: readonly string[]) => palette[Math.abs(id) % palette.length];

const CategoryInputScreen: React.FC = () => {
  const { COLORS } = useTheme();
  const route = useRoute<any>();
  const form = useRef<FormRef>(null);
  const parentSheet = useRef<CategoryBottomSheetRef>(null);

  let category: any = null;
  let isEditing = false;
  if (route.params) {
    category = route.params.category;
    isEditing = true;
  }

  const categoriesById = useExpensifyStore((state) => state.categories);
  const addCategoryUI = useExpensifyStore((state) => state.addCategory);
  const editCategoryUI = useExpensifyStore((state) => state.updateCategories);
  const deleteCategoryUI = useExpensifyStore((state) => state.deleteCategory);
  const categories = Object.values(categoriesById);
  const mainCategories = getMainCategories(categories).filter((c) => !c.is_deleted);

  const iconSheet = useRef<BottomSheetModal>(null);
  const [name, setName] = useState(category?.name || "");
  const [error, setError] = useState("");
  const [isSubcategory, setIsSubcategory] = useState(category ? category.is_subcategory : 0);
  const [selectedCategory, setSelectedCategory] = useState(
    useExpensifyStore((state) => state.getCategoryById(category?.parent_category)) || null,
  );
  const [selectedIcon, setSelectedIcon] = useState(
    isEditing
      ? { name: category.icon_name, color: COLORS.ink, type: category.icon_type }
      : { name: "help", color: COLORS.ink, type: "ionicon" },
  );

  const isSub = Boolean(isSubcategory);
  const parentError = error === PARENT_ERROR;

  const initial = useRef({ name, isSubcategory, parentId: selectedCategory?.id ?? null, icon: `${selectedIcon.type}/${selectedIcon.name}` }).current;
  const dirty =
    name !== initial.name ||
    isSubcategory !== initial.isSubcategory ||
    (selectedCategory?.id ?? null) !== initial.parentId ||
    `${selectedIcon.type}/${selectedIcon.name}` !== initial.icon;

  const makeCategoryObject = () => ({
    id: category?.id || null,
    name,
    parent_category: isSub ? selectedCategory?.id : null,
    icon_name: selectedIcon.name,
    icon_type: selectedIcon.type,
    is_subcategory: Boolean(isSubcategory),
    is_deleted: false,
  });

  const handleSave = async () => {
    if (!name.trim() || (isSub && !selectedCategory)) {
      setError(!name.trim() ? "Give the category a name" : PARENT_ERROR);
      return;
    }
    if (!isEditing && categories.some((c) => c.name === name && !c.is_deleted)) {
      setError("A category with this name already exists");
      return;
    }
    const cat = makeCategoryObject();
    if (isEditing) {
      const updated = await editCategory(cat);
      editCategoryUI(updated);
    } else {
      const added = await addCategory(cat);
      addCategoryUI(added);
    }
    toast(isEditing ? "Category updated" : "Category added");
    form.current?.close();
  };

  const handleDelete = async () => {
    const ok = await confirm({ title: `Delete ${category?.name}?`, message: "Past transactions keep their category." });
    if (!ok) return;
    await deleteCategory(category);
    deleteCategoryUI(category.id);
    toast("Category deleted");
    form.current?.close();
  };

  const handleIconPick = (_id: any, _iconName: any, iconSet: any, iconColor: any, _bg: any) => {
    setSelectedIcon({
      name: iconSet,
      color: COLORS.ink,
      type: packageToIconsetMapping[iconColor] || "material-community",
    });
    iconSheet.current?.dismiss();
  };

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.35} />
    ),
    [],
  );

  const glyphColor = isEditing && category?.id ? colorForId(category.id, COLORS.ordinal) : COLORS.accent;

  return (
    <Form
      ref={form}
      title={isEditing ? "Edit category" : "New category"}
      onSave={handleSave}
      dirty={dirty}
    >
      <Pressable
        style={styles.hero}
        accessibilityLabel="Change icon"
        onPress={() => {
          Keyboard.dismiss();
          iconSheet.current?.present();
        }}
      >
        <GlyphPlate name={selectedIcon.name} type={selectedIcon.type} color={glyphColor} size={80} radius={24} />
        <Text variant="callout" tone="accent" style={styles.heroHint}>
          Change icon
        </Text>
      </Pressable>

      <RowGroup>
        <Field
          label="Name"
          placeholder="e.g. Groceries"
          value={name}
          onChangeText={(t) => {
            setName(t);
            if (error) setError("");
          }}
          returnKeyType="done"
          error={error && !parentError ? error : null}
        />
      </RowGroup>

      <RowGroup inset={SPACE.lg + 34 + SPACE.md} style={styles.group}>
        <ListRow
          icon="file-tree-outline"
          title="Subcategory"
          subtitle={isEditing ? "Can't be changed after creating" : undefined}
          trailing={
            <Switch
              value={isSub}
              onValueChange={(v) => {
                setIsSubcategory(v ? 1 : 0);
                if (error) setError("");
              }}
              disabled={isEditing}
              trackColor={{ true: COLORS.accent }}
            />
          }
        />
        {isSub && (
          <ListRow
            leading={
              selectedCategory ? (
                <GlyphPlate
                  name={selectedCategory.icon_name}
                  type={selectedCategory.icon_type}
                  color={colorForId(selectedCategory.id, COLORS.ordinal)}
                  size={34}
                  radius={10}
                />
              ) : undefined
            }
            icon="folder-outline"
            title={selectedCategory?.name || "Parent category"}
            placeholder={!selectedCategory}
            chevron={!isEditing}
            disabled={isEditing}
            onPress={() => {
              Keyboard.dismiss();
              parentSheet.current?.open();
            }}
          />
        )}
      </RowGroup>
      {parentError && (
        <Text variant="caption" tone="up" style={styles.groupError}>
          {error}
        </Text>
      )}

      {isEditing && (
        <Button title="Delete category" variant="destructive" onPress={handleDelete} style={styles.delete} />
      )}

      <CategoryBottomSheet
        ref={parentSheet}
        categories={mainCategories}
        onSelect={(cat) => {
          setSelectedCategory(cat);
          if (error) setError("");
        }}
      />

      <BottomSheetModal
        ref={iconSheet}
        snapPoints={["80%"]}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: COLORS.paper, borderRadius: RADIUS.xl }}
        handleIndicatorStyle={{ backgroundColor: COLORS.inkSubtle, width: 36 }}
      >
        <BottomSheetView style={styles.sheet}>
          <Text variant="title" style={styles.sheetTitle}>
            Icon
          </Text>
          <IconPicker
            searchTitle=""
            iconsTitle=""
            numColumns={6}
            iconSize={24}
            iconColor={COLORS.ink}
            backgroundColor={COLORS.paper}
            placeholderText="Search icons"
            placeholderTextColor={COLORS.inkSubtle}
            onClick={handleIconPick}
            iconContainerStyle={{ ...styles.iconCell, backgroundColor: COLORS.surface1 }}
            textInputStyle={{ ...styles.search, ...TYPE.body, backgroundColor: COLORS.surface1, color: COLORS.ink }}
          />
        </BottomSheetView>
      </BottomSheetModal>
    </Form>
  );
};

const styles = StyleSheet.create({
  hero: { alignItems: "center", paddingTop: SPACE.lg, paddingBottom: SPACE.xl },
  heroHint: { marginTop: SPACE.sm },
  group: { marginTop: SPACE.lg },
  groupError: { marginTop: SPACE.sm, marginLeft: SPACE.lg },
  delete: { marginTop: SPACE.xl, alignSelf: "center" },
  sheet: { flex: 1, alignItems: "center", paddingHorizontal: SPACE.lg },
  sheetTitle: { alignSelf: "stretch", paddingVertical: SPACE.sm, marginBottom: SPACE.sm },
  iconCell: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    margin: SPACE.xs,
    justifyContent: "center",
    alignItems: "center",
  },
  search: {
    alignSelf: "stretch",
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm + 2,
    marginBottom: SPACE.md,
  },
});

export default CategoryInputScreen;
