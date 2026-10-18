// ESLint config for Expo 52 (ESLint 8, legacy format).
// Keep rules light for now — this is a guardrail, not a style crusade.
// AI keys live only in the `ai` Edge Function (docs/SECURITY.md). Shared by
// the base rules and the screens override, since overrides replace a rule's
// options instead of merging them.
const NO_CLIENT_AI_SECRETS = [
  {
    selector: "Literal[value=/api\\.openai\\.com|^sk-[A-Za-z0-9_-]{16,}/]",
    message: "Call AI through invokeAI() (supabase/functions/ai); never from the app.",
  },
  {
    selector: "MemberExpression[object.property.name='env'][property.name=/OPEN_?AI/i]",
    message: "OpenAI keys must not reach the app bundle. Use the `ai` Edge Function.",
  },
  {
    selector: "Property[key.name=/^openAi/]",
    message: "OpenAI keys must not reach the app bundle. Use the `ai` Edge Function.",
  },
];

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
    "no-restricted-syntax": ["error", ...NO_CLIENT_AI_SECRETS],
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
              { name: "react-native-gifted-charts", message: "Use components/charts." },
              { name: "react-native-chart-kit", message: "Use components/charts." },
              {
                name: "react-native",
                importNames: ["TouchableOpacity", "TouchableHighlight"],
                message: "Use the kit Pressable / Button / ListRow.",
              },
            ],
          },
        ],
        "no-restricted-syntax": [
          "error",
          ...NO_CLIENT_AI_SECRETS,
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
