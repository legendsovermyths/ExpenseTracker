import "dotenv/config";
export default {
  expo: {
    name: "Expensify",
    slug: "AwesomeFinanceApp",
    version: "1.0.0",
    orientation: "portrait",
    scheme: "expensifyfinance",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      icon: {
        light: "./assets/icon.png",
        dark: "./assets/icon-dark.png",
        tinted: "./assets/icon-tinted.png",
      },
      bundleIdentifier: "com.finance.expensify",
      // Only encryption used is OS-provided HTTPS/TLS (Supabase, Azure OpenAI) and
      // the local SQLite DB is unencrypted — so the app is export-compliance
      // exempt. Declaring this here skips the App Store Connect encryption
      // prompt on every future build.
      config: {
        usesNonExemptEncryption: false,
      },
      infoPlist: {
        NSCameraUsageDescription:
          "Expensify uses the camera to scan friends' QR codes and to photograph bills, receipts and warranty cards.",
        NSPhotoLibraryUsageDescription:
          "Attach bills, receipts and warranty cards from your photos to a transaction.",
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        monochromeImage: "./assets/adaptive-icon-monochrome.png",
        backgroundColor: "#FFFFFF",
      },
      package: "com.Finance.Expensify",
      permissions: ["android.permission.CAMERA"],
    },
    notification: {
      icon: "./assets/notification-icon.png",
      color: "#1A3A6E",
      androidMode: "default",
      androidCollapsedTitle: "#{unread_notifications} new interactions",
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    extra: {
      eas: {
        projectId: "0f7a7c50-9c53-454e-a637-8fc20f751834",
      },
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseKey: process.env.SUPABASE_KEY,
    },
  },
};
