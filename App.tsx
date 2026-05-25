import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, View, StyleSheet, Linking, NativeModules } from "react-native";
import Constants from "expo-constants";
import { NavigationContainerRef } from "@react-navigation/native";
import { NavigationContainer } from "@react-navigation/native";
import { useFonts } from "expo-font";
import * as Notifications from 'expo-notifications';
import LoadingScreen from "./screens/LoadingScreen";
import { supabase } from "./services/Supabase";
import { invokeBackend } from "./services/api";
import { requestSync } from "./services/BackgroundSync";
import { updateAppconstant } from "./services/Appconstants";
import { monthlyReportScheduler, MonthlyReportScheduler } from "./services/MonthlyReportScheduler";
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

const navigationRef = React.createRef<NavigationContainerRef<any>>();

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [pendingShare, setPendingShare] = useState<{ uri: string; action: string | null } | null>(null);
  const isFirstLoad = useRef(true);

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
  const setCategoryBudgets = useExpensifyStore((s) => s.setCategoryBudgets);
  const setUserId = useExpensifyStore((s) => s.setUserId);
  const setUserEmail = useExpensifyStore((s) => s.setUserEmail);
  const setUserName = useExpensifyStore((s) => s.setUserName);

  const appIsReady = fontsLoaded && authChecked && dataReady;

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
    if (isFirstLoad.current) setDataReady(false);
    try {
      const response = await invokeBackend(Action.GetData, {});

      const additions = response.additions ?? {};

      setTransactions(additions.transactions ?? []);
      setAppconstants(additions.appconstants ?? []);
      setAccounts(additions.accounts ?? []);
      setCategories(additions.categories ?? []);
      setUserBalances(additions.user_balances ?? []);
      setCategoryBudgets(additions.category_budgets ?? []);

      await initSync(getAppconstant("lastSplitSync", additions.appconstants));
    } catch (err) {
      console.error(err);
    } finally {
      setDataReady(true);
      isFirstLoad.current = false;
    }
  }, [
    setTransactions,
    setAppconstants,
    setAccounts,
    setCategories,
    setUserBalances,
    setCategoryBudgets,
  ]);

  useEffect(() => {
    if (authChecked) reloadData();
  }, [authChecked, session, reloadData]);

  // Initialize notification system
  useEffect(() => {
    // Set up notification listener
    const notificationListener = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        // Notification tapped while app was backgrounded/closed — open SharedImageScreen.
        if (response.notification.request.identifier === "expensify-pending-share") {
          handleSharedImage();
          return;
        }

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
        
        // Build summary for next month's notification
        const txns = Object.values(useExpensifyStore.getState().transactions);
        const cats = useExpensifyStore.getState().categories;
        const summary = MonthlyReportScheduler.buildMonthlySummary(txns, cats);

        await monthlyReportScheduler.handleNotificationResponse(response, sendEmailCallback, summary);
      }
    );

    // Initialize the monthly report scheduler when user is authenticated
    if (session?.user && dataReady) {
      const txns = Object.values(useExpensifyStore.getState().transactions);
      const cats = useExpensifyStore.getState().categories;
      const summary = MonthlyReportScheduler.buildMonthlySummary(txns, cats);
      monthlyReportScheduler.initialize(summary);
    }

    return () => {
      notificationListener.remove();
    };
  }, [session, dataReady]);

  // Reads the pending share written by the iOS share extension.
  // Uses navigationRef.isReady() (a ref — always current, safe in stale closures)
  // so the AppState listener below can call this without needing to be re-registered.
  const handleSharedImage = async () => {
    try {
      const data = await NativeModules.SharedImage?.getPendingShareData();
      if (!data?.path) return;
      Notifications.cancelScheduledNotificationAsync("expensify-pending-share").catch(() => {});
      const uri = `file://${data.path}`;
      const action: string | null = data.action ?? null;
      const screen = action === 'split' ? 'SplitPartner' : 'SharedImage';
      const params = action === 'split' ? { imageUri: uri } : { imageUri: uri, action };
      if (navigationRef.current?.isReady()) {
        navigationRef.current.navigate(screen as never, params as never);
      } else {
        setPendingShare({ uri, action });
      }
    } catch {
      // SharedImage module not available (Android / simulator)
    }
  };

  // Execute any share that arrived before the navigator was mounted
  useEffect(() => {
    if (appIsReady && pendingShare && navigationRef.current?.isReady()) {
      const { uri, action } = pendingShare;
      const screen = action === 'split' ? 'SplitPartner' : 'SharedImage';
      const params  = action === 'split' ? { imageUri: uri } : { imageUri: uri, action };
      navigationRef.current.navigate(screen as never, params as never);
      setPendingShare(null);
    }
  }, [appIsReady, pendingShare]);

  // Write the Gemini key to shared App Group storage so the share extension can read it.
  useEffect(() => {
    const key = Constants.expoConfig?.extra?.geminiApiKey;
    if (key) NativeModules.SharedImage?.setGeminiApiKey(key);
  }, []);

  useEffect(() => {
    // Check on mount: handles cold-start and AppState-based detection.
    handleSharedImage();

    // Cold-start via notification tap: the response is delivered before
    // addNotificationResponseReceivedListener is registered, so we check it explicitly.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response?.notification.request.identifier === "expensify-pending-share") {
        handleSharedImage();
      }
    });

    // App becomes active after user manually returns to Expensify
    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") handleSharedImage();
    });

    // URL scheme fallback
    const urlSubscription = Linking.addEventListener("url", ({ url }) => {
      if (url === "expensify://share") handleSharedImage();
    });

    return () => {
      appStateSubscription.remove();
      urlSubscription.remove();
    };
  }, []);

  return (
    <ThemeProvider>
      {!appIsReady ? (
        <LoadingScreen />
      ) : (
        <ReloadContext.Provider value={reloadData}>
          <NavigationContainer ref={navigationRef}>
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
