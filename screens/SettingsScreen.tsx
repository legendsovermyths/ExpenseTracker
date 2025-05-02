import React, { useCallback, useContext, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  ListRenderItemInfo,
  Alert,
} from "react-native";
import { ListItem, Icon } from "@rneui/themed";
import { Text, ActivityIndicator, Snackbar } from "react-native-paper";
import { COLORS, FONTS, SIZES } from "../constants";
import { useNavigation } from "@react-navigation/native";
import { supabase } from "../services/Supabase";
import { Buffer } from "buffer";
import { deleteData, exportData, importData } from "../services/Features";
import Share from "react-native-share";
import RNFS from "react-native-fs";
import { pick } from "@react-native-documents/picker";
import { ReloadContext } from "../contexts/ReloadContext";
import { useExpensifyStore } from "../store/store";
import { updateAppconstant } from "../services/Appconstants";

type SettingItem = {
  id:
  | "profile"
  | "viewCategory"
  | "deleteAll"
  | "editBudget"
  | "logout"
  | "restore"
  | "export"
  | "sync";
  title: string;
  icon: string;
};

const SETTINGS: SettingItem[] = [
  { id: "profile", title: "View Profile", icon: "account-circle" },
  { id: "viewCategory", title: "View / Delete Category", icon: "bookmark" },
  { id: "deleteAll", title: "Delete All Data", icon: "delete" },
  { id: "editBudget", title: "Edit Monthly Budget", icon: "cash" },
  { id: "logout", title: "Log Out", icon: "logout" },
  { id: "restore", title: "Restore Data", icon: "restore" },
  { id: "export", title: "Export Offline", icon: "download" },
  { id: "sync", title: "Sync to Cloud", icon: "cloud-upload" },
];

export default function SettingsScreen() {
  const navigation: any = useNavigation();
  const [syncing, setSyncing] = useState(false);
  const lastSynced = useExpensifyStore((state)=>state.getAppconstantByKey("lastSynced"));
  const updateLastSynced = useExpensifyStore((state) => state.updateAppconstant);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const reloadData = useContext(ReloadContext);

  const importToBackend = async (byteArray: Uint8Array) => {
    await importData(byteArray);
  };

  const makeLastSynced = (timestamp) => {
    return {
      id: lastSynced.id,
      value: timestamp,
      key: lastSynced.key
    }
  }
  const syncDataToCloud = useCallback(async () => {
    setSyncing(true);
    try {
      const exportBytes = await exportData();
      const buffer = Buffer.from(exportBytes);
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (userErr || !user) {
        throw new Error("Not signed in");
      }
      const filePath = `${user.id}/backup.exp`;
      const { data, error: uploadErr } = await supabase.storage
        .from("exports")
        .upload(filePath, buffer, {
          upsert: true,
          contentType: "application/zip",
        });
      if (uploadErr) {
        throw uploadErr;
      }
      const timestamp = new Date().toLocaleString();
      const newLastSynced = makeLastSynced(timestamp);
      await updateAppconstant(newLastSynced);
      updateLastSynced(newLastSynced);
      setSnackbarMessage("Sync successful");
      setSnackbarVisible(true);
    } catch (err: any) {
      console.error("syncDataToCloud error", err);
      setSnackbarMessage(err.message || "Sync failed");
      setSnackbarVisible(true);
    } finally {
      setSyncing(false);
    }
  }, []);

  const exportOffline = useCallback(async () => {
    try {
      const exportBytes = await exportData();
      const buffer = Buffer.from(exportBytes);
      const fileName = `backup-${Date.now()}.exp`;
      const path = `${RNFS.DocumentDirectoryPath}/${fileName}`;
      await RNFS.writeFile(path, buffer.toString("base64"), "base64");

      await Share.open({
        url: `file://${path}`,
        type: "application/zip",
        saveToFiles: true,
      });

      setSnackbarMessage(`Exported to ${fileName}`);
      setSnackbarVisible(true);
    } catch (err: any) {
      setSnackbarMessage(err.message || "Export failed");
      setSnackbarVisible(true);
    }
  }, []);

  const importFromLocal = useCallback(async () => {
    setSnackbarMessage("Restoring from local...");
    setSnackbarVisible(true);
    try {
      const [file] = await pick({
        mode: "open",
        type: "com.apple.symbol-export",
      });
      const destinationPath = `${RNFS.DocumentDirectoryPath}/${file.name}`;
      const base64 = await RNFS.readFile(destinationPath, "base64");
      const byteArray = Buffer.from(base64, "base64");
      const dataArray = Uint8Array.from(byteArray);
      await importToBackend(dataArray);
      reloadData();
      setSnackbarMessage("Import file loaded");
      setSnackbarVisible(true);
    } catch (err: any) {
      console.error("importData error", err);
      setSnackbarMessage(err.message || "Import failed");
      setSnackbarVisible(true);
    }
  }, []);

  const deleteAllData = async () => {
    await deleteData();
    reloadData();
  };

  const importFromCloud = useCallback(async () => {
    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (userErr || !user) throw new Error("Not signed in");
      const filePath = `${user.id}/backup.exp`;
      const { data: urlData, error: urlErr } = await supabase.storage
        .from("exports")
        .createSignedUrl(filePath, 60 * 60);
      if (urlErr || !urlData?.signedUrl)
        throw urlErr || new Error("Failed to get signed URL");
      const response = await fetch(urlData.signedUrl);
      if (!response.ok)
        throw new Error(`Download failed: ${response.statusText}`);
      const arrayBuffer = await response.arrayBuffer();
      const byteArray = Buffer.from(arrayBuffer);
      const dataArray = Uint8Array.from(byteArray);
      await importToBackend(dataArray);
      reloadData();
      setSnackbarMessage("Backup downloaded from cloud");
      setSnackbarVisible(true);
    } catch (err: any) {
      console.error("importFromCloud error", err);
      setSnackbarMessage(err.message || "Cloud import failed");
      setSnackbarVisible(true);
    }
  }, []);

  const handleLogout = async () => {
    await deleteData();
    supabase.auth.signOut();
  };
  const handleRestore = useCallback(() => {
    Alert.alert("Restore Data", "Choose restore source:", [
      {
        text: "Restore from Local",
        onPress: () => {
          Alert.alert(
            "Confirm Restore",
            "This will overwrite current data. Continue?",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Restore",
                style: "destructive",
                onPress: importFromLocal,
              },
            ],
          );
        },
      },
      {
        text: "Restore from Cloud",
        onPress: () => {
          Alert.alert(
            "Confirm Restore",
            "This will overwrite current data. Continue?",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Restore",
                style: "destructive",
                onPress: importFromCloud,
              },
            ],
          );
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [importFromLocal, importFromCloud]);

  const handlePress = useCallback(
    async (item: SettingItem) => {
      switch (item.id) {
        case "profile":
          navigation.navigate("ProfileDetail");
          break;
        case "viewCategory":
          navigation.navigate("ViewCategory");
          break;
        case "editBudget":
          navigation.navigate("BalanceEdit");
          break;
        case "deleteAll":
          Alert.alert(
            "Delete all data",
            "Are you sure you want to delete all the data? Your local data will be wiped out.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: async () => await deleteAllData(),
              },
            ],
          );
          break;
        case "logout":
          Alert.alert(
            "Log Out",
            "Are you sure you want to log out? Your local data will be wiped out. Make sure you have synced with cloud.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Log Out",
                style: "destructive",
                onPress: async () => await handleLogout(),
              },
            ],
          );
          break;
        case "sync":
          await syncDataToCloud();
          break;
        case "export":
          await exportOffline();
          break;
        case "restore":
          handleRestore();
          break;
      }
    },
    [navigation, syncDataToCloud, exportOffline, handleRestore],
  );

  const renderItem = ({ item }: ListRenderItemInfo<SettingItem>) => (
    <ListItem
      bottomDivider
      containerStyle={styles.listItem}
      onPress={() => handlePress(item)}
    >
      <Icon
        name={item.icon}
        type="material-community"
        size={24}
        color={COLORS.primary}
      />
      <ListItem.Content>
        <ListItem.Title style={styles.titleText}>{item.title}</ListItem.Title>
        {item.id === "sync" && (
          <View style={styles.syncInfo}>
            {syncing ? (
              <ActivityIndicator size="small" />
            ) : lastSynced ? (
              <Text style={styles.syncText}>Last synced: {lastSynced.value}</Text>
            ) : (
              <Text style={styles.syncText}>Not yet synced</Text>
            )}
          </View>
        )}
      </ListItem.Content>
      <ListItem.Chevron />
    </ListItem>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Settings</Text>
      </View>
      <FlatList
        data={SETTINGS}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
      />
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  header: {
    paddingHorizontal: SIZES.padding,
    paddingTop: (SIZES.padding * 5) / 2,
    paddingBottom: SIZES.base,
    backgroundColor: COLORS.white,
  },
  headerText: { ...FONTS.h1, color: COLORS.primary },
  list: { paddingHorizontal: SIZES.padding, paddingBottom: SIZES.padding },
  listItem: { marginVertical: SIZES.base / 2, borderRadius: 8 },
  titleText: { ...FONTS.body3 },
  syncInfo: { marginTop: 4 },
  syncText: { ...FONTS.body4, color: COLORS.gray },
});
