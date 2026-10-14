// ESLint config for Expo 52 (ESLint 8, legacy format).
// Keep rules light for now — this is a guardrail, not a style crusade.
module.exports = {
  root: true,
  extends: ["expo", "prettier"],
  ignorePatterns: [
    "node_modules/",
    "dist/",
    ".expo/",
    "ios/",
    "android/",
    "sdk/",
    "supabase/functions/",
    "patches/",
    "mods/",
  ],
  rules: {
    "no-unused-vars": "off",
  },
};
