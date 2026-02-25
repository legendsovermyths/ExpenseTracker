import React, { useCallback, useContext, useState, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Icon } from "@rneui/themed";
import { Text, ActivityIndicator, Snackbar, Card } from "react-native-paper";
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
import HeaderText from "../components/HeaderText";

type SettingItem = {
  id: string;
  title: string;
  subtitle?: string;
  icon: string;
  iconColor?: string;
  onPress: () => void;
};

export default function SettingsScreen() {
  const navigation: any = useNavigation();
  const { COLORS, isDark } = useTheme();
  const [syncing, setSyncing] = useState(false);
  const userEmail = useExpensifyStore((state) => state.getUserEmail());
  const lastSynced = useExpensifyStore((state) =>
    state.getAppconstantByKey("lastSynced"),
  );
  const updateLastSynced = useExpensifyStore(
    (state) => state.updateAppconstant,
  );
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarType, setSnackbarType] = useState<"success" | "error">("success");
  const reloadData = useContext(ReloadContext);

  const importToBackend = async (byteArray: Uint8Array) => {
    await importData(byteArray);
  };

  const makeLastSynced = (timestamp) => {
    return {
      id: lastSynced.id,
      value: timestamp,
      key: lastSynced.key,
    };
  };

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
      setSnackbarType("success");
      setSnackbarVisible(true);
    } catch (err: any) {
      console.error("syncDataToCloud error", err);
      setSnackbarMessage(err.message || "Sync failed");
      setSnackbarType("error");
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
      setSnackbarType("success");
      setSnackbarVisible(true);
    } catch (err: any) {
      console.error("exportOffline error", err);
      setSnackbarMessage(err.message || "Export failed");
      setSnackbarType("error");
      setSnackbarVisible(true);
    }
  }, []);

  const importFromLocal = useCallback(async () => {
    setSnackbarMessage("Restoring from local...");
    setSnackbarType("success");
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
      setSnackbarType("success");
      setSnackbarVisible(true);
    } catch (err: any) {
      console.error("importData error", err);
      setSnackbarMessage(err.message || "Import failed");
      setSnackbarType("error");
      setSnackbarVisible(true);
    }
  }, []);

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
      setSnackbarType("success");
      setSnackbarVisible(true);
    } catch (err: any) {
      console.error("importFromCloud error", err);
      setSnackbarMessage(err.message || "Cloud import failed");
      setSnackbarType("error");
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

  const deleteAllData = async () => {
    try {
      await deleteData();
      setSnackbarMessage("All data deleted");
      setSnackbarType("success");
      setSnackbarVisible(true);
      reloadData();
    } catch (err: any) {
      console.error("deleteAllData error", err);
      setSnackbarMessage(err.message || "Delete failed");
      setSnackbarType("error");
      setSnackbarVisible(true);
    }
  };

  const accountSettings: SettingItem[] = [
    {
      id: "profile",
      title: "View Profile",
      subtitle: userEmail || "Not signed in",
      icon: "account-circle",
      iconColor: COLORS.primary,
      onPress: () => navigation.navigate("ProfileDetail"),
    },
    {
      id: "appearance",
      title: "Appearance",
      subtitle: isDark ? "Dark mode" : "Light mode",
      icon: "theme-light-dark",
      iconColor: COLORS.purple,
      onPress: () => navigation.navigate("Appearance"),
    },
  ];

  const dataSettings: SettingItem[] = [
    {
      id: "viewCategory",
      title: "Manage Categories",
      subtitle: "View & delete categories",
      icon: "bookmark",
      iconColor: COLORS.yellow,
      onPress: () => navigation.navigate("ViewCategory"),
    },
    {
      id: "editBudget",
      title: "Monthly Budget",
      subtitle: "Edit your budget limit",
      icon: "cash",
      iconColor: COLORS.darkgreen,
      onPress: () => navigation.navigate("BalanceEditScreen"),
    },
    {
      id: "expenditureReports",
      title: "Expenditure Reports",
      subtitle: "View & download reports",
      icon: "file-pdf-box",
      iconColor: COLORS.red2,
      onPress: () => navigation.navigate("ExpenditureReports"),
    },
  ];

  const backupSettings: SettingItem[] = [
    {
      id: "sync",
      title: "Sync to Cloud",
      subtitle: syncing
        ? "Syncing..."
        : lastSynced?.value
          ? `Last: ${lastSynced.value}`
          : "Not synced",
      icon: "cloud-upload",
      iconColor: COLORS.blue,
      onPress: syncDataToCloud,
    },
    {
      id: "export",
      title: "Export Offline",
      subtitle: "Save backup locally",
      icon: "download",
      iconColor: COLORS.lightBlue,
      onPress: exportOffline,
    },
    {
      id: "restore",
      title: "Restore Data",
      subtitle: "From local or cloud",
      icon: "restore",
      iconColor: COLORS.purple,
      onPress: handleRestore,
    },
  ];

  const dangerSettings: SettingItem[] = [
    {
      id: "deleteAll",
      title: "Delete All Data",
      subtitle: "Permanently remove all data",
      icon: "delete",
      iconColor: COLORS.red,
      onPress: () => {
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
      },
    },
    {
      id: "logout",
      title: "Log Out",
      subtitle: "Sign out from this device",
      icon: "logout",
      iconColor: COLORS.red2,
      onPress: () => {
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
      },
    },
  ];

  const renderSettingItem = (item: SettingItem) => (
    <TouchableOpacity
      key={item.id}
      style={styles.settingItem}
      onPress={item.onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconCircle, { backgroundColor: item.iconColor + "20" }]}>
        <Icon
          name={item.icon}
          type="material-community"
          size={24}
          color={item.iconColor || COLORS.primary}
        />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{item.title}</Text>
        {item.subtitle && <Text style={styles.settingSubtitle}>{item.subtitle}</Text>}
        {item.id === "sync" && syncing && (
          <ActivityIndicator color={COLORS.primary} size="small" style={{ marginTop: 4 }} />
        )}
      </View>
      <Icon
        name="chevron-right"
        type="material-community"
        size={24}
        color={COLORS.darkgray}
      />
    </TouchableOpacity>
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: COLORS.white,
        },
        header: {
          paddingHorizontal: SIZES.padding,
          paddingTop: SIZES.padding * 2.5,
          paddingBottom: SIZES.padding,
          backgroundColor: COLORS.white,
        },
        scrollContent: {
          paddingHorizontal: SIZES.padding,
          paddingBottom: SIZES.padding * 2,
        },
        sectionCard: {
          backgroundColor: COLORS.lightGray,
          borderRadius: 16,
          padding: SIZES.base,
          marginBottom: SIZES.padding,
        },
        sectionTitle: {
          ...FONTS.body3,
          color: COLORS.darkgray,
          fontWeight: "600",
          marginBottom: SIZES.base,
          marginLeft: SIZES.base,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        },
        settingItem: {
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: COLORS.white,
          padding: SIZES.padding,
          borderRadius: 12,
          marginBottom: SIZES.base / 2,
        },
        iconCircle: {
          width: 48,
          height: 48,
          borderRadius: 24,
          justifyContent: "center",
          alignItems: "center",
          marginRight: SIZES.padding / 2,
        },
        settingContent: {
          flex: 1,
        },
        settingTitle: {
          ...FONTS.body3,
          color: COLORS.primary,
          fontWeight: "600",
        },
        settingSubtitle: {
          ...FONTS.body4,
          color: COLORS.darkgray,
          marginTop: 2,
        },
      }),
    [COLORS],
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <HeaderText text="Settings" />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Account Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Account</Text>
          {accountSettings.map(renderSettingItem)}
        </View>

        {/* Data Management Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Data Management</Text>
          {dataSettings.map(renderSettingItem)}
        </View>

        {/* Backup & Sync Section */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Backup & Sync</Text>
          {backupSettings.map(renderSettingItem)}
        </View>

        {/* Danger Zone Section */}
        <View style={styles.sectionCard}>
          <Text style={[styles.sectionTitle, { color: COLORS.red2 }]}>Danger Zone</Text>
          {dangerSettings.map(renderSettingItem)}
        </View>
      </ScrollView>

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        style={{
          backgroundColor: snackbarType === "success" ? COLORS.darkgreen : COLORS.red2,
          borderRadius: 12,
          marginBottom: 20,
        }}
        action={{
          label: "OK",
          labelStyle: { color: COLORS.white, fontWeight: "600" },
          onPress: () => setSnackbarVisible(false),
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Icon
            name={snackbarType === "success" ? "check-circle" : "alert-circle"}
            type="material-community"
            size={20}
            color={COLORS.white}
          />
          <Text style={{ color: COLORS.white, marginLeft: 8, ...FONTS.body3 }}>
            {snackbarMessage}
          </Text>
        </View>
      </Snackbar>
    </View>
  );
}
