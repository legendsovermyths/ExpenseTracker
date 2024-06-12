import React, { useContext, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from "react-native";
import { COLORS, FONTS, SIZES, icons } from "../constants";
import { DataContext } from "../contexts/DataContext";
import { ListItem, Icon, Button } from "@rneui/themed";
import { useNavigation, useRoute } from "@react-navigation/native";
import { deleteCategory } from "../services/CategoryService";

function convertAndFilterCategories(categoriesObj) {
    return Object.keys(categoriesObj)
        .filter(key => categoriesObj[key].deleted !== 1)
        .map(key => {
            return {
                id: key,
                ...categoriesObj[key]
            };
        });
}


const CategoryEditScreen = () => {
  const {categories, updateCategories } =
    useContext(DataContext);
  console.log(categories);
 const list = convertAndFilterCategories(categories);
  const navigation = useNavigation();
  const handleDeletionCategory = async (reset, id) => {
    const updatedCategories = await deleteCategory(id, categories);
    updateCategories({...updatedCategories});
    reset();
  };

  const handleEdit = (reset, category) => {
    console.log(category);
    navigation.navigate("EditCategory", { category: category});
    reset();
  };
  const handleGoBack = () => {
      navigation.pop();
  };
  const handlePress = (item) => {
    console.log(item);
    
  };
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.white }}>
      {/* Header section */}
      <View
        style={{
          paddingHorizontal: SIZES.padding,
          paddingTop: (5 * SIZES.padding) / 2,
          backgroundColor: COLORS.white,
        }}
      >
        <View style={{ marginBottom: 5 }}>
          <TouchableOpacity onPress={handleGoBack}>
            <Image
              source={icons.back_arrow}
              style={{ width: 30, height: 30, tintColor: COLORS.primary }}
            />
          </TouchableOpacity>
        </View>
        <Text
          style={{
            marginLeft: SIZES.padding / 6,
            color: COLORS.primary,
            ...FONTS.h1,
          }}
        >
          {"Categories"}
        </Text>
        <ScrollView showsVerticalScrollIndicator={false} style={{marginBottom:3*SIZES.padding}}>
          {list.length != 0 ? (
            list.map((item) => (
              <ListItem.Swipeable
                onPress={() => handlePress(item)}
                key={item.id}
                containerStyle={{ paddingLeft: 4 }}
                leftContent={(reset) => (
                  <Button
                    title="Edit"
                    onPress={() => handleEdit(reset, item)}
                    icon={{ name: "edit", color: "white" }}
                    buttonStyle={{ minHeight: "100%", marginRight: 10 }}
                  />
                )}
                rightContent={(reset) => (
                  <Button
                    title="Delete"
                    onPress={() =>
                       handleDeletionCategory(reset, item.id)
                    }
                    icon={{ name: "delete", color: "white" }}
                    buttonStyle={{
                      minHeight: "100%",
                      backgroundColor: COLORS.red,
                      marginLeft: 10,
                    }}
                  />
                )}
              >
                <Icon
                  name={item.icon_name}
                  type={item.icon_type}
                  color={COLORS.primary}
                />
                <ListItem.Content>
                  <ListItem.Title
                    style={{ color: COLORS.primary, ...FONTS.body3 }}
                  >
                    {item.name}
                  </ListItem.Title>
                </ListItem.Content>
                <ListItem.Chevron />
              </ListItem.Swipeable>
            ))
          ) : (
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
                marginTop: 200,
              }}
            >
              <Text style={{ color: COLORS.primary, ...FONTS.body3 }}>
                You have no categories
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
};

export default CategoryEditScreen;
