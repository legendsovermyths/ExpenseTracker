import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./Supabase";
import { invokeBackend } from "./api";
import {
  Action,
  GetNotificationsPayload,
  GetUnreadNotificationCountPayload,
  MarkNotificationReadPayload,
  SyncNotificationsPayload,
} from "../types/actions/actions";
import { NotificationRow } from "../types/entity/Notification";

// ---- Push token registration -------------------------------------------
// Tokens live in `push_tokens`, read only by the send-push Edge Function.
// register_push_token moves a device's token to the signed-in account, and
// logout removes it, so a shared or handed-down phone never gets another
// account's notifications.
let currentPushToken: string | null = null;

export async function registerForPushNotifications(userId: string) {
  const settings = await Notifications.getPermissionsAsync();
  let status = settings.status;
  if (status !== "granted") {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== "granted") {
    console.warn("[push] permission not granted, status:", status);
    return;
  }

  // getExpoPushTokenAsync talks to APNs under the hood — this throws if the
  // app isn't signed with the Push Notifications capability/entitlement, or
  // if it's running on a Simulator (Simulators can't register for real APNs
  // push at all; this will always fail there, that's expected, not a bug).
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const { data: tokenData } = await Notifications.getExpoPushTokenAsync({ projectId });
  currentPushToken = tokenData;

  const { error } = await supabase.rpc("register_push_token", {
    p_token: tokenData,
    p_platform: Platform.OS,
  });
  if (error) console.warn("[push] failed to save token:", error.message);
}

/** Detach this device from the account. Call before signing out. */
export async function unregisterPushToken(): Promise<void> {
  let token = currentPushToken;
  if (!token) {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  }
  const { error } = await supabase.from("push_tokens").delete().eq("token", token);
  if (error) throw error;
  currentPushToken = null;
}

// ---- Pull + local mirror -------------------------------------------------
// Same fetch-since shape as `BackgroundSync.ts`'s split sync, but one-way:
// notifications are never pushed up from the client (aside from `read_at`).
export async function fetchNotificationsSince(
  userId: string,
  since?: string,
): Promise<NotificationRow[]> {
  const query = supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (since && since !== "Never") {
    query.gte("created_at", since);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as NotificationRow[];
}

export async function syncNotificationsToLocal(notifications: NotificationRow[]) {
  if (notifications.length === 0) return;
  const payload: SyncNotificationsPayload = { notifications };
  await invokeBackend(Action.SyncNotifications, payload);
}

export async function getLocalNotifications(limit?: number) {
  const payload: GetNotificationsPayload = { limit };
  const response = await invokeBackend(Action.GetNotifications, payload);
  return (response.additions?.notifications ?? []) as NotificationRow[];
}

export async function getUnreadNotificationCount() {
  const payload: GetUnreadNotificationCountPayload = {};
  const response = await invokeBackend(Action.GetUnreadNotificationCount, payload);
  return (response.count ?? 0) as number;
}

export async function markNotificationRead(id: string) {
  const readAt = new Date().toISOString();
  await supabase.from("notifications").update({ read_at: readAt }).eq("id", id);
  const payload: MarkNotificationReadPayload = { id, read_at: readAt };
  await invokeBackend(Action.MarkNotificationRead, payload);
}

// ---- Realtime (foreground live-update path) ------------------------------
// One channel per signed-in user, filtered server-side to rows where
// `user_id = me` (RLS also enforces this independently). This is the piece
// that replaces "wait for the next screen focus" — every feature built on
// top of `notifications` (splits today, Kitty next) rides this same channel
// for free.
let activeChannel: RealtimeChannel | null = null;

export function subscribeToNotifications(
  userId: string,
  onInsert: (row: NotificationRow) => void,
) {
  if (activeChannel) {
    supabase.removeChannel(activeChannel);
    activeChannel = null;
  }

  activeChannel = supabase
    .channel(`notifications-${userId}`)
    .on(
      "postgres_changes" as any,
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      (payload: any) => onInsert(payload.new as NotificationRow),
    )
    .subscribe((status, err) => {
      // Visibility into join failures (RLS rejection, publication missing,
      // auth issue) that would otherwise look identical to "just no events
      // yet" — this was previously silent.
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.warn("[notifications realtime]", status, err?.message ?? "");
      } else {
        console.log("[notifications realtime]", status);
      }
    });

  return activeChannel;
}

export function unsubscribeFromNotifications() {
  if (activeChannel) {
    supabase.removeChannel(activeChannel);
    activeChannel = null;
  }
}
