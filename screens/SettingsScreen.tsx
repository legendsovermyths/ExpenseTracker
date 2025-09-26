import React, { useCallback, useContext, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  ListRenderItemInfo,
  Alert,
  Modal,
  TouchableOpacity,
} from "react-native";
import { ListItem, Icon } from "@rneui/themed";
import { Text, ActivityIndicator, Snackbar, Button } from "react-native-paper";
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
import DateTimePicker from "@react-native-community/datetimepicker";
import { PdfGenerator } from "../services/PdfGenerator";

type SettingItem = {
  id:
    | "profile"
    | "viewCategory"
    | "deleteAll"
    | "editBudget"
    | "logout"
    | "restore"
    | "export"
    | "sync"
    | "downloadPdf";
  title: string;
  icon: string;
};

const SETTINGS: SettingItem[] = [
  { id: "profile", title: "View Profile", icon: "account-circle" },
  { id: "viewCategory", title: "View / Delete Category", icon: "bookmark" },
  { id: "deleteAll", title: "Delete All Data", icon: "delete" },
  { id: "editBudget", title: "Edit Monthly Budget", icon: "cash" },
  { id: "downloadPdf", title: "Download Expenditure Summary", icon: "file-pdf-box" },
  { id: "logout", title: "Log Out", icon: "logout" },
  { id: "restore", title: "Restore Data", icon: "restore" },
  { id: "export", title: "Export Offline", icon: "download" },
  { id: "sync", title: "Sync to Cloud", icon: "cloud-upload" },
];

export default function SettingsScreen() {
  const navigation: any = useNavigation();
  const [syncing, setSyncing] = useState(false);
  const lastSynced = useExpensifyStore((state) =>
    state.getAppconstantByKey("lastSynced"),
  );
  const updateLastSynced = useExpensifyStore(
    (state) => state.updateAppconstant,
  );
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const reloadData = useContext(ReloadContext);

  // PDF generation states
  const [showDateModal, setShowDateModal] = useState(false);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [pdfStartDate, setPdfStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [pdfEndDate, setPdfEndDate] = useState(new Date());
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Store data for PDF generation
  const transactionsById = useExpensifyStore((state) => state.transactions);
  const accountsById = useExpensifyStore((state) => state.accounts);
  const categoriesById = useExpensifyStore((state) => state.categories);
  const transactions = Object.values(transactionsById);
  const monthlyBalance = parseInt(
    useExpensifyStore((state) => state.getAppconstantByKey("balance")).value,
  );

  const importToBackend = async (byteArray: Uint8Array) => {
    await importData(byteArray);
  };

  // PDF generation functions
  const handleStartDateChange = (event: any, selectedDate?: Date) => {
    if (event.type === 'dismissed') {
      setShowStartDatePicker(false);
      return;
    }
    
    if (selectedDate) {
      setPdfStartDate(selectedDate);
      if (selectedDate > pdfEndDate) {
        setPdfEndDate(selectedDate);
      }
      // Don't auto-close, let user tap Done button
    }
  };

  const handleEndDateChange = (event: any, selectedDate?: Date) => {
    if (event.type === 'dismissed') {
      setShowEndDatePicker(false);
      return;
    }
    
    if (selectedDate) {
      setPdfEndDate(selectedDate);
      if (selectedDate < pdfStartDate) {
        setPdfStartDate(selectedDate);
      }
      // Don't auto-close, let user tap Done button
    }
  };

  const openStartDatePicker = () => {
    setShowEndDatePicker(false);
    setShowStartDatePicker(true);
  };

  const openEndDatePicker = () => {
    setShowStartDatePicker(false);
    setShowEndDatePicker(true);
  };

  const generatePdfReport = useCallback(async () => {
    setGeneratingPdf(true);
    setShowDateModal(false);
    setShowStartDatePicker(false);
    setShowEndDatePicker(false);
    
    try {
      const pdfGenerator = new PdfGenerator(
        transactions,
        accountsById,
        categoriesById,
        monthlyBalance
      );
      
      await pdfGenerator.generateAndSharePdf(pdfStartDate, pdfEndDate);
      
      setSnackbarMessage("PDF generated successfully!");
      setSnackbarVisible(true);
    } catch (error: any) {
      console.error("PDF generation error:", error);
      setSnackbarMessage(error.message || "Failed to generate PDF");
      setSnackbarVisible(true);
    } finally {
      setGeneratingPdf(false);
    }
  }, [transactions, accountsById, categoriesById, monthlyBalance, pdfStartDate, pdfEndDate]);

  const showDateSelectionModal = () => {
    setShowDateModal(true);
  };

  const closeDateModal = () => {
    setShowDateModal(false);
    setShowStartDatePicker(false);
    setShowEndDatePicker(false);
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
          navigation.navigate("BalanceEditScreen");
          break;
        case "downloadPdf":
          showDateSelectionModal();
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
    [navigation, syncDataToCloud, exportOffline, handleRestore, showDateSelectionModal],
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
              <ActivityIndicator color={COLORS.primary} size="small" />
            ) : lastSynced ? (
              <Text style={styles.syncText}>
                Last synced: {lastSynced.value}
              </Text>
            ) : (
              <Text style={styles.syncText}>Not yet synced</Text>
            )}
          </View>
        )}
        {item.id === "downloadPdf" && generatingPdf && (
          <View style={styles.syncInfo}>
            <ActivityIndicator color={COLORS.primary} size="small" />
            <Text style={styles.syncText}>Generating PDF...</Text>
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

      {/* Date Selection Modal */}
      <Modal
        visible={showDateModal}
        transparent={true}
        animationType="slide"
        onRequestClose={closeDateModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Date Range</Text>
            
            <View style={styles.dateSection}>
              <Text style={styles.dateLabel}>Start Date</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={openStartDatePicker}
              >
                <Text style={styles.dateButtonText}>
                  {pdfStartDate.toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.dateSection}>
              <Text style={styles.dateLabel}>End Date</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={openEndDatePicker}
              >
                <Text style={styles.dateButtonText}>
                  {pdfEndDate.toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalButtons}>
              <Button
                mode="outlined"
                onPress={closeDateModal}
                style={styles.modalButton}
                buttonColor={COLORS.lightGray}
                textColor={COLORS.primary}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={generatePdfReport}
                style={styles.modalButton}
                buttonColor={COLORS.primary}
                loading={generatingPdf}
                disabled={generatingPdf}
              >
                Generate PDF
              </Button>
            </View>

          </View>
        </View>

      </Modal>

      {/* Start Date Picker Modal */}
      <Modal
        visible={showStartDatePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowStartDatePicker(false)}
      >
        <TouchableOpacity 
          style={styles.datePickerModalOverlay}
          activeOpacity={1}
          onPress={() => setShowStartDatePicker(false)}
        >
          <TouchableOpacity 
            style={styles.datePickerModalContent}
            activeOpacity={1}
            onPress={() => {}} // Prevent closing when touching content
          >
            <Text style={styles.datePickerTitle}>Select Start Date</Text>
            <DateTimePicker
              value={pdfStartDate}
              mode="date"
              display="spinner"
              onChange={handleStartDateChange}
              maximumDate={pdfEndDate}
              accentColor={COLORS.primary}
              textColor={COLORS.primary}
              style={styles.datePicker}
            />
            <View style={styles.datePickerButtons}>
              <View style={styles.modalButtons}>
                <Button
                  mode="outlined"
                  onPress={() => setShowStartDatePicker(false)}
                  style={styles.modalButton}
                  buttonColor={COLORS.lightGray}
                  textColor={COLORS.primary}
                >
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  onPress={() => setShowStartDatePicker(false)}
                  style={styles.modalButton}
                  buttonColor={COLORS.primary}
                >
                  Done
                </Button>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* End Date Picker Modal */}
      <Modal
        visible={showEndDatePicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEndDatePicker(false)}
      >
        <TouchableOpacity 
          style={styles.datePickerModalOverlay}
          activeOpacity={1}
          onPress={() => setShowEndDatePicker(false)}
        >
          <TouchableOpacity 
            style={styles.datePickerModalContent}
            activeOpacity={1}
            onPress={() => {}} // Prevent closing when touching content
          >
            <Text style={styles.datePickerTitle}>Select End Date</Text>
            <DateTimePicker
              value={pdfEndDate}
              mode="date"
              display="spinner"
              onChange={handleEndDateChange}
              minimumDate={pdfStartDate}
              maximumDate={new Date()}
              accentColor={COLORS.primary}
              textColor={COLORS.primary}
              style={styles.datePicker}
            />
            <View style={styles.datePickerButtons}>
              <View style={styles.modalButtons}>
                <Button
                  mode="outlined"
                  onPress={() => setShowEndDatePicker(false)}
                  style={styles.modalButton}
                  buttonColor={COLORS.lightGray}
                  textColor={COLORS.primary}
                >
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  onPress={() => setShowEndDatePicker(false)}
                  style={styles.modalButton}
                  buttonColor={COLORS.primary}
                >
                  Done
                </Button>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 24,
    margin: 20,
    minWidth: 320,
    shadowColor: COLORS.primary,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 15,
  },
  modalTitle: {
    ...FONTS.h2,
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: 24,
    fontWeight: '700',
  },
  dateSection: {
    marginBottom: 16,
  },
  dateLabel: {
    ...FONTS.body3,
    color: COLORS.primary,
    marginBottom: 8,
  },
  dateButton: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dateButtonText: {
    ...FONTS.h4,
    color: COLORS.primary,
    textAlign: 'center',
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  datePickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  datePickerModalContent: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    margin: 20,
    minWidth: 300,
    shadowColor: COLORS.primary,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 15,
  },
  datePickerTitle: {
    ...FONTS.h3,
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '600',
  },
  datePicker: {
    backgroundColor: COLORS.white,
    marginVertical: 10,
  },
  datePickerButtons: {
    marginTop: 20,
  },
});
