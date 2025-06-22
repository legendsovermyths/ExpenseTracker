import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from "react-native";
import { COLORS, FONTS, SIZES, icons } from "../constants";
import { Icon } from "@rneui/themed";
import { useNavigation } from "@react-navigation/native";
import { useExpensifyStore } from "../store/store";

const CategoryEditScreen = () => {
  const categoriesById = useExpensifyStore((state) => state.categories);
  const categories = Object.values(categoriesById);
  const undeletedCategories = categories.filter(
    (category) => !category.is_deleted,
  );
  const navigation = useNavigation();

  const handleEdit = (category) => {
    navigation.navigate("EditCategory", { category: category });
  };

  const handleGoBack = () => {
    navigation.pop();
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
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{ marginBottom: 9 * SIZES.padding/2 }}
        >
          {undeletedCategories.length != 0 ? (
            undeletedCategories.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => handleEdit(item)}
                activeOpacity={1}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 15,
                  paddingHorizontal: 4,
                  borderBottomWidth: 1,
                  borderBottomColor: COLORS.lightGray,
                }}
              >
                <Icon
                  name={item.icon_name}
                  type={item.icon_type}
                  color={COLORS.primary}
                />
                <View style={{ flex: 1, marginLeft: 15 }}>
                  <Text style={{ color: COLORS.primary, ...FONTS.body3 }}>
                    {item.name}
                  </Text>
                </View>
                <Icon
                  name="chevron-right"
                  type="material"
                  color={COLORS.primary}
                  size={20}
                />
              </TouchableOpacity>
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
