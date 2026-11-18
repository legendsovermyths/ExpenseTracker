import { AccessibilityInfo, Easing as RNEasing, LayoutAnimation } from "react-native";
import {
  Easing,
  ReduceMotion,
  WithSpringConfig,
  WithTimingConfig,
} from "react-native-reanimated";
import { MOTION } from "../../constants";

/**
 * Paper & Ink motion: paper settles, ink writes. One curve per role, no
 * overshoot, and every config honours the system Reduce Motion setting.
 */
export const EASE = {
  /** Everything that arrives or moves. */
  settle: Easing.bezier(0.2, 0, 0, 1),
  /** Things leaving. */
  exit: Easing.bezier(0.4, 0, 1, 1),
  /** The pen stroke only. */
  ink: Easing.bezier(0.6, 0, 0.2, 1),
};

/** Same curves as plain functions, for layout animations (entering/exiting). */
export const EASE_FN = {
  settle: Easing.bezierFn(0.2, 0, 0, 1),
  exit: Easing.bezierFn(0.4, 0, 1, 1),
};

/** Same curves for the legacy RN Animated API. */
export const RN_EASE = {
  settle: RNEasing.bezier(0.2, 0, 0, 1),
  exit: RNEasing.bezier(0.4, 0, 1, 1),
};

export const timing = (
  duration: number,
  easing: WithTimingConfig["easing"] = EASE.settle,
): WithTimingConfig => ({ duration, easing, reduceMotion: ReduceMotion.System });

export const settleSpring: WithSpringConfig = {
  ...MOTION.spring,
  reduceMotion: ReduceMotion.System,
};

let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled().then((v) => (reduceMotion = v));
AccessibilityInfo.addEventListener("reduceMotionChanged", (v) => (reduceMotion = v));

/** For JS-thread animations (RN Animated, LayoutAnimation). */
export const prefersReducedMotion = () => reduceMotion;

/** Let siblings glide when rows appear, disappear or change size. */
export const animateLayout = () => {
  if (reduceMotion) return;
  LayoutAnimation.configureNext(
    LayoutAnimation.create(
      MOTION.base,
      LayoutAnimation.Types.easeInEaseOut,
      LayoutAnimation.Properties.opacity,
    ),
  );
};
