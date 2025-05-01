import React from 'react';
import { createStackNavigator } from "@react-navigation/stack";
import ProfileScreen from './ProfileScreen';
import SignUpScreen from './SignUpScreen';
import EmailVerificationScreen from './EmailVerificationScreen';

// Define params for auth stack
export type AuthStackParamList = {
  Profile: undefined;
  SignUp: { name: string; phone: string };
  OTPScreen: { name: string; phone: string; email: string };
};

const Stack = createStackNavigator<AuthStackParamList>();

export default function AuthNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Profile"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="OTPScreen" component={EmailVerificationScreen} />
    </Stack.Navigator>
  );
}
