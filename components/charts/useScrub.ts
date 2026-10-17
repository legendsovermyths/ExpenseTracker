import { useCallback, useState } from "react";
import { Gesture } from "react-native-gesture-handler";
import { runOnJS, useSharedValue } from "react-native-reanimated";
import { haptic } from "../ui/haptics";
import { nearestIndex } from "./scale";

/**
 * Press-and-drag (or tap) selection across `count` evenly spaced slots.
 * Horizontal drags scrub; vertical drags fall through to the parent scroll
 * view. Returns the gesture to attach and the React-side active index, which
 * only changes when the index changes (not every frame).
 */
export const useScrub = ({
  count,
  plotLeft,
  plotWidth,
  onSelect,
  sticky = false,
}: {
  count: number;
  plotLeft: number;
  plotWidth: number;
  onSelect?: (index: number | null) => void;
  /** Keep the selection after the finger lifts (bars, donut). */
  sticky?: boolean;
}) => {
  const [active, setActive] = useState<number | null>(null);
  const current = useSharedValue(-1);

  const commit = useCallback(
    (i: number) => {
      const next = i < 0 ? null : i;
      setActive(next);
      if (next !== null) haptic("selection");
      onSelect?.(next);
    },
    [onSelect],
  );

  const update = (x: number) => {
    "worklet";
    const i = nearestIndex(x - plotLeft, count, plotWidth);
    if (i !== current.value) {
      current.value = i;
      runOnJS(commit)(i);
    }
  };

  const clear = () => {
    "worklet";
    if (current.value !== -1) {
      current.value = -1;
      runOnJS(commit)(-1);
    }
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-6, 6])
    .failOffsetY([-14, 14])
    .onBegin((e) => update(e.x))
    .onUpdate((e) => update(e.x))
    .onFinalize(() => {
      if (!sticky) clear();
    });

  const tap = Gesture.Tap().onEnd((e) => {
    const i = nearestIndex(e.x - plotLeft, count, plotWidth);
    if (sticky && i === current.value) clear();
    else update(e.x);
  });

  return { gesture: Gesture.Exclusive(pan, tap), active, clear: () => commit(-1) };
};
