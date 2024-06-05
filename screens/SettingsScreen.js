import React, { useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { ListItem, Icon } from '@rneui/themed';
import { COLORS, FONTS, SIZES } from "../constants";
import { useNavigation } from "@react-navigation/native";

const settings=[{
  title:"View/Delete Category",
  icon_name:"bookmark",
  id:1
},{title:"Delete all data", icon_name:"delete",id:2}]
const SettingsScreen = () => {
  const navigation=useNavigation()
  const handlePress = (id) => { 
    console.log(id);
    switch (id) {
      case 1:
        navigation.navigate("EditCatagory")
        
        break;
    
      default:
        break;
    }
  }
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.white }}>
      <View
        style={{
          paddingHorizontal: SIZES.padding,
          paddingTop: (5 * SIZES.padding) / 2,
          backgroundColor: COLORS.white,
        }}
      >
        <Text
          style={{
            marginLeft: SIZES.padding / 6,
            color: COLORS.primary,
            ...FONTS.h1,
          }}
        >
          Settings
        </Text>
        <View style={{marginTop:20}}>
        {settings.map((item) => (
          <TouchableOpacity onPress={()=>{handlePress(item.id)}}>
        <ListItem key={item.id} containerStyle={{ padding: 0 , marginVertical:5}}>
        
        <Icon size={30} name={item.icon_name} type="material-community" color={COLORS.primary} />
        <ListItem.Content>
          <ListItem.Title><Text style={{...FONTS.body2}}>{item.title}</Text></ListItem.Title>
        </ListItem.Content>
        <ListItem.Chevron />
      </ListItem>
      </TouchableOpacity>
      ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  accountCard: {
    backgroundColor: COLORS.lightGray,
    borderRadius: 10,
    padding: SIZES.padding,
    marginTop: SIZES.padding,
    elevation: 3,
    position: "relative",
  },
  accountName: {
    ...FONTS.h3,
    color: COLORS.darkgray,
    marginBottom: 5,
  },
  balanceText: {
    ...FONTS.body3,
    color: COLORS.darkgreen,
  },
  deleteButton: {
    position: "absolute",
    top: SIZES.padding / 2,
    right: SIZES.padding / 2,
    backgroundColor: COLORS.lightGray,
    padding: 5,
    borderRadius: 5,
  },
  deleteText: {
    color: COLORS.red2,
    ...FONTS.body4,
  },
});

export default SettingsScreen;
