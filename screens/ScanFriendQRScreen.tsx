import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Linking, AppState } from "react-native";
import { Icon } from "@rneui/themed";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCodeScanner,
} from "react-native-vision-camera";
import { FONTS, SIZES } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import { acceptFriendInvite, parseFriendLink } from "../services/FriendService";

const FRAME = SIZES.width * 0.7;

export default function ScanFriendQRScreen() {
  const navigation: any = useNavigation();
  const { COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const device = useCameraDevice("back");
  const { hasPermission, requestPermission } = useCameraPermission();
  const isFocused = useIsFocused();
  const [appActive, setAppActive] = useState(AppState.currentState === "active");
  const [hint, setHint] = useState("Point your camera at a friend's Expensify QR code");
  const [permissionAsked, setPermissionAsked] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    if (hasPermission) return;
    requestPermission().finally(() => setPermissionAsked(true));
  }, [hasPermission, requestPermission]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => setAppActive(s === "active"));
    return () => sub.remove();
  }, []);

  const onCodeScanned = useCallback(
    async (codes: { value?: string }[]) => {
      if (busy.current) return;
      const invite = codes.map((c) => parseFriendLink(c.value)).find(Boolean);
      if (!invite) {
        setHint("That isn't an Expensify friend code");
        return;
      }
      busy.current = true;
      const outcome = await acceptFriendInvite(invite);
      if (outcome === "added" || outcome === "already") {
        navigation.goBack();
      } else {
        setTimeout(() => (busy.current = false), 1200);
      }
    },
    [navigation],
  );

  const codeScanner = useCodeScanner({ codeTypes: ["qr"], onCodeScanned });

  const renderBody = () => {
    if (!hasPermission && !permissionAsked) return <View style={styles.centered} />;
    if (!hasPermission) {
      return (
        <View style={styles.centered}>
          <Icon name="camera-off-outline" type="material-community" size={48} color={COLORS.primary} />
          <Text style={styles.message}>Camera access is needed to scan QR codes.</Text>
          <TouchableOpacity style={styles.permissionBtn} onPress={() => Linking.openSettings()}>
            <Text style={styles.permissionBtnText}>Open Settings</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (!device) {
      return (
        <View style={styles.centered}>
          <Text style={styles.message}>No camera available on this device.</Text>
        </View>
      );
    }
    return (
      <View style={styles.cameraWrap}>
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={isFocused && appActive}
          codeScanner={codeScanner}
        />
        <View style={styles.overlay} pointerEvents="none">
          <View style={styles.frame}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
          </View>
          <Text style={styles.hint}>{hint}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Icon name="arrow-left" type="material-community" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan QR Code</Text>
        <TouchableOpacity onPress={() => navigation.navigate("MyQRCode")} style={styles.headerBtn}>
          <Icon name="qrcode" type="material-community" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
      {renderBody()}
    </View>
  );
}

const CORNER = 28;
const createStyles = (COLORS: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.white },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: SIZES.padding,
      paddingTop: SIZES.padding * 2.5,
      paddingBottom: SIZES.base,
    },
    headerBtn: { padding: 4, width: 32 },
    headerTitle: { ...FONTS.h2, fontWeight: "700", color: COLORS.primary },
    cameraWrap: {
      flex: 1,
      margin: SIZES.padding,
      borderRadius: 28,
      overflow: "hidden",
      backgroundColor: "#000",
    },
    overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
    frame: { width: FRAME, height: FRAME },
    corner: { position: "absolute", width: CORNER, height: CORNER, borderColor: COLORS.secondary },
    tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 16 },
    tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 16 },
    bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 16 },
    br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 16 },
    hint: {
      ...FONTS.body3,
      color: "#FFFFFF",
      textAlign: "center",
      marginTop: SIZES.padding * 1.5,
      paddingHorizontal: SIZES.padding * 2,
    },
    centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: SIZES.padding * 2 },
    message: { ...FONTS.body3, color: COLORS.darkgray, textAlign: "center", marginTop: SIZES.padding },
    permissionBtn: {
      marginTop: SIZES.padding,
      paddingHorizontal: SIZES.padding * 1.5,
      paddingVertical: SIZES.base * 1.5,
      borderRadius: 24,
      backgroundColor: COLORS.primary,
    },
    permissionBtnText: { ...FONTS.h4, fontWeight: "700", color: COLORS.white },
  });
