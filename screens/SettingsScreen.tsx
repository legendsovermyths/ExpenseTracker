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
  const { COLORS, activeTheme } = useTheme();
  const [syncing, setSyncing] = useState(false);
  const lastSynced = useExpensifyStore((state) => state.getAppconstantByKey("lastSynced"));
  const updateLastSynced = useExpensifyStore((state) => state.updateAppconstant);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const reloadData = useContext(ReloadContext);

  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const importToBackend = async (base64Archive: string) => {
    await importData(base64Archive);
  };

  const makeLastSynced = (timestamp) => ({
    id: lastSynced.id,
    value: timestamp,
    key: lastSynced.key,
  });

  const syncDataToCloud = useCallback(async () => {
    setSyncing(true);
    // Persist the new lastSynced into the DB *before* exporting, so the
    // uploaded backup contains the current timestamp (not the previous one).
    const previousLastSynced = lastSynced;
    const timestamp = new Date().toLocaleString();
    const newLastSynced = makeLastSynced(timestamp);
    try {
      await updateAppconstant(newLastSynced);
      const exportBase64 = await exportData();
      const buffer = Buffer.from(exportBase64, "base64");
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) throw new Error("Not signed in");
      const filePath = `${user.id}/backup.exp`;
      const { error: uploadErr } = await supabase.storage
        .from("exports")
        .upload(filePath, buffer, { upsert: true, contentType: "application/zip" });
      if (uploadErr) throw uploadErr;
      updateLastSynced(newLastSynced);
      setSnackbarMessage("Sync successful");
      setSnackbarVisible(true);
    } catch (err: any) {
      // Roll back the timestamp we wrote so the DB doesn't claim a sync that failed.
      await updateAppconstant(previousLastSynced).catch(() => {});
      setSnackbarMessage(err.message || "Sync failed");
      setSnackbarVisible(true);
    } finally {
      setSyncing(false);
    }
  }, [lastSynced]);

  const exportOffline = useCallback(async () => {
    try {
      const exportBase64 = await exportData();
      const fileName = `backup-${Date.now()}.exp`;
      const path = `${RNFS.DocumentDirectoryPath}/${fileName}`;
      await RNFS.writeFile(path, exportBase64, "base64");
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
      await importToBackend(base64);
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
      await importToBackend(Buffer.from(arrayBuffer).toString("base64"));
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

  const SettingItem = ({ icon, title, subtitle = null, onPress, showChevron = true, rightElement = null }) => (
    <TouchableOpacity style={styles.item} onPress={onPress} activeOpacity={0.7}>
      <Icon name={icon} type="material-community" size={22} color={COLORS.ink} />
      <View style={styles.itemContent}>
        <Text style={styles.itemTitle}>{title}</Text>
        {subtitle && <Text style={styles.itemSubtitle}>{subtitle}</Text>}
      </View>
      {rightElement || (showChevron && (
        <Icon name="chevron-right" type="material-community" size={22} color={COLORS.inkMuted} />
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
          icon="qrcode"
          title="My QR Code"
          subtitle="Share to let friends add you"
          onPress={() => navigation.navigate("MyQRCode")}
        />
        <SettingItem
          icon="qrcode-scan"
          title="Add Friend"
          subtitle="Scan a friend's QR code"
          onPress={() => navigation.navigate("ScanFriendQR")}
        />
        <SettingItem
          icon="palette-outline"
          title="Appearance"
          subtitle={activeTheme.name}
          onPress={() => navigation.navigate("Appearance")}
        />

        {/* Data */}
        <Text style={styles.sectionTitle}>Data</Text>
        <SettingItem
          icon="bank-outline"
          title="Accounts"
          subtitle={`${Object.values(useExpensifyStore.getState().accounts).filter((a: any) => !a.is_deleted).length} accounts`}
          onPress={() => navigation.navigate("Banks")}
        />
        <SettingItem
          icon="bookmark-outline"
          title="Categories"
          onPress={() => navigation.navigate("ViewCategory")}
        />
        <SettingItem
          icon="chart-box-outline"
          title="Category Budgets"
          subtitle="Set spending limits per category"
          onPress={() => navigation.navigate("CategoryBudgets")}
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
        <SettingItem
          icon="paperclip"
          title="Documents"
          subtitle="Bills, receipts and warranties"
          onPress={() => navigation.navigate("Documents")}
        />

        {/* Backup */}
        <Text style={styles.sectionTitle}>Backup</Text>
        <SettingItem
          icon="cloud-upload-outline"
          title="Sync to Cloud"
          subtitle={syncing ? "Syncing..." : lastSynced?.value || "Not synced"}
          onPress={syncDataToCloud}
          rightElement={syncing ? <ActivityIndicator size="small" color={COLORS.ink} /> : null}
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
        <Text style={[styles.sectionTitle, { color: COLORS.deltaUp }]}>Danger Zone</Text>
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
        <Text style={styles.snackbarText}>{snackbarMessage}</Text>
      </Snackbar>
    </View>
  );
}

const createStyles = (COLORS: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.paper,
  },
  header: {
    paddingHorizontal: SIZES.padding,
    paddingTop: SIZES.padding * 2.5,
    paddingBottom: SIZES.padding,
  },
  headerTitle: {
    ...FONTS.h1,
    color: COLORS.ink,
  },
  content: {
    flex: 1,
    paddingHorizontal: SIZES.padding,
  },
  sectionTitle: {
    ...FONTS.body4,
    color: COLORS.inkMuted,
    marginTop: SIZES.padding,
    marginBottom: SIZES.base,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: SIZES.padding/2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surface1,
  },
  itemContent: {
    flex: 1,
    marginLeft: SIZES.padding,
  },
  itemTitle: {
    ...FONTS.body3,
    color: COLORS.ink,
  },
  itemSubtitle: {
    ...FONTS.body4,
    color: COLORS.inkMuted,
    marginTop: 2,
  },
  snackbar: {
    backgroundColor: COLORS.ink,
  },
  snackbarText: {
    color: COLORS.paper,
  },
});
