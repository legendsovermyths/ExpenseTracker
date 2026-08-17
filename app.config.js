import "dotenv/config";
export default {
  expo: {
    name: "Expensify",
    slug: "AwesomeFinanceApp",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    assetBundlePatterns: ["**/*"],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.finance.expensify",
      // Only encryption used is OS-provided HTTPS/TLS (Supabase, Gemini) and
      // the local SQLite DB is unencrypted — so the app is export-compliance
      // exempt. Declaring this here skips the App Store Connect encryption
      // prompt on every future build.
      config: {
        usesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/icon.png",
        backgroundColor: "#ffffff",
      },
      package: "com.Finance.Expensify",
    },
    notification: {
      icon: "./assets/icon.png",
      color: "#ffffff",
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
      geminiApiKey: process.env.GEMINI_API_KEY,
      geminiApiKeyBackup: process.env.GEMINI_API_KEY_BACKUP,
    },
  },
};
