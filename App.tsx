import React, {
  useCallback,
  useEffect,
  useState,
} from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { useFonts } from "expo-font";

import { supabase } from "./services/Supabase";
import { invokeBackend } from "./services/api";
import { requestSync } from "./services/BackgroundSync";
import { updateAppconstant } from "./services/Appconstants";

import { useExpensifyStore } from "./store/store";
import { Action } from "./types/actions/actions";
import { Appconstant } from "./types/entity/Appconstant";

import AppNavigator from "./screens/AppNavigator";
import AuthNavigator from "./screens/AuthNavigator";
import { ReloadContext } from "./contexts/ReloadContext";
/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

const getAppconstant = (
  key: string,
  list: Appconstant[] | undefined,
): Appconstant | undefined => list?.find((c) => c.key === key);

async function initSync(lastSupabaseSync: Appconstant | undefined) {
  if (!lastSupabaseSync) return;
  try {
    const newestTime = await requestSync(lastSupabaseSync.value); // pull + push
    await updateAppconstant({
      ...lastSupabaseSync,
      value: newestTime,
    });
  } catch {
    /* silent fail – stale cache is OK for now */
  }
}


/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */

export default function App() {
  /* -------------------------------------------------------------- */
  /*  Local state                                                   */
  /* -------------------------------------------------------------- */
  const [session, setSession] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [dataReady, setDataReady] = useState(false);

  const [fontsLoaded] = useFonts({
    "Roboto-Black": require("./assets/fonts/Roboto-Black.ttf"),
    "Roboto-Bold": require("./assets/fonts/Roboto-Bold.ttf"),
    "Roboto-Regular": require("./assets/fonts/Roboto-Regular.ttf"),
    CredFont: require("./assets/fonts/CredFont.ttf"),
    "CredFont-Bold": require("./assets/fonts/CredFont-Bold.ttf"),
  });

  /* -------------------------------------------------------------- */
  /*  Store setters                                                 */
  /* -------------------------------------------------------------- */
  const setAccounts = useExpensifyStore((s) => s.setAccounts);
  const setCategories = useExpensifyStore((s) => s.setCategories);
  const setTransactions = useExpensifyStore((s) => s.setTransactions);
  const setAppconstants = useExpensifyStore((s) => s.setAppconstants);
  const setUserBalances = useExpensifyStore((s) => s.setUserBalances);
  const setUserId = useExpensifyStore((s) => s.setUserId);

  /* -------------------------------------------------------------- */
  /*  Auth listener – single source of truth                        */
  /* -------------------------------------------------------------- */
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      setSession(currentSession);

      if (currentSession?.user) {
        setUserId(currentSession.user.id);
      }

      if (event === "INITIAL_SESSION") {
        setAuthChecked(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [setUserId]);

  const reloadData = useCallback(async () => {
    setDataReady(false);
    try {
      const response = await invokeBackend(Action.GetData, {});

      const additions = response.additions ?? {};

      setTransactions(additions.transactions ?? []);
      setAppconstants(additions.appconstants ?? []);
      setAccounts(additions.accounts ?? []);
      setCategories(additions.categories ?? []);
      setUserBalances(additions.user_balances ?? []);

      await initSync(
        getAppconstant("lastSplitSync", additions.appconstants),
      );
    } catch (err) {
      console.error(err);
    } finally {
      setDataReady(true);
    }
  }, [
    setTransactions,
    setAppconstants,
    setAccounts,
    setCategories,
    setUserBalances,
  ]);

  /* kick off bootstrap once auth is confirmed (and any time user switches) */
  useEffect(() => {
    if (authChecked) reloadData();
  }, [authChecked, session, reloadData]);

  /* -------------------------------------------------------------- */
  /*  Render                                                        */
  /* -------------------------------------------------------------- */
  const appIsReady = fontsLoaded && authChecked && dataReady;

  if (!appIsReady) {
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

/* ------------------------------------------------------------------ */
/*  Styles                                                           */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
