import { RefObject, useEffect, useRef } from "react";
import { LayoutAnimation } from "react-native";

/**
 * When items are added to or removed from a list, let the neighbours glide
 * (and removed rows fade) instead of jumping. Skips the first render and
 * wholesale changes (month switches, search), where animating would be noise.
 */
export const useListChangeAnimation = (
  ids: Array<string | number>,
  listRef?: RefObject<{ prepareForLayoutAnimationRender: () => void } | null>,
) => {
  const prev = useRef<Set<string | number> | null>(null);
  useEffect(() => {
    const next = new Set(ids);
    const before = prev.current;
    prev.current = next;
    if (!before) return;
    let added = 0;
    let removed = 0;
    next.forEach((id) => !before.has(id) && added++);
    before.forEach((id) => !next.has(id) && removed++);
    const changed = added + removed;
    if (changed === 0 || changed > 12 || (added > 0 && added === next.size)) return;
    listRef?.current?.prepareForLayoutAnimationRender();
    LayoutAnimation.configureNext(
      LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity),
    );
  }, [ids.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
};
