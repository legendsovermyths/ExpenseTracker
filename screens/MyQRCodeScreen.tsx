import React, { useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import QRCode from "react-native-qrcode-svg";
import Share from "react-native-share";
import RNFS from "react-native-fs";
import { RADIUS, SIZES, SPACE } from "../constants";
import { LIGHT_COLORS } from "../constants/theme";
import { useTheme } from "../contexts/ThemeContext";
import { useExpensifyStore } from "../store/store";
import { buildFriendLink } from "../services/FriendService";
import { Avatar, BottomBar, Button, Icon, ListRow, Page, RowGroup, Text } from "../components/ui";

// The QR itself always uses the light palette so it stays scannable in dark mode.
const QR_INK = LIGHT_COLORS.ink;
const QR_PAPER = "#FFFFFF";
const QR_SIZE = SIZES.width * 0.6;

export default function MyQRCodeScreen() {
  const navigation: any = useNavigation();
  const { COLORS } = useTheme();
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
    <Page
      title="My QR code"
      subtitle="Friends scan this to add you and start splitting"
      footer={
        <BottomBar>
          <Button title="Share my code" icon="share-variant" loading={sharing} onPress={handleShare} />
        </BottomBar>
      }
    >
      <View style={styles.identity}>
        <Avatar name={displayName} size={64} />
        <Text variant="title" numberOfLines={1} style={styles.name}>
          {displayName}
        </Text>
      </View>

      {/* Always dark-on-white so the code scans in every theme. */}
      <View style={[styles.qrFrame, { borderColor: COLORS.hairline }]}>
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
            logoBorderRadius={RADIUS.md}
            ecl="Q"
            quietZone={8}
            getRef={(ref) => (qrRef.current = ref)}
          />
        ) : (
          <ActivityIndicator color={QR_INK} />
        )}
      </View>

      <View style={styles.privacyRow}>
        <Icon name="shield-lock-outline" size="sm" color={COLORS.inkSubtle} />
        <Text variant="caption" tone="subtle">
          Only people with this code can add you
        </Text>
      </View>

      <RowGroup inset={SPACE.lg + 34 + SPACE.md} style={styles.links}>
        <ListRow
          icon="qrcode-scan"
          title="Scan a friend's code"
          subtitle="Add someone instantly with your camera"
          chevron
          onPress={() => navigation.navigate("ScanFriendQR")}
        />
      </RowGroup>
    </Page>
  );
}

const styles = StyleSheet.create({
  identity: { alignItems: "center", marginTop: SPACE.lg },
  name: { marginTop: SPACE.sm, maxWidth: "90%" },
  qrFrame: {
    alignSelf: "center",
    marginTop: SPACE.xl,
    padding: 10,
    borderRadius: RADIUS.xl,
    backgroundColor: QR_PAPER,
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: QR_SIZE + 20,
    minHeight: QR_SIZE + 20,
    alignItems: "center",
    justifyContent: "center",
  },
  privacyRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE.xs + 2, marginTop: SPACE.lg },
  links: { marginTop: SPACE.xl },
});
