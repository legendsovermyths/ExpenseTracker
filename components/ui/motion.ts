import {
  AccessibilityInfo,
  Animated as RNAnimated,
  Easing as RNEasing,
  LayoutAnimation,
} from "react-native";
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

// A worklet so it can build configs inside useAnimatedStyle (UI thread) too.
export const timing = (
  duration: number,
  easing: WithTimingConfig["easing"] = EASE.settle,
): WithTimingConfig => {
  "worklet";
  return { duration, easing, reduceMotion: ReduceMotion.System };
};

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

/**
 * Bulk-entry carousel (RN Animated values on the native driver). The current
 * item drifts a short way and fades; the next settles in from the other side.
 */
export const CAROUSEL_SHIFT = 24;

const rnTiming = (v: RNAnimated.Value, toValue: number, duration: number, easing: (t: number) => number) =>
  RNAnimated.timing(v, {
    toValue,
    duration: reduceMotion ? 0 : duration,
    easing,
    useNativeDriver: true,
  });

export const carouselSwap = (
  x: RNAnimated.Value,
  opacity: RNAnimated.Value,
  /** -1 = moving to the next item (content leaves left), 1 = previous. */
  direction: -1 | 1,
  /** Where the content currently sits (e.g. mid-swipe). */
  fromX: number,
  /** Swap the content while it's invisible. Return false to stop (e.g. queue done). */
  swap: () => boolean | void,
) => {
  RNAnimated.parallel([
    rnTiming(x, fromX + direction * CAROUSEL_SHIFT, MOTION.quick, RN_EASE.exit),
    rnTiming(opacity, 0, MOTION.quick, RN_EASE.exit),
  ]).start(() => {
    if (swap() === false) return;
    x.setValue(-direction * CAROUSEL_SHIFT);
    RNAnimated.parallel([
      rnTiming(x, 0, MOTION.base, RN_EASE.settle),
      rnTiming(opacity, 1, MOTION.base, RN_EASE.settle),
    ]).start();
  });
};

/** Swipe released below the threshold: settle back without overshoot. */
export const carouselSettle = (x: RNAnimated.Value) =>
  rnTiming(x, 0, MOTION.base, RN_EASE.settle).start();
