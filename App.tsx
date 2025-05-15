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
import { requestSync } from "./services/BackgroundSync";
import { updateAppconstant } from "./services/Appconstants";
import { Appconstant } from "./types/entity/Appconstant";

const getAppconstant = (
  key: string,
  list: Appconstant[],
): Appconstant | undefined => list.find((c) => c.key === key);

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [initializing, setInitializing] = useState(true);
  const [sessionLoading, setSessionLoading] = useState(true);
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
  const setUserBalances = useExpensifyStore((state) => state.setUserBalances);
  const setUserId = useExpensifyStore((state) => state.setUserId);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if(session.user){
        setUserId(session.user.id);
      }
      setSession(session);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    setSessionLoading(false);
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function initSync(lastSupabaseSync: Appconstant) {
    try {
      const newestTime = await requestSync(lastSupabaseSync.value);
      const updatedSync: Appconstant = {
        id: lastSupabaseSync.id,
        key: lastSupabaseSync.key,
        value: newestTime,
      };
      await updateAppconstant(updatedSync);
    } catch (e) {
      // silent fail; UI keeps working with old cache
    }
  }
  const reloadData = useCallback(async () => {
    try {
      const response = await invokeBackend(Action.GetData, {});
      const additions = response.additions ?? {};
      setTransactions(additions.transactions ?? []);
      setAppconstants(additions.appconstants ?? []);
      setAccounts(additions.accounts ?? []);
      setCategories(additions.categories ?? []);
      setUserBalances(additions.user_balances ?? []);
      const lastSplitSync: Appconstant = getAppconstant(
        "lastSplitSync",
        additions.appconstants,
      );
      initSync(lastSplitSync);
    } catch (err) {
      console.log(err);
    } finally {
      setInitializing(false);
    }
  }, [setAccounts, setCategories, setTransactions, setAppconstants]);

  useEffect(() => {
    reloadData();
  }, [session, reloadData]);

  if (!fontsLoaded || initializing || sessionLoading || !session) {
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
