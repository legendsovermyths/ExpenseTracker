import React, { useCallback, useContext, useState, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Icon } from "@rneui/themed";
import { Text, ActivityIndicator, Snackbar } from "react-native-paper";
import { FONTS, SIZES } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
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

export default function SettingsScreen() {
  const navigation: any = useNavigation();
  const { COLORS, isDark } = useTheme();
  const [syncing, setSyncing] = useState(false);
  const lastSynced = useExpensifyStore((state) => state.getAppconstantByKey("lastSynced"));
  const updateLastSynced = useExpensifyStore((state) => state.updateAppconstant);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const reloadData = useContext(ReloadContext);

  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const importToBackend = async (byteArray: Uint8Array) => {
    await importData(byteArray);
  };

  const makeLastSynced = (timestamp) => ({
    id: lastSynced.id,
    value: timestamp,
    key: lastSynced.key,
  });

  const syncDataToCloud = useCallback(async () => {
    setSyncing(true);
    try {
      const exportBytes = await exportData();
      const buffer = Buffer.from(exportBytes);
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) throw new Error("Not signed in");
      const filePath = `${user.id}/backup.exp`;
      const { error: uploadErr } = await supabase.storage
        .from("exports")
        .upload(filePath, buffer, { upsert: true, contentType: "application/zip" });
      if (uploadErr) throw uploadErr;
      const timestamp = new Date().toLocaleString();
      const newLastSynced = makeLastSynced(timestamp);
      await updateAppconstant(newLastSynced);
      updateLastSynced(newLastSynced);
      setSnackbarMessage("Sync successful");
      setSnackbarVisible(true);
    } catch (err: any) {
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
      await Share.open({ url: `file://${path}`, type: "application/zip", saveToFiles: true });
      setSnackbarMessage("Exported");
      setSnackbarVisible(true);
    } catch (err: any) {
      setSnackbarMessage(err.message || "Export failed");
      setSnackbarVisible(true);
    }
  }, []);

  const importFromLocal = useCallback(async () => {
    try {
      const [file] = await pick({ mode: "open", type: "com.apple.symbol-export" });
      const destinationPath = `${RNFS.DocumentDirectoryPath}/${file.name}`;
      const base64 = await RNFS.readFile(destinationPath, "base64");
      const byteArray = Buffer.from(base64, "base64");
      await importToBackend(Uint8Array.from(byteArray));
      reloadData();
      setSnackbarMessage("Imported");
      setSnackbarVisible(true);
    } catch (err: any) {
      setSnackbarMessage(err.message || "Import failed");
      setSnackbarVisible(true);
    }
  }, []);

  const importFromCloud = useCallback(async () => {
    try {
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) throw new Error("Not signed in");
      const filePath = `${user.id}/backup.exp`;
      const { data: urlData, error: urlErr } = await supabase.storage
        .from("exports")
        .createSignedUrl(filePath, 3600);
      if (urlErr || !urlData?.signedUrl) throw urlErr || new Error("Failed to get URL");
      const response = await fetch(urlData.signedUrl);
      if (!response.ok) throw new Error("Download failed");
      const arrayBuffer = await response.arrayBuffer();
      await importToBackend(Uint8Array.from(Buffer.from(arrayBuffer)));
      reloadData();
      setSnackbarMessage("Restored from cloud");
      setSnackbarVisible(true);
    } catch (err: any) {
      setSnackbarMessage(err.message || "Restore failed");
      setSnackbarVisible(true);
    }
  }, []);

  const handleLogout = async () => {
    await deleteData();
    supabase.auth.signOut();
  };

  const handleRestore = useCallback(() => {
    Alert.alert("Restore Data", "Choose source:", [
      { text: "Local", onPress: () => Alert.alert("Confirm", "Overwrite current data?", [
        { text: "Cancel", style: "cancel" },
        { text: "Restore", style: "destructive", onPress: importFromLocal }
      ])},
      { text: "Cloud", onPress: () => Alert.alert("Confirm", "Overwrite current data?", [
        { text: "Cancel", style: "cancel" },
        { text: "Restore", style: "destructive", onPress: importFromCloud }
      ])},
      { text: "Cancel", style: "cancel" },
    ]);
  }, [importFromLocal, importFromCloud]);

  const deleteAllData = async () => {
    try {
      await deleteData();
      reloadData();
      setSnackbarMessage("Data deleted");
      setSnackbarVisible(true);
    } catch (err: any) {
      setSnackbarMessage(err.message || "Delete failed");
      setSnackbarVisible(true);
    }
  };

  const SettingItem = ({ icon, title, subtitle, onPress, showChevron = true, rightElement = null }) => (
    <TouchableOpacity style={styles.item} onPress={onPress} activeOpacity={0.7}>
      <Icon name={icon} type="material-community" size={22} color={COLORS.primary} />
      <View style={styles.itemContent}>
        <Text style={styles.itemTitle}>{title}</Text>
        {subtitle && <Text style={styles.itemSubtitle}>{subtitle}</Text>}
      </View>
      {rightElement || (showChevron && (
        <Icon name="chevron-right" type="material-community" size={22} color={COLORS.darkgray} />
      ))}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Account */}
        <Text style={styles.sectionTitle}>Account</Text>
        <SettingItem
          icon="account-outline"
          title="Profile"
          onPress={() => navigation.navigate("ProfileDetail")}
        />
        <SettingItem
          icon="theme-light-dark"
          title="Appearance"
          subtitle={isDark ? "Dark" : "Light"}
          onPress={() => navigation.navigate("Appearance")}
        />

        {/* Data */}
        <Text style={styles.sectionTitle}>Data</Text>
        <SettingItem
          icon="bookmark-outline"
          title="Categories"
          onPress={() => navigation.navigate("ViewCategory")}
        />
        <SettingItem
          icon="cash"
          title="Monthly Budget"
          onPress={() => navigation.navigate("BalanceEditScreen")}
        />
        <SettingItem
          icon="file-document-outline"
          title="Reports"
          onPress={() => navigation.navigate("ExpenditureReports")}
        />

        {/* Backup */}
        <Text style={styles.sectionTitle}>Backup</Text>
        <SettingItem
          icon="cloud-upload-outline"
          title="Sync to Cloud"
          subtitle={syncing ? "Syncing..." : lastSynced?.value || "Not synced"}
          onPress={syncDataToCloud}
          rightElement={syncing ? <ActivityIndicator size="small" color={COLORS.primary} /> : null}
        />
        <SettingItem
          icon="download-outline"
          title="Export"
          onPress={exportOffline}
        />
        <SettingItem
          icon="restore"
          title="Restore"
          onPress={handleRestore}
        />

        {/* Danger */}
        <Text style={[styles.sectionTitle, { color: COLORS.red2 }]}>Danger Zone</Text>
        <SettingItem
          icon="delete-outline"
          title="Delete All Data"
          onPress={() => Alert.alert("Delete Data", "This will delete all local data.", [
            { text: "Cancel", style: "cancel" },
            { text: "Delete", style: "destructive", onPress: deleteAllData }
          ])}
        />
        <SettingItem
          icon="logout"
          title="Log Out"
          onPress={() => Alert.alert("Log Out", "Make sure you've synced your data.", [
            { text: "Cancel", style: "cancel" },
            { text: "Log Out", style: "destructive", onPress: handleLogout }
          ])}
        />

        <View style={{ height: 40 }} />
      </ScrollView>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={2000}
        style={styles.snackbar}
      >
        {snackbarMessage}
      </Snackbar>
    </View>
  );
}

const createStyles = (COLORS: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding * 2.5,
    paddingBottom: SIZES.padding,
  },
  headerTitle: {
    ...FONTS.h1,
    color: COLORS.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: SIZES.padding,
  },
  sectionTitle: {
    ...FONTS.body4,
    color: COLORS.darkgray,
    marginTop: SIZES.padding,
    marginBottom: SIZES.base,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SIZES.padding,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.lightGray,
  },
  itemContent: {
    flex: 1,
    marginLeft: SIZES.padding,
  },
  itemTitle: {
    ...FONTS.body3,
    color: COLORS.primary,
  },
  itemSubtitle: {
    ...FONTS.body4,
    color: COLORS.darkgray,
    marginTop: 2,
  },
  snackbar: {
    backgroundColor: COLORS.primary,
  },
});
