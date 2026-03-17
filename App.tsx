import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { useFonts } from "expo-font";
import * as Notifications from 'expo-notifications';
import LoadingScreen from "./screens/LoadingScreen";
import { supabase } from "./services/Supabase";
import { invokeBackend } from "./services/api";
import { requestSync } from "./services/BackgroundSync";
import { updateAppconstant } from "./services/Appconstants";
import { monthlyReportScheduler } from "./services/MonthlyReportScheduler";
import { sendMonthlyReportEmail } from "./services/MonthlyReportEmail";

import { useExpensifyStore } from "./store/store";
import { Action } from "./types/actions/actions";
import { Appconstant } from "./types/entity/Appconstant";

import AppNavigator from "./screens/AppNavigator";
import AuthNavigator from "./screens/AuthNavigator";
import { ReloadContext } from "./contexts/ReloadContext";
import { ThemeProvider } from "./contexts/ThemeContext";

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

export default function App() {
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

  const setAccounts = useExpensifyStore((s) => s.setAccounts);
  const setCategories = useExpensifyStore((s) => s.setCategories);
  const setTransactions = useExpensifyStore((s) => s.setTransactions);
  const setAppconstants = useExpensifyStore((s) => s.setAppconstants);
  const setUserBalances = useExpensifyStore((s) => s.setUserBalances);
  const setUserId = useExpensifyStore((s) => s.setUserId);
  const setUserEmail = useExpensifyStore((s) => s.setUserEmail);
  const setUserName = useExpensifyStore((s) => s.setUserName);
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      setSession(currentSession);
      if (currentSession?.user) {
        setUserId(currentSession.user.id);
        setUserEmail(currentSession.user.email);
        setUserName(currentSession.user.user_metadata?.full_name || "");
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

      await initSync(getAppconstant("lastSplitSync", additions.appconstants));
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

  useEffect(() => {
    if (authChecked) reloadData();
  }, [authChecked, session, reloadData]);

  // Initialize notification system
  useEffect(() => {
    // Set up notification listener
    const notificationListener = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        // Create a callback that uses the current store data
        const sendEmailCallback = async () => {
          try {
            const transactionsById = useExpensifyStore.getState().transactions;
            const accountsById = useExpensifyStore.getState().accounts;
            const categoriesById = useExpensifyStore.getState().categories;
            const monthlyBalance = parseInt(
              useExpensifyStore.getState().getAppconstantByKey("balance").value
            );
            const userEmail = useExpensifyStore.getState().getUserEmail();
            
            await sendMonthlyReportEmail(
              Object.values(transactionsById),
              accountsById,
              categoriesById,
              monthlyBalance,
              userEmail
            );
          } catch (error) {
            console.error('Error sending monthly report email:', error);
          }
        };
        
        await monthlyReportScheduler.handleNotificationResponse(response, sendEmailCallback);
      }
    );

    // Initialize the monthly report scheduler when user is authenticated
    if (session?.user) {
      monthlyReportScheduler.initialize();
    }

    return () => {
      notificationListener.remove();
    };
  }, [session]);

  const appIsReady = fontsLoaded && authChecked && dataReady;

  return (
    <ThemeProvider>
      {!appIsReady ? (
        <LoadingScreen />
      ) : (
        <ReloadContext.Provider value={reloadData}>
          <NavigationContainer>
            {session?.user ? <AppNavigator /> : <AuthNavigator />}
          </NavigationContainer>
        </ReloadContext.Provider>
      )}
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
