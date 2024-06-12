import React, {
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  View,
  StyleSheet,
  Text,
  Keyboard,
  TouchableOpacity,
  Image,
  TextInputComponent,
} from "react-native";
import {
  TextInput,
  Menu,
  Provider,
  DefaultTheme,
  Button,
} from "react-native-paper";
import { IconPicker } from "@grassper/react-native-icon-picker";
import { COLORS, SIZES, FONTS, icons } from "../constants";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Icon, CheckBox } from "@rneui/themed";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetModalProvider,
} from "@gorhom/bottom-sheet";
import { addCategory, convertAndFilterUndeletedAndMainCategories, editCategory } from "../services/CategoryService";
import { DataContext } from "../contexts/DataContext";
const packageToIconsetMapping = {
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
const CategoryInputScreen = () => {
  route = useRoute()
  let category = null;
  if(route.params) {
    category = route.params.category;
  }
  const {  categories,updateCategories } =
    useContext(DataContext);
  const mainCategories = convertAndFilterUndeletedAndMainCategories(categories);
  const bottomSheetModalRef = useRef(null);
  const [isSubcategory, setIsSubcategory] = useState(category?category.is_subcategory:0);
  const [showCategoryMenu, setCategoryMenu] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(category?category.parent_category:null);
  const [name, setName] = useState(category?category.name:"");
  const [error, setError] = useState("");
  const navigation = useNavigation();
  const snapPoints = useMemo(() => ["90%", "90%"], []);
  const handlePresentModalPress = useCallback(() => {
    bottomSheetModalRef.current?.present();
  }, []);
  const handleSheetChanges = useCallback((index) => {
  }, []);
  const [selectedIcon, setSelectedIcon] = useState(category?
    {
      name:category.icon_name,
      color:COLORS.primary,
      type:category.icon_type
    }
    :{
    name: "help",
    color: COLORS.primary,
    type: "ionicon",
  });
  const handleEditCategory = async() =>{
    const editedCategory = {
      name: name,
      parent_category: isSubcategory == 1 ? selectedCategory : name,
      icon_name: selectedIcon.name,
      icon_type: selectedIcon.type,
      is_subcategory: isSubcategory,
      id : category.id
    };
    const updatedCategories =await editCategory(editedCategory, categories);
    console.log(updatedCategories);
    updateCategories({...updatedCategories});
    navigation.pop();
  }
  const handleSubmit = (id, iconName, iconSet, iconColor, backgroundColor) => {
    setSelectedIcon({
      name: iconSet,
      color: COLORS.primary,
      type: packageToIconsetMapping[iconColor],
    });
    bottomSheetModalRef.current?.dismiss();
  };
  const toggleIsSubcategory = () => {
    setIsSubcategory(!isSubcategory);
  };
  const handleAddCategory = async () => {
    if (!name.trim() || (isSubcategory == 1 && !selectedCategory)) {
      setError("Please fill in all the required fields");
      return;
    }
    //TODO:include check for duplicate categories
    const newCategory = {
      name: name,
      parent_category: isSubcategory == 1 ? selectedCategory : name,
      icon_name: selectedIcon.name,
      icon_type: selectedIcon.type,
      is_subcategory: isSubcategory,
    };
    console.log(newCategory);
    const updatedCategories = await addCategory(
      newCategory,
      categories, 
    );
    updateCategories({...updatedCategories}); 
    navigation.pop();
  };
  const handleCancelInput = () => {
    navigation.pop();
  };
  const handleCategoryMenuPopUp = () => {
    setCategoryMenu(true);
    Keyboard.dismiss();
  };
  const handleSelectCategory = (selectedCategory) => {
    setSelectedCategory(selectedCategory);
    setCategoryMenu(false);
  };
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
  return (
    <Provider>
      <BottomSheetModalProvider>
        <View
          style={{
            flex: 1,
            backgroundColor: COLORS.white,
            paddingTop: (5 * SIZES.padding) / 2,
          }}
        >
          <View
            style={{
              paddingHorizontal: SIZES.padding,
              backgroundColor: COLORS.white,
            }}
          >
            <TouchableOpacity onPress={handleCancelInput}>
              <Image
                source={icons.back_arrow}
                style={{ width: 30, height: 30, tintColor: COLORS.primary }}
              />
            </TouchableOpacity>
            <Text
              style={{
                marginTop: SIZES.padding,
                marginLeft: SIZES.padding / 6,
                color: COLORS.primary,
                ...FONTS.h1,
              }}
            >
              {category?"Edit Category":"Add New Category"}
            </Text>
          </View>

          <View style={styles.container}>
            <TextInput
              mode="outlined"
              outlineColor={COLORS.primary}
              activeOutlineColor={COLORS.primary}
              label="Name"
              value={name}
              onChangeText={setName}
              style={[styles.input, { backgroundColor: COLORS.white }]}
              theme={{ roundness: 30 }}
            />
            <TouchableOpacity onPress={handlePresentModalPress}>
              <View style={styles.iconContainer}>
                <Text style={styles.iconLabel}>Icon: </Text>
                <Icon
                  name={selectedIcon.name}
                  type={selectedIcon.type}
                  color={selectedIcon.color}
                  size={30}
                  borderRadius={30}
                  padding={5}
                />
              </View>
            </TouchableOpacity>
            <CheckBox
              checked={isSubcategory}
              onPress={toggleIsSubcategory}
              title="This is a sub-category"
              iconType="material-community"
              checkedIcon="checkbox-marked"
              uncheckedIcon="checkbox-blank-outline"
              checkedColor={COLORS.primary}
            />
            {isSubcategory ? (
              <TouchableOpacity onPress={() => handleCategoryMenuPopUp()}>
                <Menu
                  visible={showCategoryMenu}
                  onDismiss={() => setCategoryMenu(false)}
                  theme={menuTheme}
                  anchor={
                    <Button
                      onPress={() => handleCategoryMenuPopUp()}
                      style={styles.menuButton}
                    >
                      <Text style={{ color: COLORS.black }}>
                        {selectedCategory
                          ? selectedCategory
                          : "Select Parent Category"}
                      </Text>
                    </Button>
                  }
                  style={{ width: 200 }}
                >
                  {mainCategories.map((category) => (
                    <Menu.Item
                      key={category.name}
                      onPress={() => handleSelectCategory(category.name)}
                      title={category.name}
                    />
                  ))}
                </Menu>
              </TouchableOpacity>
            ) : null}
            {error ? (
              <Text
                style={{ color: COLORS.red, marginBottom: 20, marginLeft: 10 }}
              >
                {error}
              </Text>
            ) : null}

            {category?<Button
              mode="contained"
              onPress={handleEditCategory}
              style={styles.addButton}
            >
              Edit Category
            </Button>:<Button
              mode="contained"
              onPress={handleAddCategory}
              style={styles.addButton}
            >
              Add Category
            </Button>}
            <BottomSheetModal
              ref={bottomSheetModalRef}
              index={0}
              snapPoints={snapPoints}
              onChange={handleSheetChanges}
            >
              <BottomSheetView style={styles.contentContainer}>
                {/* <View style={styles.modalContainer}>
      <View style={styles.iconPickerContainer}> */}
                <IconPicker
                  searchTitle={""}
                  iconsTitle=""
                  numColumns={6}
                  iconSize={25}
                  iconColor={COLORS.primary}
                  backgroundColor={COLORS.darkgray}
                  placeholderText="Search Food, shopping .."
                  placeholderTextColor={COLORS.primary}
                  onClick={handleSubmit}
                  iconContainerStyle={styles.iconContainerModal}
                  textInputStyle={styles.textInputStyle}
                />
                {/* </View>
    </View> */}
              </BottomSheetView>
            </BottomSheetModal>
          </View>
        </View>
      </BottomSheetModalProvider>
    </Provider>
  );
};

const styles = StyleSheet.create({
  contentContainer: {
    flex: 1,
    alignItems: "center",
  },
  iconContainer: {
    paddingHorizontal: SIZES.padding,
    backgroundColor: COLORS.lightGray2,
    alignItems: "center",
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 30,
    marginTop: 20,
    marginBottom: 20,
    borderColor: COLORS.primary,
  },
  iconLabel: {
    marginBottom: 12,
    color: COLORS.primary,
    marginTop: 12,
    ...FONTS.body3,
  },
  container: {
    flex: 1,
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding,
    backgroundColor: COLORS.white,
  },
  input: {
    borderRadius: 20,
  },
  addButton: {
    marginTop: 20,
    backgroundColor: COLORS.primary,
    borderRadius: 20,
  },
  menuButton: {
    borderColor: COLORS.primary,
    borderRadius: 30,
    borderWidth: 1,
    backgroundColor: COLORS.white,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 20,
  },
  cancelButton: {
    marginTop: 20,
    backgroundColor: "transparent",
    borderRadius: 20,
    color: COLORS.red2,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: COLORS.white,
  },
  iconPickerContainer: {
    flex: 1,
  },
  iconContainerModal: {
    width: 50,
    height: 50,
    borderRadius: 50,
    margin: 5,
    justifyContent: "center",
    marginTop: 20,
    alignItems: "center",
    backgroundColor: COLORS.gray,
  },
  textInputStyle: {
    backgroundColor: COLORS.white,
    color: COLORS.primary,
    width: 370,
  },
  flatList: {
    alignItems: "center",
  },
});

export default CategoryInputScreen;
