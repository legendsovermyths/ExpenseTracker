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
} from "react-native";
import {
  TextInput,
  Menu,
  Provider,
  DefaultTheme,
  Button,
} from "react-native-paper";
import { IconPicker } from '@grassper/react-native-icon-picker';
import { COLORS, SIZES, FONTS, icons } from "../constants";
import { useNavigation } from "@react-navigation/native";
import { Icon } from "react-native-elements";
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetModalProvider,
} from "@gorhom/bottom-sheet";

const CategoryInputScreen = () => {
  const bottomSheetModalRef = useRef(null);
  const snapPoints = useMemo(() => ["90%", "90%"], []);
  const handlePresentModalPress = useCallback(() => {
    bottomSheetModalRef.current?.present();
  }, []);
  const handleSheetChanges = useCallback((index) => {
    console.log("handleSheetChanges", index);
  }, []);
  const [selectedIcon, setSelectedIcon] = useState({
    name: "new-label",
    color: COLORS.primary,
    type: "material",
  });
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const navigation = useNavigation();
  const handleSubmit = (id, iconName, iconSet, iconColor, backgroundColor) => {
    console.log({ id, iconName, iconSet, iconColor, backgroundColor });
  };
  const handleAddCategory = () => {
    console.log("add category");
  };
  const handleCancelInput = () => {
    navigation.pop();
  };
  return (
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
            Add New Category
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
              <Text style={styles.iconLabel}>Selected Icon: </Text>
              <Icon
                name={selectedIcon.name}
                type={selectedIcon.type}
                color={selectedIcon.color}
                size={30}
              />
            </View>
          </TouchableOpacity>

          {error ? (
            <Text
              style={{ color: COLORS.red, marginBottom: 20, marginLeft: 10 }}
            >
              {error}
            </Text>
          ) : null}

          <Button
            mode="contained"
            onPress={handleAddCategory}
            style={styles.addButton}
          >
            Add Category
          </Button>
          <BottomSheetModal
            ref={bottomSheetModalRef}
            index={1}
            snapPoints={snapPoints}
            onChange={handleSheetChanges}
          >
            <BottomSheetView style={styles.contentContainer}>
            {/* <View style={styles.modalContainer}>
      <View style={styles.iconPickerContainer}> */}
            <IconPicker
          searchTitle={'Name'}
          iconsTitle="Icons"
          numColumns={6}
          iconSize={20}
          iconColor={COLORS.primary}
          backgroundColor='#121212'
          placeholderText="Search Food, shopping .."
          placeholderTextColor="#555"
          onClick={handleSubmit}
          iconContainerStyle={styles.iconContainerModal}
         
        />
         {/* </View>
    </View> */}
            </BottomSheetView>
          </BottomSheetModal>
        </View>
      </View>
    </BottomSheetModalProvider>
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
    borderColor: COLORS.primary,
  },
  iconLabel: {
    marginBottom: 10,
    color: COLORS.primary,
    marginTop: 10,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
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
    justifyContent: 'center',
    padding:20,
    backgroundColor: '#000',
  },
  iconPickerContainer:{
    flex:1
  },
  iconContainerModal: {
    width: 50,
    height: 50,
    borderRadius: 50,
    margin: 5,
    justifyContent: 'center',
    marginTop: 20,
    alignItems: 'center',
    backgroundColor: '#121212',
  },
});

export default CategoryInputScreen;
