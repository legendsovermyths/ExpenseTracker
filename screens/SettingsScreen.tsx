import React, { useCallback, useContext, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { SPACE } from "../constants";
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
import { unregisterPushToken } from "../services/Notifications";
import { LargeTitle, ListRow, RowGroup, SectionLabel, confirm, toast } from "../components/ui";

const ICON_INSET = SPACE.lg + 34 + SPACE.md;

export default function SettingsScreen() {
  const navigation: any = useNavigation();
  const { COLORS, activeTheme } = useTheme();
  const [syncing, setSyncing] = useState(false);
  const lastSynced = useExpensifyStore((state) => state.getAppconstantByKey("lastSynced"));
  const updateLastSynced = useExpensifyStore((state) => state.updateAppconstant);
  const reloadData = useContext(ReloadContext);

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
      toast("Synced to cloud");
    } catch (err: any) {
      // Roll back the timestamp we wrote so the DB doesn't claim a sync that failed.
      await updateAppconstant(previousLastSynced).catch(() => {});
      toast(err.message || "Sync failed", "error");
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
      toast("Backup exported");
    } catch (err: any) {
      toast(err.message || "Export failed", "error");
    }
  }, []);

  const importFromLocal = useCallback(async () => {
    try {
      const [file] = await pick({ mode: "open", type: "com.apple.symbol-export" });
      const destinationPath = `${RNFS.DocumentDirectoryPath}/${file.name}`;
      const base64 = await RNFS.readFile(destinationPath, "base64");
      await importToBackend(base64);
      reloadData();
      toast("Backup restored");
    } catch (err: any) {
      toast(err.message || "Import failed", "error");
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
      toast("Restored from cloud");
    } catch (err: any) {
      toast(err.message || "Restore failed", "error");
    }
  }, []);

  const handleLogout = async () => {
    // Detach this phone first, while the session can still delete its token.
    // Bounded so an offline logout isn't held up.
    await Promise.race([
      unregisterPushToken().catch((e) => console.warn("[push] unregister failed:", e?.message ?? e)),
      new Promise((resolve) => setTimeout(resolve, 4000)),
    ]);
    await deleteData();
    supabase.auth.signOut();
  };

  const restoreFrom = async (source: "local" | "cloud") => {
    const ok = await confirm({
      title: source === "cloud" ? "Restore from cloud?" : "Restore from a file?",
      message: "This overwrites the data on this device.",
      confirmLabel: "Restore",
    });
    if (!ok) return;
    if (source === "cloud") importFromCloud();
    else importFromLocal();
  };

  const deleteAllData = async () => {
    try {
      await deleteData();
      reloadData();
      toast("All data deleted");
    } catch (err: any) {
      toast(err.message || "Delete failed", "error");
    }
  };

  const confirmDeleteAll = async () => {
    const ok = await confirm({
      title: "Delete all data?",
      message: "This deletes everything stored on this device.",
      confirmLabel: "Delete",
    });
    if (ok) deleteAllData();
  };

  const confirmLogout = async () => {
    const ok = await confirm({
      title: "Log out?",
      message: "Make sure you've synced your data first.",
      confirmLabel: "Log out",
    });
    if (ok) handleLogout();
  };

  const accountCount = Object.values(useExpensifyStore.getState().accounts).filter((a: any) => !a.is_deleted).length;

  return (
    <View style={[styles.container, { backgroundColor: COLORS.paper }]}>
      <LargeTitle title="Settings" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SectionLabel title="Account" />
        <RowGroup inset={ICON_INSET}>
          <ListRow icon="account-outline" title="Profile" chevron onPress={() => navigation.navigate("ProfileDetail")} />
          <ListRow
            icon="qrcode"
            title="My QR code"
            subtitle="Let friends add you"
            chevron
            onPress={() => navigation.navigate("MyQRCode")}
          />
          <ListRow
            icon="qrcode-scan"
            title="Add friend"
            subtitle="Scan a friend's QR code"
            chevron
            onPress={() => navigation.navigate("ScanFriendQR")}
          />
          <ListRow
            icon="palette-outline"
            title="Appearance"
            value={activeTheme.name}
            chevron
            onPress={() => navigation.navigate("Appearance")}
          />
        </RowGroup>

        <SectionLabel title="Money" />
        <RowGroup inset={ICON_INSET}>
          <ListRow
            icon="bank-outline"
            title="Accounts"
            value={String(accountCount)}
            chevron
            onPress={() => navigation.navigate("Banks")}
          />
          <ListRow icon="shape-outline" title="Categories" chevron onPress={() => navigation.navigate("ViewCategory")} />
          <ListRow
            icon="cash"
            title="Monthly budget"
            chevron
            onPress={() => navigation.navigate("BalanceEditScreen")}
          />
          <ListRow
            icon="chart-donut"
            title="Category budgets"
            subtitle="Spending limits per category"
            chevron
            onPress={() => navigation.navigate("CategoryBudgets")}
          />
          <ListRow
            icon="file-document-outline"
            title="Reports"
            chevron
            onPress={() => navigation.navigate("ExpenditureReports")}
          />
          <ListRow
            icon="paperclip"
            title="Documents"
            subtitle="Bills, receipts and warranties"
            chevron
            onPress={() => navigation.navigate("Documents")}
          />
        </RowGroup>

        <SectionLabel title="Backup" />
        <RowGroup inset={ICON_INSET}>
          <ListRow
            icon="cloud-upload-outline"
            title="Sync to cloud"
            subtitle={syncing ? "Syncing…" : lastSynced?.value ? `Last synced ${lastSynced.value}` : "Not synced yet"}
            trailing={syncing ? <ActivityIndicator size="small" color={COLORS.inkSubtle} /> : undefined}
            disabled={syncing}
            onPress={syncDataToCloud}
          />
          <ListRow icon="cloud-download-outline" title="Restore from cloud" onPress={() => restoreFrom("cloud")} />
          <ListRow icon="export-variant" title="Export backup file" onPress={exportOffline} />
          <ListRow icon="file-restore-outline" title="Restore from file" onPress={() => restoreFrom("local")} />
        </RowGroup>

        {__DEV__ && (
          <>
            <SectionLabel title="Developer" />
            <RowGroup inset={ICON_INSET}>
              <ListRow
                icon="palette-swatch-outline"
                title="Design system"
                subtitle="Every component, every state"
                chevron
                onPress={() => navigation.navigate("DesignSystem")}
              />
            </RowGroup>
          </>
        )}

        <RowGroup inset={ICON_INSET} style={styles.danger}>
          <ListRow icon="logout" title="Log out" destructive onPress={confirmLogout} />
          <ListRow icon="delete-outline" title="Delete all data" destructive onPress={confirmDeleteAll} />
        </RowGroup>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: SPACE.gutter, paddingBottom: 120 },
  danger: { marginTop: SPACE.xxl },
});
