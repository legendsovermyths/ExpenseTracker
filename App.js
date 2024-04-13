import React from 'react';
import { createStackNavigator } from "@react-navigation/stack";
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { AppNavigator } from "./screens/";
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { DataContextProvider } from './contexts/DataContext';
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

const theme = {
  ...DefaultTheme,
  colors: {
      ...DefaultTheme.colors,
      border: "transparent",
  },
};

const Stack = createStackNavigator();

function App() {
  const [loaded] = useFonts({
    "Roboto-Black" : require('./assets/fonts/Roboto-Black.ttf'),
    "Roboto-Bold" : require('./assets/fonts/Roboto-Bold.ttf'),
    "Roboto-Regular" : require('./assets/fonts/Roboto-Regular.ttf'),
  })

  if(!loaded){
    return null;
  }

  return (
    <DataContextProvider>
       <AppNavigator />
    </DataContextProvider>
    
  );
}

export default App;