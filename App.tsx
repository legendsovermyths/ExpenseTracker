import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, AppState, View, StyleSheet, Linking, NativeModules } from "react-native";
import { NavigationContainerRef, NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import * as Notifications from 'expo-notifications';
import LoadingScreen from "./screens/LoadingScreen";
import { supabase } from "./services/Supabase";
import { invokeBackend } from "./services/api";
import { requestSync, requestFundSync } from "./services/BackgroundSync";
import { updateAppconstant } from "./services/Appconstants";
import { fetchUserBalances } from "./services/Splits";
import { fetchFunds } from "./services/Funds";
import {
  fetchNotificationsSince,
  getLocalNotifications,
  getUnreadNotificationCount,
  registerForPushNotifications,
  subscribeToNotifications,
  syncNotificationsToLocal,
  unsubscribeFromNotifications,
} from "./services/Notifications";
import { monthlyReportScheduler, MonthlyReportScheduler } from "./services/MonthlyReportScheduler";
import { sendMonthlyReportEmail } from "./services/MonthlyReportEmail";

import { useExpensifyStore } from "./store/store";
import { Action } from "./types/actions/actions";
import { Appconstant } from "./types/entity/Appconstant";

import AppNavigator from "./screens/AppNavigator";
import { refreshAttachmentOwners } from "./services/Attachments";
import AuthNavigator from "./screens/AuthNavigator";
import { ReloadContext } from "./contexts/ReloadContext";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { ToastHost } from "./components/ui";
import { acceptFriendInvite, parseFriendLink } from "./services/FriendService";

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

// Pulls notifications created since the last checkpoint into the local
// mirror. Same shape as `initSync` above, but one-way (server -> client).
async function initNotificationSync(
  userId: string,
  lastNotificationSync: Appconstant | undefined,
) {
  if (!lastNotificationSync) return;
  try {
    const fetched = await fetchNotificationsSince(userId, lastNotificationSync.value);
    await syncNotificationsToLocal(fetched);
    if (fetched.length > 0) {
      const newest = fetched
        .map((n) => n.created_at)
        .sort()
        .pop();
      if (newest) {
        await updateAppconstant({ ...lastNotificationSync, value: newest });
      }
    }
  } catch {
    /* silent fail – same tolerance as split sync */
  }
}

const navigationRef = React.createRef<NavigationContainerRef<any>>();

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [pendingShare, setPendingShare] = useState<{ uris: string[]; action: string | null } | null>(null);
  const isFirstLoad = useRef(true);


  const setAccounts = useExpensifyStore((s) => s.setAccounts);
  const setCategories = useExpensifyStore((s) => s.setCategories);
  const setTransactions = useExpensifyStore((s) => s.setTransactions);
  const setTransactionsLoadedSince = useExpensifyStore((s) => s.setTransactionsLoadedSince);
  const setAppconstants = useExpensifyStore((s) => s.setAppconstants);
  const setUserBalances = useExpensifyStore((s) => s.setUserBalances);
  const setCategoryBudgets = useExpensifyStore((s) => s.setCategoryBudgets);
  const setFriends = useExpensifyStore((s) => s.setFriends);
  const [pendingLink, setPendingLink] = useState<string | null>(null);
  const setUserId = useExpensifyStore((s) => s.setUserId);
  const setUserEmail = useExpensifyStore((s) => s.setUserEmail);
  const setUserName = useExpensifyStore((s) => s.setUserName);
  const setNotifications = useExpensifyStore((s) => s.setNotifications);
  const mergeNotifications = useExpensifyStore((s) => s.mergeNotifications);
  const setUnreadNotificationCount = useExpensifyStore((s) => s.setUnreadNotificationCount);

  const appIsReady = authChecked && dataReady;

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
      // Only the last 6 months of transactions are loaded eagerly — the same
      // "everything is just there" feel as before for the common case.
      // Anything older is fetched on demand (see services/TransactionWindow.ts).
      const now = new Date();
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      const transactionsSince = sixMonthsAgo.toISOString();

      const response = await invokeBackend(Action.GetData, {
        transactions_since: transactionsSince,
      });

      const additions = response.additions ?? {};

      setTransactions(additions.transactions ?? []);
      setTransactionsLoadedSince(transactionsSince);
      setAppconstants(additions.appconstants ?? []);
      setAccounts(additions.accounts ?? []);
      setCategories(additions.categories ?? []);
      setUserBalances(additions.user_balances ?? []);
      setCategoryBudgets(additions.category_budgets ?? []);
      setFriends(additions.friends ?? []);
      refreshAttachmentOwners().catch((e) => console.warn("attachment owners", e));

      await initSync(getAppconstant("lastSplitSync", additions.appconstants));

      const userId = useExpensifyStore.getState().getUserId();
      if (userId) {
        await initNotificationSync(
          userId,
          getAppconstant("lastNotificationSync", additions.appconstants),
        );
        const [localNotifications, unreadCount] = await Promise.all([
          getLocalNotifications(200),
          getUnreadNotificationCount(),
        ]);
        setNotifications(localNotifications);
        setUnreadNotificationCount(unreadCount);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDataReady(true);
      isFirstLoad.current = false;
    }
  }, [
    setTransactions,
    setTransactionsLoadedSince,
    setAppconstants,
    setAccounts,
    setCategories,
    setUserBalances,
    setCategoryBudgets,
    setNotifications,
    setUnreadNotificationCount,
    setFriends,
  ]);

  useEffect(() => {
    if (authChecked) reloadData();
  }, [authChecked, session, reloadData]);

  // Push token registration + Realtime live-update subscription. Runs once
  // data is ready and the user is signed in; the "notifications" table +
  // channel is the shared plumbing every feature (splits today, Kitty next)
  // rides on for a live update instead of waiting for the next screen focus.
  useEffect(() => {
    if (!session?.user || !dataReady) return;
    const userId = session.user.id;

    registerForPushNotifications(userId).catch((e) => {
      // Permission denied, or the device can't register with APNs at all
      // (Simulators always fail here — real push only works on a real
      // device with the Push Notifications capability signed in). Logged,
      // not swallowed, so this failure is at least visible during testing.
      console.warn("[push] registration failed:", e?.message ?? e);
    });

    const channel = subscribeToNotifications(userId, (row) => {
      mergeNotifications([row]);
      setUnreadNotificationCount(useExpensifyStore.getState().unreadNotificationCount + 1);
      syncNotificationsToLocal([row]).catch((e) =>
        console.warn("[notifications] local sync failed:", e?.message ?? e),
      );

      // A notification means *some* underlying data changed (a split, a
      // fund entry) — pull it in and push it straight into the store so
      // whatever screen happens to be mounted updates immediately, instead
      // of only refreshing when that screen next gains focus.
      const lastSplitSync = useExpensifyStore.getState().getAppconstantByKey("lastSplitSync");
      requestSync(lastSplitSync?.value)
        .then(async (newestTime) => {
          if (lastSplitSync) await updateAppconstant({ ...lastSplitSync, value: newestTime });
          const balances = await fetchUserBalances();
          useExpensifyStore.getState().setUserBalances(balances);
        })
        .catch((e) => console.warn("[notifications] split refresh failed:", e?.message ?? e));

      const lastFundSync = useExpensifyStore.getState().getAppconstantByKey("lastFundSync");
      requestFundSync(lastFundSync?.value)
        .then(async (newestTime) => {
          if (lastFundSync) await updateAppconstant({ ...lastFundSync, value: newestTime });
          const funds = await fetchFunds(userId);
          useExpensifyStore.getState().setFunds(funds);
        })
        .catch((e) => console.warn("[notifications] fund refresh failed:", e?.message ?? e));
    });

    return () => {
      unsubscribeFromNotifications();
    };
  }, [session, dataReady, mergeNotifications, setUnreadNotificationCount]);

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
      // New multi-image bridge returns paths[]; fall back to legacy single path.
      const paths: string[] = data?.paths ?? (data?.path ? [data.path] : []);
      if (paths.length === 0) return;
      Notifications.cancelScheduledNotificationAsync("expensify-pending-share").catch(() => {});
      const uris = paths.map((p) => `file://${p}`);
      const action: string | null = data.action ?? null;
      const screen = action === 'split' ? 'SplitPartner' : 'SharedImage';
      const params = action === 'split' ? { imageUris: uris } : { imageUris: uris, action };
      if (navigationRef.current?.isReady()) {
        (navigationRef.current.navigate as any)(screen, params);
      } else {
        setPendingShare({ uris, action });
      }
    } catch {
      // SharedImage module not available (Android / simulator)
    }
  };

  // Execute any share that arrived before the navigator was mounted
  useEffect(() => {
    if (appIsReady && pendingShare && navigationRef.current?.isReady()) {
      const { uris, action } = pendingShare;
      const screen = action === 'split' ? 'SplitPartner' : 'SharedImage';
      const params  = action === 'split' ? { imageUris: uris } : { imageUris: uris, action };
      (navigationRef.current.navigate as any)(screen, params);
      setPendingShare(null);
    }
  }, [appIsReady, pendingShare]);

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

  // Friend QR codes open the app via deep link (works from the system camera too).
  useEffect(() => {
    Linking.getInitialURL().then((url) => url && setPendingLink(url));
    const sub = Linking.addEventListener("url", ({ url }) => setPendingLink(url));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!pendingLink || !appIsReady || !session?.user) return;
    const invite = parseFriendLink(pendingLink);
    setPendingLink(null);
    if (!invite) return;
    acceptFriendInvite(invite).then((outcome) => {
      if (outcome === "added" && navigationRef.current?.isReady()) {
        (navigationRef.current.navigate as any)("SearchPeople");
      }
    });
  }, [pendingLink, appIsReady, session]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          {!appIsReady ? (
            <LoadingScreen />
          ) : (
            <ReloadContext.Provider value={reloadData}>
              <ThemedNavigation>
                <BottomSheetModalProvider>
                  {session?.user ? <AppNavigator /> : <AuthNavigator />}
                </BottomSheetModalProvider>
              </ThemedNavigation>
            </ReloadContext.Provider>
          )}
          <ToastHost />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Feeds the active palette to react-navigation (screen/transition
// backgrounds, headers) and keeps the status bar legible on every theme.
function ThemedNavigation({ children }: { children: React.ReactNode }) {
  const { COLORS, isDark } = useTheme();
  const navTheme = React.useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      dark: isDark,
      colors: {
        ...base.colors,
        primary: COLORS.accent,
        background: COLORS.paper,
        card: COLORS.paper,
        text: COLORS.ink,
        border: COLORS.hairline,
        notification: COLORS.accentWarm,
      },
    };
  }, [COLORS, isDark]);

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <StatusBar style={isDark ? "light" : "dark"} />
      {children}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
