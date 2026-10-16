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
  overrides: [
    {
      // Paper & Ink guardrails — see docs/DESIGN.md §2. The kit itself is exempt.
      files: ["screens/**/*.tsx", "components/**/*.tsx"],
      excludedFiles: ["components/ui/**", "components/primitives/**"],
      rules: {
        "no-restricted-imports": [
          "warn",
          {
            paths: [
              { name: "react-native-paper", message: "Use components/ui instead (docs/DESIGN.md)." },
              { name: "react-native-elements", message: "Use the kit Icon from components/ui." },
              { name: "@rneui/themed", message: "Use the kit Icon from components/ui." },
              {
                name: "react-native",
                importNames: ["TouchableOpacity", "TouchableHighlight"],
                message: "Use the kit Pressable / Button / ListRow.",
              },
            ],
          },
        ],
        "no-restricted-syntax": [
          "warn",
          { selector: "Property[key.name='fontWeight']", message: "Use a TYPE role / FONT face, not fontWeight." },
          {
            selector: "MemberExpression[object.name='FONTS']",
            message: "Legacy FONTS — use TYPE from constants.",
          },
        ],
      },
    },
  ],
};
