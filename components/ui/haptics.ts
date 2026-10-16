import { trigger } from "react-native-haptic-feedback";

export type HapticKind = "selection" | "light" | "medium" | "success" | "warning" | "error";

const TYPE = {
  selection: "selection",
  light: "impactLight",
  medium: "impactMedium",
  success: "notificationSuccess",
  warning: "notificationWarning",
  error: "notificationError",
} as const;

const OPTIONS = { enableVibrateFallback: false, ignoreAndroidSystemSettings: false };

export const haptic = (kind: HapticKind = "light") => trigger(TYPE[kind], OPTIONS);
