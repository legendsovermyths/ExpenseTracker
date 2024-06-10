import React, { useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image
} from "react-native";
import { COLORS, FONTS, SIZES, icons } from "../constants";
import CustomFAB from "../components/CustomFAB";
import { DataContext } from "../contexts/DataContext";
import {deleteAccountFromDatabase} from "../services/DbUtils"
import { formatAmountWithCommas } from "../services/Utils";
import { ListItem, Icon, Button } from '@rneui/themed';
import { useNavigation } from "@react-navigation/native";
import { i } from "mathjs";
import { deleteCategory } from "../services/CategoryService";

const CategoryEditScreen = () => {
  const { banks, updateBanks, mainCategories,updateMainCategories  } = useContext(DataContext);
  console.log(mainCategories);
  const navigation = useNavigation();

  const handleDeletion = async(reset, id) => {
    console.log(id);
    const updatedMainCategory = await deleteCategory(id, mainCategories);
    updateMainCategories(updatedMainCategory);
    reset();
  };
  const handleEdit = (reset, category) => {
    console.log(category);
    navigation.navigate("EditCategory", { category: category });
    reset();
  }
  const handleGoBack = () =>{
    
    navigation.pop();
  }
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
        <View style={{marginBottom:5}}>
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
          Categories
        </Text>
       <ScrollView>
      {mainCategories.map((item) => (
        <ListItem.Swipeable 
        onPress={()=>{console.log(item.name);}}
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
              onPress={() => handleDeletion(reset, item.id)}
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
            <ListItem.Title style={{color:COLORS.primary,...FONTS.body3}}>{item.name}</ListItem.Title>
          </ListItem.Content>
          <ListItem.Chevron />
        </ListItem.Swipeable>
      ))}
    </ScrollView>
        
      </View>

    </View>
  );
};

export default CategoryEditScreen;
