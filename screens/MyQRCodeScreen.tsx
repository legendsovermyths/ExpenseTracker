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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";
import Share from "react-native-share";
import RNFS from "react-native-fs";
import { FONTS, SIZES, FONT } from "../constants";
import { ColorPalette, LIGHT_COLORS } from "../constants/theme";
import { useTheme } from "../contexts/ThemeContext";
import { useExpensifyStore } from "../store/store";
import { buildFriendLink } from "../services/FriendService";
import { Surface, Avatar, GlyphPlate } from "../components/primitives";

// The QR itself always uses the light palette so it stays scannable in dark mode.
const QR_INK = LIGHT_COLORS.ink;
const QR_PAPER = "#FFFFFF";
const QR_SIZE = SIZES.width * 0.6;

export default function MyQRCodeScreen() {
  const navigation: any = useNavigation();
  const insets = useSafeAreaInsets();
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
      // Share a real PNG file — a data: URL makes many targets show garbage text.
      const path = `${RNFS.CachesDirectoryPath}/expensify-friend-qr.png`;
      try {
        await RNFS.writeFile(path, base64.replace(/^data:image\/\w+;base64,/, ""), "base64");
        await Share.open({
          title: "Add me on Expensify",
          url: `file://${path}`,
          type: "image/png",
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
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + SIZES.base }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Icon name="arrow-left" type="material-community" size={24} color={COLORS.ink} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>My QR code</Text>
        <Text style={styles.subtitle}>Friends scan this to add you and start splitting</Text>

        <Surface tier={2} style={styles.card} padding={0}>
          <View style={styles.cardBand} />
          <View style={styles.identity}>
            <Avatar name={displayName} size={64} style={styles.avatar} />
            <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
            <Text style={styles.tagline}>Expensify</Text>
          </View>

          <View style={styles.qrFrame}>
            {userId ? (
              <QRCode
                value={link}
                size={QR_SIZE}
                color={QR_INK}
                backgroundColor={QR_PAPER}
                logo={require("../assets/icon.png")}
                logoSize={QR_SIZE * 0.2}
                logoBackgroundColor={QR_PAPER}
                logoMargin={4}
                logoBorderRadius={12}
                ecl="Q"
                quietZone={8}
                getRef={(ref) => (qrRef.current = ref)}
              />
            ) : (
              <ActivityIndicator color={QR_INK} />
            )}
          </View>

          <View style={styles.privacyRow}>
            <Icon name="shield-lock-outline" type="material-community" size={14} color={COLORS.inkSubtle} />
            <Text style={styles.privacyText}>Only people with this code can add you</Text>
          </View>
        </Surface>

        <TouchableOpacity style={styles.primaryBtn} onPress={handleShare} activeOpacity={0.85}>
          {sharing ? (
            <ActivityIndicator color={COLORS.paper} />
          ) : (
            <>
              <Icon name="share-variant" type="material-community" size={18} color={COLORS.paper} />
              <Text style={styles.primaryBtnText}>Share my code</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.75} onPress={() => navigation.navigate("ScanFriendQR")}>
          <Surface tier={1} bordered={false} style={styles.linkRow}>
            <GlyphPlate name="qrcode-scan" color={COLORS.accent} size={36} radius={10} />
            <View style={{ flex: 1 }}>
              <Text style={styles.linkTitle}>Scan a friend's code</Text>
              <Text style={styles.linkSub}>Add someone instantly with your camera</Text>
            </View>
            <Icon name="chevron-right" type="material-community" size={20} color={COLORS.inkSubtle} />
          </Surface>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const createStyles = (COLORS: ColorPalette) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: COLORS.paper },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: SIZES.padding,
      paddingBottom: SIZES.base,
    },
    headerBtn: { padding: 4 },
    content: { paddingHorizontal: SIZES.padding, paddingBottom: SIZES.padding * 2 },

    title: { ...FONTS.screenTitle, color: COLORS.ink, marginTop: SIZES.base },
    subtitle: { ...FONTS.bodyS, color: COLORS.inkMuted, marginTop: 4, marginBottom: SIZES.padding },

    card: { alignItems: "center", overflow: "hidden", paddingBottom: SIZES.padding * 0.8 },
    cardBand: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: 64,
      backgroundColor: COLORS.accentSoft,
    },
    identity: { alignItems: "center", marginTop: 32 },
    avatar: { borderWidth: 3, borderColor: COLORS.surface2 },
    name: { ...FONTS.amountCard, color: COLORS.ink, marginTop: SIZES.base, maxWidth: "90%" },
    tagline: { ...FONTS.sectionLabel, color: COLORS.inkSubtle, marginTop: 4 },
    qrFrame: {
      marginTop: SIZES.padding * 0.8,
      padding: 10,
      borderRadius: 20,
      backgroundColor: QR_PAPER,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: COLORS.hairline,
      minWidth: QR_SIZE + 20,
      minHeight: QR_SIZE + 20,
      alignItems: "center",
      justifyContent: "center",
    },
    privacyRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: SIZES.padding * 0.7,
    },
    privacyText: { ...FONTS.caption, color: COLORS.inkSubtle },

    primaryBtn: {
      marginTop: SIZES.padding,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: COLORS.accent,
      borderRadius: SIZES.radius,
      paddingVertical: 15,
      minHeight: 52,
    },
    primaryBtnText: { ...FONTS.h4, color: COLORS.paper },

    linkRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: SIZES.base + 4,
      paddingHorizontal: SIZES.padding * 0.7,
      paddingVertical: SIZES.base + 4,
      marginTop: SIZES.base + 4,
    },
    linkTitle: { ...FONTS.bodyM, fontFamily: FONT.bold, color: COLORS.ink },
    linkSub: { ...FONTS.caption, color: COLORS.inkMuted, marginTop: 2 },
  });
