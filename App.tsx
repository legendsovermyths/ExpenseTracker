import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { useFonts } from "expo-font";
import { supabase } from "./services/Supabase";
import { invokeBackend } from "./services/api";
import { Action } from "./types/actions/actions";
import { useExpensifyStore } from "./store/store";
import AppNavigator from "./screens/AppNavigator";
import AuthNavigator from "./screens/AuthNavigator";
import { NavigationContainer } from "@react-navigation/native";
import { ReloadContext } from "./contexts/ReloadContext";

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [initializing, setInitializing] = useState(true);
  const [fontsLoaded] = useFonts({
    "Roboto-Black": require("./assets/fonts/Roboto-Black.ttf"),
    "Roboto-Bold": require("./assets/fonts/Roboto-Bold.ttf"),
    "Roboto-Regular": require("./assets/fonts/Roboto-Regular.ttf"),
    CredFont: require("./assets/fonts/CredFont.ttf"),
    "CredFont-Bold": require("./assets/fonts/CredFont-Bold.ttf"),
  });

  const setAccounts = useExpensifyStore((state) => state.setAccounts);
  const setCategories = useExpensifyStore((state) => state.setCategories);
  const setTransactions = useExpensifyStore((state) => state.setTransactions);
  const setAppconstants = useExpensifyStore((state) => state.setAppconstants);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const reloadData = useCallback(async () => {
    setInitializing(true);
    try {
      const response = await invokeBackend(Action.GetData, {});
      setAccounts(response.additions.accounts || []);
      setCategories(response.additions.categories || []);
      setTransactions(response.additions.transactions || []);
      setAppconstants(response.additions.appconstants || []);
    } finally {
      setInitializing(false);
    }
  }, [setAccounts, setCategories, setTransactions, setAppconstants]);

  useEffect(() => {
    if (session?.user) {
      reloadData();
    }
  }, [session, reloadData]);

  if (!fontsLoaded || initializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  return (
    <ReloadContext.Provider value={reloadData}>
      <NavigationContainer>
        {session?.user ? <AppNavigator /> : <AuthNavigator />}
      </NavigationContainer>
    </ReloadContext.Provider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
