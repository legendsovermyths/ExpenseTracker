import "dotenv/config";
export default {
  expo: {
    name: "Expensify",
    slug: "Expensify",
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
    },
  },
};
