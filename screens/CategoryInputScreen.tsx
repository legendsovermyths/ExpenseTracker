import React, { useState, useCallback, useMemo, useRef } from "react";
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
import { SIZES, FONTS } from "../constants";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Icon } from "react-native-elements";
import { useTheme } from "../contexts/ThemeContext";
import { ColorPalette } from "../constants/theme";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetModalProvider,
} from "@gorhom/bottom-sheet";
import {
  addCategory,
  getMainCategories,
  editCategory,
  deleteCategory,
} from "../services/CategoryService";
import { useExpensifyStore } from "../store/store";

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

const CategoryInputScreen: React.FC = () => {
  const { COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const route = useRoute<any>();
  const navigation = useNavigation();

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
  const mainCategories = getMainCategories(categories);

  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const [name, setName] = useState(category?.name || "");
  const [error, setError] = useState("");
  const [isSubcategory, setIsSubcategory] = useState(category ? category.is_subcategory : 0);
  const [showParentPicker, setShowParentPicker] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(
    useExpensifyStore((state) => state.getCategoryById(category?.parent_category)) || null,
  );
  const [selectedIcon, setSelectedIcon] = useState(
    isEditing
      ? { name: category.icon_name, color: COLORS.primary, type: category.icon_type }
      : { name: "help", color: COLORS.primary, type: "ionicon" },
  );

  const makeCategoryObject = () => ({
    id: category?.id || null,
    name,
    parent_category: isSubcategory == 1 ? selectedCategory?.id : null,
    icon_name: selectedIcon.name,
    icon_type: selectedIcon.type,
    is_subcategory: Boolean(isSubcategory),
    is_deleted: false,
  });

  const handleSave = async () => {
    if (!name.trim() || (isSubcategory == 1 && !selectedCategory)) {
      setError("Please fill in all the required fields");
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
    navigation.pop();
  };

  const handleDelete = () => {
    Alert.alert("Delete Category", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteCategory(category);
          deleteCategoryUI(category.id);
          navigation.pop();
        },
      },
    ]);
  };

  const handleIconPick = (_id: any, _iconName: any, iconSet: any, iconColor: any, _bg: any) => {
    setSelectedIcon({
      name: iconSet,
      color: COLORS.primary,
      type: packageToIconsetMapping[iconColor] || "material-community",
    });
    bottomSheetModalRef.current?.dismiss();
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
            <Text style={styles.headerTitle}>
              {isEditing ? "Edit Category" : "New Category"}
            </Text>
            <TouchableOpacity onPress={handleSave} style={styles.headerBtn}>
              <Icon name="check" type="material-community" size={24} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          {/* Icon hero */}
          <TouchableOpacity
            style={styles.iconHero}
            activeOpacity={0.8}
            onPress={() => {
              Keyboard.dismiss();
              bottomSheetModalRef.current?.present();
            }}
          >
            <View style={[styles.iconCircle, { backgroundColor: COLORS.primary + "12" }]}>
              <Icon
                name={selectedIcon.name}
                type={selectedIcon.type}
                color={COLORS.primary}
                size={36}
              />
            </View>
            <Text style={styles.iconHint}>Tap to change icon</Text>
          </TouchableOpacity>

          <ScrollView style={styles.detailsScroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Name */}
            <View style={styles.nameRow}>
              <Icon name="tag-outline" type="material-community" size={20} color={COLORS.darkgray} />
              <TextInput
                style={styles.nameInput}
                placeholder="Category name"
                placeholderTextColor={COLORS.darkgray}
                value={name}
                onChangeText={setName}
                returnKeyType="done"
              />
            </View>

            {/* Options card */}
            <View style={styles.optionsCard}>
              {/* Subcategory toggle */}
              <TouchableOpacity
                style={styles.fieldRow}
                onPress={() => { if (!isEditing) setIsSubcategory(isSubcategory ^ 1); }}
                disabled={isEditing}
              >
                <Icon
                  name={isSubcategory ? "checkbox-marked" : "checkbox-blank-outline"}
                  type="material-community"
                  size={22}
                  color={isEditing ? COLORS.gray : isSubcategory ? COLORS.primary : COLORS.darkgray}
                />
                <Text style={[styles.fieldText, isEditing && { color: COLORS.gray }]}>
                  This is a sub-category
                </Text>
              </TouchableOpacity>

              {/* Parent category picker */}
              {isSubcategory === 1 && (
                <>
                  <View style={styles.fieldDivider} />
                  <TouchableOpacity
                    style={styles.fieldRow}
                    onPress={() => { if (!isEditing) { Keyboard.dismiss(); setShowParentPicker(!showParentPicker); } }}
                    disabled={isEditing}
                  >
                    <Icon name="folder-outline" type="material-community" size={20} color={COLORS.darkgray} />
                    <Text style={[styles.fieldText, !selectedCategory && styles.fieldPlaceholder]}>
                      {selectedCategory?.name || "Parent category"}
                    </Text>
                    <Icon name="chevron-right" type="material-community" size={20} color={COLORS.gray} />
                  </TouchableOpacity>

                  {showParentPicker && (
                    <View style={styles.inlinePicker}>
                      {mainCategories.filter((c) => !c.is_deleted).map((cat) => (
                        <TouchableOpacity
                          key={cat.id}
                          style={[styles.pickerItem, selectedCategory?.id === cat.id && styles.pickerItemActive]}
                          onPress={() => { setSelectedCategory(cat); setShowParentPicker(false); }}
                        >
                          <Icon name={cat.icon_name} type={cat.icon_type} size={14} color={selectedCategory?.id === cat.id ? COLORS.white : COLORS.primary} />
                          <Text style={[styles.pickerItemText, selectedCategory?.id === cat.id && styles.pickerItemTextActive]}>
                            {cat.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </>
              )}
            </View>

            {/* Error */}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {/* Delete (edit mode) */}
            {isEditing && (
              <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                <Icon name="trash-can-outline" type="material-community" size={18} color={COLORS.red2} />
                <Text style={styles.deleteBtnText}>Delete Category</Text>
              </TouchableOpacity>
            )}

            <View style={{ height: 120 }} />
          </ScrollView>

          {/* Icon picker sheet */}
          <BottomSheetModal
            ref={bottomSheetModalRef}
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
        </View>
      </BottomSheetModalProvider>
    </Provider>
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
    headerBtn: { padding: 4 },
    headerTitle: { ...FONTS.h3, fontWeight: "600", color: COLORS.primary },

    // Icon hero
    iconHero: {
      alignItems: "center",
      paddingVertical: SIZES.padding,
    },
    iconCircle: {
      width: 80, height: 80, borderRadius: 24,
      justifyContent: "center", alignItems: "center",
    },
    iconHint: {
      ...FONTS.body4, fontSize: 12, color: COLORS.darkgray, marginTop: SIZES.base,
    },

    // Details
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

    // Options card
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

    // Inline picker
    inlinePicker: {
      flexDirection: "row", flexWrap: "wrap", gap: SIZES.base,
      paddingHorizontal: SIZES.padding * 0.7, paddingBottom: SIZES.base + 4,
    },
    pickerItem: {
      flexDirection: "row", alignItems: "center", gap: 6,
      paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.white,
    },
    pickerItemActive: { backgroundColor: COLORS.primary },
    pickerItemText: { ...FONTS.body4, fontWeight: "500", color: COLORS.primary },
    pickerItemTextActive: { color: COLORS.white },

    // Error
    errorText: { ...FONTS.body4, color: COLORS.red2, marginTop: SIZES.base, marginLeft: 4 },

    // Delete
    deleteBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 6, marginTop: SIZES.padding, paddingVertical: SIZES.base + 4,
    },
    deleteBtnText: { ...FONTS.body3, color: COLORS.red2, fontWeight: "500" },

    // Icon picker sheet
    sheetContent: { flex: 1, alignItems: "center" },
    iconPickerItem: {
      width: 50, height: 50, borderRadius: 14, margin: 5,
      justifyContent: "center", alignItems: "center", backgroundColor: COLORS.lightGray,
    },
    iconPickerSearch: {
      backgroundColor: COLORS.white, color: COLORS.primary, width: 370,
    },
  });

export default CategoryInputScreen;
