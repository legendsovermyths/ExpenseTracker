import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, StyleSheet, Linking, AppState } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCodeScanner,
} from "react-native-vision-camera";
import { RADIUS, SIZES, SPACE } from "../constants";
import { EmptyState, HeaderIconButton, Text } from "../components/ui";
import { useTheme } from "../contexts/ThemeContext";
import { acceptFriendInvite, parseFriendLink } from "../services/FriendService";

const FRAME = SIZES.width * 0.7;

export default function ScanFriendQRScreen() {
  const navigation: any = useNavigation();
  const { COLORS } = useTheme();
  const insets = useSafeAreaInsets();
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
    if (!hasPermission && !permissionAsked) return <View style={styles.flex} />;
    if (!hasPermission) {
      return (
        <View style={[styles.flex, styles.centered, { backgroundColor: COLORS.paper }]}>
          <EmptyState
            icon="camera-off-outline"
            title="Camera access needed"
            message="Allow camera access to scan a friend's QR code."
            actionLabel="Open Settings"
            onAction={() => Linking.openSettings()}
          />
        </View>
      );
    }
    if (!device) {
      return (
        <View style={[styles.flex, styles.centered, { backgroundColor: COLORS.paper }]}>
          <EmptyState icon="camera-off-outline" title="No camera available" message="This device doesn't have a camera we can use." />
        </View>
      );
    }
    return (
      <View style={styles.flex}>
        <Camera style={StyleSheet.absoluteFill} device={device} isActive={isFocused && appActive} codeScanner={codeScanner} />
        <View style={styles.overlay} pointerEvents="none">
          <View style={styles.frame}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
          </View>
          <Text variant="headline" align="center" style={styles.hint}>
            {hint}
          </Text>
        </View>
      </View>
    );
  };

  const media = hasPermission && !!device;

  return (
    <View style={[styles.flex, { backgroundColor: media ? "#000" : COLORS.paper }]}>
      {renderBody()}
      <View style={[styles.bar, { top: insets.top + SPACE.sm }]} pointerEvents="box-none">
        <HeaderIconButton
          icon="close"
          label="Close"
          tone={media ? "onMedia" : "ink"}
          onPress={() => navigation.goBack()}
        />
        <HeaderIconButton
          icon="qrcode"
          label="My QR code"
          tone={media ? "onMedia" : "ink"}
          onPress={() => navigation.navigate("MyQRCode")}
        />
      </View>
    </View>
  );
}

const CORNER = 28;
const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { justifyContent: "center" },
  bar: {
    position: "absolute",
    left: SPACE.gutter - SPACE.xs,
    right: SPACE.gutter - SPACE.xs,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  frame: { width: FRAME, height: FRAME },
  corner: { position: "absolute", width: CORNER, height: CORNER, borderColor: "#fff" },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: RADIUS.lg },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: RADIUS.lg },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: RADIUS.lg },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: RADIUS.lg },
  hint: { color: "#fff", marginTop: SPACE.xl, paddingHorizontal: SPACE.xxl },
});
