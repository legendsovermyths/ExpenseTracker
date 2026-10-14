import { Alert } from "react-native";
import { useExpensifyStore } from "../store/store";
import { Action } from "../types/actions/actions";
import { Friend } from "../types/entity/Friend";
import { invokeBackend } from "./api";
import { supabase } from "./Supabase";

export const FRIEND_LINK_SCHEME = "expensifyfinance";
const FRIEND_LINK_HOST = "add-friend";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface FriendInvite {
  id: string;
  name: string;
}

export const buildFriendLink = (id: string, name: string) =>
  `${FRIEND_LINK_SCHEME}://${FRIEND_LINK_HOST}?id=${encodeURIComponent(id)}&name=${encodeURIComponent(name)}`;

const readParam = (query: string, key: string) => {
  for (const part of query.split("&")) {
    const [k, v = ""] = part.split("=");
    if (decodeURIComponent(k) === key) {
      return decodeURIComponent(v.replace(/\+/g, " "));
    }
  }
  return "";
};

export const parseFriendLink = (url: string | null | undefined): FriendInvite | null => {
  if (!url) return null;
  const match = url
    .trim()
    .match(new RegExp(`^${FRIEND_LINK_SCHEME}://${FRIEND_LINK_HOST}/?\\?(.*)$`, "i"));
  if (!match) return null;
  const id = readParam(match[1], "id");
  if (!UUID_RE.test(id)) return null;
  return { id, name: readParam(match[1], "name").trim() };
};

// Prefer the server-side name so a tampered QR can't spoof someone else's name.
export const resolveFriendName = async (invite: FriendInvite) => {
  try {
    const { data } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", invite.id)
      .maybeSingle();
    if (data?.full_name) return data.full_name as string;
  } catch {
    /* offline – fall back to the name in the QR */
  }
  return invite.name || "Friend";
};

export const addFriend = async (friend: Friend): Promise<Friend> => {
  const response = await invokeBackend(Action.AddFriend, { friend });
  if (response.status === "error") throw new Error(response.message);
  return response.additions?.friends?.[0] ?? friend;
};

export const deleteFriend = async (friendId: string) => {
  const response = await invokeBackend(Action.DeleteFriend, { friend_id: friendId });
  if (response.status === "error") throw new Error(response.message);
};

export type InviteOutcome = "added" | "already" | "self" | "cancelled" | "failed";

/** Confirms with the user, then stores the friend locally. */
export const acceptFriendInvite = (invite: FriendInvite): Promise<InviteOutcome> =>
  new Promise(async (resolve) => {
    const state = useExpensifyStore.getState();
    if (invite.id === state.userId) {
      Alert.alert("That's you!", "This QR code belongs to your own account.");
      return resolve("self");
    }
    const existing = state.friends[invite.id];
    if (existing) {
      Alert.alert("Already friends", `${existing.name} is already in your friend list.`);
      return resolve("already");
    }
    const name = await resolveFriendName(invite);
    Alert.alert("Add friend", `Add ${name} to your friends so you can split expenses?`, [
      { text: "Cancel", style: "cancel", onPress: () => resolve("cancelled") },
      {
        text: "Add",
        onPress: async () => {
          try {
            const saved = await addFriend({
              id: invite.id,
              name,
              added_at: new Date().toISOString(),
            });
            useExpensifyStore.getState().upsertFriend(saved);
            resolve("added");
          } catch (e: any) {
            Alert.alert("Couldn't add friend", e?.message ?? "Please try again.");
            resolve("failed");
          }
        },
      },
    ], { cancelable: true, onDismiss: () => resolve("cancelled") });
  });
