import React,{useState}from 'react';
import { createStackNavigator } from "@react-navigation/stack";
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { AppNavigator } from "./screens/";
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { DataContextProvider } from './contexts/DataContext';
import InitDataComponent from './services/InitData';
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
  const [initComplete, setInitComplete] = useState(true);
  const [loaded] = useFonts({
    "Roboto-Black" : require('./assets/fonts/Roboto-Black.ttf'),
    "Roboto-Bold" : require('./assets/fonts/Roboto-Bold.ttf'),
    "Roboto-Regular" : require('./assets/fonts/Roboto-Regular.ttf'),
    "CredFont" : require('./assets/fonts/CredFont.ttf'),
    "CredFont-Bold":require('./assets/fonts/CredFont-Bold.ttf'),
  })

  if(!loaded){
    return null;
  }

  const handleInitComplete = () => {
    setInitComplete(true);
  };
  return (
    <>
     <InitDataComponent onInit={handleInitComplete}/>
    {initComplete &&   (<DataContextProvider>
          <AppNavigator />
      </DataContextProvider>)}

    </>
  );
}

export default App;