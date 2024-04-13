import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import TransactionScreen from './TransactionScreen';
import BankScreen from './BankScreen';
import SubscriptionScreen from './SubscriptionScreen';
import { COLORS, FONTS, SIZES, icons, images } from "../constants";
const Tab = createBottomTabNavigator();
import {
    SafeAreaView,
    StyleSheet,
    ScrollView,
    View,
    Text,
    StatusBar,
    Image,
    ImageBackground,
    TouchableOpacity,
    FlatList,
    Animated,
    Platform,
  } from "react-native";
  const styles = StyleSheet.create({
    NavigationIcon: {
      width: 30,
      height: 30,
      resizeMode: "contain",
    },
  });
const AppNavigator = () => {
  return (
    <NavigationContainer>
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconSource;
          if (route.name === 'Transactions') {
            iconSource = icons.transfer_money
          } else if (route.name === 'Banks') {
            iconSource = icons.bank2
          } else if (route.name === 'Subscriptions') {
            iconSource = icons.subscription
          }
          return <Image source={iconSource} style={{ width: 25, height: 25, tintColor: color }} />;
        },
        headerShown: false,
      })}
      tabBarOptions={{
        activeTintColor: COLORS.primary, 
        inactiveTintColor: COLORS.darkgray,
      }}>
      <Tab.Screen name="Transactions" component={TransactionScreen} />
      <Tab.Screen name="Banks" component={BankScreen} />
      <Tab.Screen name="Subscriptions" component={SubscriptionScreen} />
    </Tab.Navigator>
  </NavigationContainer>
  );
};

export default AppNavigator;