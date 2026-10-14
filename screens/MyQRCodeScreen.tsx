import React, { useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Icon } from "@rneui/themed";
import { useNavigation } from "@react-navigation/native";
import QRCode from "react-native-qrcode-svg";
import Share from "react-native-share";
import { FONTS, SIZES } from "../constants";
import { LIGHT_COLORS } from "../constants/theme";
import { useTheme } from "../contexts/ThemeContext";
import { useExpensifyStore } from "../store/store";
import { buildFriendLink } from "../services/FriendService";

// The QR itself always uses the light palette so it stays scannable in dark mode.
const QR_INK = LIGHT_COLORS.primary;
const QR_PAPER = "#FFFFFF";

const getInitials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";

export default function MyQRCodeScreen() {
  const navigation: any = useNavigation();
  const { COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const userId = useExpensifyStore((s) => s.userId);
  const userName = useExpensifyStore((s) => s.userName);
  const displayName = userName || "Expensify user";
  const link = useMemo(() => buildFriendLink(userId, displayName), [userId, displayName]);
  const qrRef = useRef<any>(null);
  const [sharing, setSharing] = useState(false);

  const handleShare = () => {
    if (!qrRef.current || sharing) return;
    setSharing(true);
    qrRef.current.toDataURL(async (base64: string) => {
      try {
        await Share.open({
          title: "Add me on Expensify",
          message: `Scan this QR code or open the link to add ${displayName} as a friend on Expensify:\n${link}`,
          url: `data:image/png;base64,${base64}`,
          filename: "expensify-friend-qr",
          failOnCancel: false,
        });
      } catch {
        /* user dismissed the share sheet */
      } finally {
        setSharing(false);
      }
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Icon name="arrow-left" type="material-community" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My QR Code</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.cardGlowTop} />
          <View style={styles.cardGlowBottom} />

          <Text style={styles.brand}>Expensify</Text>

          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(displayName)}</Text>
          </View>
          <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
          <Text style={styles.tagline}>Scan to split expenses with me</Text>

          <View style={styles.qrFrame}>
            {userId ? (
              <QRCode
                value={link}
                size={SIZES.width * 0.55}
                color={QR_INK}
                backgroundColor={QR_PAPER}
                logo={require("../assets/icon.png")}
                logoSize={SIZES.width * 0.12}
                logoBackgroundColor={QR_PAPER}
                logoMargin={4}
                logoBorderRadius={12}
                ecl="H"
                quietZone={8}
                getRef={(ref) => (qrRef.current = ref)}
              />
            ) : (
              <ActivityIndicator color={QR_INK} />
            )}
          </View>

          <View style={styles.privacyRow}>
            <Icon name="shield-lock-outline" type="material-community" size={14} color={styles.privacyText.color} />
            <Text style={styles.privacyText}>Only people with this code can add you</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={handleShare} activeOpacity={0.85}>
          {sharing ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <Icon name="share-variant" type="material-community" size={20} color={COLORS.white} />
              <Text style={styles.primaryBtnText}>Share my code</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => navigation.navigate("ScanFriendQR")}
          activeOpacity={0.85}
        >
          <Icon name="qrcode-scan" type="material-community" size={20} color={COLORS.primary} />
          <Text style={styles.secondaryBtnText}>Scan a friend's code</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

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
    content: { padding: SIZES.padding, alignItems: "center" },
    card: {
      width: "100%",
      alignItems: "center",
      backgroundColor: COLORS.primary,
      borderRadius: 28,
      paddingVertical: SIZES.padding * 1.5,
      paddingHorizontal: SIZES.padding,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOpacity: 0.2,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
    cardGlowTop: {
      position: "absolute",
      top: -80,
      right: -60,
      width: 200,
      height: 200,
      borderRadius: 100,
      backgroundColor: COLORS.secondary,
      opacity: 0.25,
    },
    cardGlowBottom: {
      position: "absolute",
      bottom: -90,
      left: -70,
      width: 220,
      height: 220,
      borderRadius: 110,
      backgroundColor: COLORS.lightBlue,
      opacity: 0.2,
    },
    brand: {
      ...FONTS.credBold,
      fontSize: 22,
      letterSpacing: 1,
      color: COLORS.white,
      marginBottom: SIZES.padding,
    },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: COLORS.secondary,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 3,
      borderColor: COLORS.white,
    },
    avatarText: { ...FONTS.h2, fontWeight: "700", color: "#FFFFFF" },
    name: { ...FONTS.h2, fontWeight: "700", color: COLORS.white, marginTop: SIZES.base },
    tagline: { ...FONTS.body4, color: COLORS.white, opacity: 0.8, marginTop: 2 },
    qrFrame: {
      marginTop: SIZES.padding,
      padding: 12,
      borderRadius: 24,
      backgroundColor: QR_PAPER,
      minWidth: SIZES.width * 0.55 + 24,
      minHeight: SIZES.width * 0.55 + 24,
      alignItems: "center",
      justifyContent: "center",
    },
    privacyRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: SIZES.padding,
    },
    privacyText: { ...FONTS.body4, color: COLORS.white, opacity: 0.85 },
    primaryBtn: {
      marginTop: SIZES.padding * 1.5,
      width: "100%",
      height: 52,
      borderRadius: 26,
      backgroundColor: COLORS.primary,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },
    primaryBtnText: { ...FONTS.h3, fontWeight: "700", color: COLORS.white },
    secondaryBtn: {
      marginTop: SIZES.base * 1.5,
      width: "100%",
      height: 52,
      borderRadius: 26,
      borderWidth: 1.5,
      borderColor: COLORS.primary,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },
    secondaryBtnText: { ...FONTS.h3, fontWeight: "700", color: COLORS.primary },
  });
