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

export type HapticRhythm = "saveLanded" | "batchDone";

/**
 * Multi-beat haptics timed with the visuals:
 * - saveLanded: soft tap now, crisp success as the row lands (+80 ms)
 * - batchDone: three rising ticks 40 ms apart, then success
 */
export const hapticRhythm = (rhythm: HapticRhythm) => {
  if (rhythm === "saveLanded") {
    haptic("light");
    setTimeout(() => haptic("success"), 80);
    return;
  }
  haptic("selection");
  setTimeout(() => haptic("selection"), 40);
  setTimeout(() => haptic("light"), 80);
  setTimeout(() => haptic("success"), 140);
};
