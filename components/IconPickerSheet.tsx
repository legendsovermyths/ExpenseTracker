import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Keyboard, ScrollView, StyleSheet, View } from "react-native";
import { IconPicker } from "@grassper/react-native-icon-picker";
import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { RADIUS, SPACE, TYPE } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import { useExpensifyStore } from "../store/store";
import {
  IconDraft,
  MAX_ICON_PROMPT,
  deleteIcon,
  generateIcon,
  myIcons,
  saveIcon,
} from "../services/Icons";
import { CUSTOM_ICON_TYPE } from "../types/entity/Icon";
import CustomGlyph from "./primitives/CustomGlyph";
import {
  Button,
  GlyphPlate,
  Icon,
  Pressable,
  Text,
  confirm,
  haptic,
} from "./ui";

export type PickedIcon = { name: string; type: string };

export interface IconPickerSheetRef {
  present: () => void;
  dismiss: () => void;
}

export interface IconPickerSheetProps {
  /** Colour the previews are tinted with (the entity's own colour). */
  tint: string;
  onPick: (icon: PickedIcon) => void;
}

// The picker's callback reports the package name; GlyphPlate wants the
// react-native-elements icon set key.
const PACKAGE_TO_ICONSET: Record<string, string> = {
  AntDesign: "antdesign",
  Entypo: "entypo",
  EvilIcons: "evilicon",
  Feather: "feather",
  FontAwesome: "font-awesome",
  FontAwesome5: "font-awesome-5",
  Fontisto: "fontisto",
  Foundation: "foundation",
  Ionicons: "ionicon",
  MaterialCommunityIcons: "material-community",
  MaterialIcons: "material",
  Octicons: "octicon",
  SimpleLineIcons: "simple-line-icon",
  Zocial: "zocial",
};

const SUGGESTIONS = [
  "Coffee",
  "Rent",
  "Gym",
  "Groceries",
  "Flight",
  "Pet food",
  "Gift",
  "Fuel",
];
const LOADING_LINES = [
  "Sketching your icon",
  "Simplifying the shape",
  "Tracing the outline",
];

/**
 * The one icon picker for categories, funds and groups: the built-in icon
 * library plus icons the user creates with AI, in one sheet.
 */
const IconPickerSheet = forwardRef<IconPickerSheetRef, IconPickerSheetProps>(
  ({ tint, onPick }, ref) => {
    const { COLORS } = useTheme();
    const modal = useRef<BottomSheetModal>(null);
    const me = useExpensifyStore((s) => s.userId);
    const customIcons = useExpensifyStore((s) => s.customIcons);
    const yours = myIcons(customIcons, me);

    const [mode, setMode] = useState<"browse" | "create">("browse");
    const [prompt, setPrompt] = useState("");
    const [draft, setDraft] = useState<IconDraft | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [line, setLine] = useState(0);
    // Results of a request the user walked away from are dropped.
    const requestId = useRef(0);

    const reset = useCallback(() => {
      requestId.current++;
      setMode("browse");
      setPrompt("");
      setDraft(null);
      setLoading(false);
      setSaving(false);
      setError("");
    }, []);

    useImperativeHandle(ref, () => ({
      present: () => modal.current?.present(),
      dismiss: () => modal.current?.dismiss(),
    }));

    const pick = (icon: PickedIcon) => {
      haptic("light");
      onPick(icon);
      modal.current?.dismiss();
    };

    const handleLibraryPick = (_id: any, _n: any, name: any, pkg: any) =>
      pick({ name, type: PACKAGE_TO_ICONSET[pkg] || "material-community" });

    const removeIcon = async (id: string) => {
      const ok = await confirm({
        title: "Remove this icon?",
        message: "Anything already using it keeps it.",
        confirmLabel: "Remove",
        destructive: true,
      });
      if (!ok) return;
      await deleteIcon(id);
      haptic("light");
    };

    const create = async (text = prompt) => {
      const subject = text.trim();
      if (!subject || loading) return;
      Keyboard.dismiss();
      const id = ++requestId.current;
      setPrompt(subject);
      setError("");
      setLoading(true);
      try {
        const next = await generateIcon(subject);
        if (id !== requestId.current) return;
        setDraft(next);
        haptic("success");
      } catch (e: any) {
        if (id !== requestId.current) return;
        setError(e?.message || "Couldn't create an icon right now. Try again");
        haptic("error");
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    };

    const useDraft = async () => {
      if (!draft || saving) return;
      setSaving(true);
      try {
        pick(await saveIcon(draft));
      } catch (e: any) {
        setError(e?.message || "Couldn't save the icon");
        setSaving(false);
      }
    };

    // Gentle "breathing" plate and rotating copy while FLUX works.
    const reduceMotion = useReducedMotion();
    const pulse = useSharedValue(1);
    useEffect(() => {
      if (!loading) {
        cancelAnimation(pulse);
        pulse.value = withTiming(1, { duration: 200 });
        return;
      }
      if (!reduceMotion) {
        pulse.value = withRepeat(
          withTiming(0.45, {
            duration: 900,
            easing: Easing.inOut(Easing.quad),
          }),
          -1,
          true,
        );
      }
      setLine(0);
      const t = setInterval(
        () => setLine((l) => (l + 1) % LOADING_LINES.length),
        2600,
      );
      return () => clearInterval(t);
    }, [loading, reduceMotion, pulse]);
    const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.35}
        />
      ),
      [],
    );

    const fresh = !!draft && draft.prompt === prompt.trim();

    const plate = (size: number, radius: number) => (
      <View
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: tint + "20",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {draft ? (
          <CustomGlyph
            id=""
            path={draft.path}
            size={Math.round(size * 0.55)}
            color={tint}
          />
        ) : (
          <Icon
            name="creation"
            size={Math.round(size * 0.5)}
            color={tint + (loading ? "" : "66")}
          />
        )}
      </View>
    );

    const browse = (
      <View style={styles.fill}>
        <View style={styles.gutter}>
          <Text variant="title" style={styles.title}>
            Icon
          </Text>
          <Pressable
            style={[styles.createRow, { backgroundColor: COLORS.surface1 }]}
            onPress={() => setMode("create")}
            accessibilityLabel="Create an icon with AI"
            haptic="light"
          >
            <GlyphPlate
              name="creation"
              color={COLORS.accent}
              size={40}
              radius={RADIUS.md}
            />
            <View style={styles.fill}>
              <Text variant="headline">Create with AI</Text>
              <Text variant="callout" tone="muted">
                Describe it and get an icon in this style
              </Text>
            </View>
            <Icon name="chevron-right" size={22} color={COLORS.inkSubtle} />
          </Pressable>
          {yours.length > 0 && (
            <>
              <Text variant="label" tone="muted" style={styles.section}>
                Yours
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {yours.map((i) => (
                  <Pressable
                    key={i.id}
                    onPress={() => pick({ name: i.id, type: CUSTOM_ICON_TYPE })}
                    onLongPress={() => removeIcon(i.id)}
                    accessibilityLabel={
                      i.prompt ? `Your icon: ${i.prompt}` : "Your icon"
                    }
                    style={[styles.cell, { backgroundColor: COLORS.surface1 }]}
                  >
                    <CustomGlyph id={i.id} size={24} color={COLORS.ink} />
                  </Pressable>
                ))}
              </ScrollView>
              <Text variant="label" tone="muted" style={styles.section}>
                Library
              </Text>
            </>
          )}
        </View>
        <View style={[styles.fill, styles.library]}>
          <IconPicker
            searchTitle=""
            iconsTitle=""
            numColumns={6}
            iconSize={24}
            iconColor={COLORS.ink}
            backgroundColor={COLORS.paper}
            placeholderText="Search icons"
            placeholderTextColor={COLORS.inkSubtle}
            onClick={handleLibraryPick}
            iconContainerStyle={{
              ...styles.cell,
              backgroundColor: COLORS.surface1,
            }}
            textInputStyle={{
              ...styles.search,
              ...TYPE.body,
              backgroundColor: COLORS.surface1,
              color: COLORS.ink,
            }}
          />
        </View>
      </View>
    );

    const createView = (
      <View style={[styles.fill, styles.gutter]}>
        <View style={styles.createHeader}>
          <Pressable
            onPress={() => {
              requestId.current++;
              setLoading(false);
              setError("");
              setMode("browse");
            }}
            accessibilityLabel="Back to icons"
            hitSlop={12}
            style={styles.back}
          >
            <Icon name="chevron-left" size={26} color={COLORS.accent} />
            <Text variant="headline" tone="accent">
              Icons
            </Text>
          </Pressable>
        </View>
        <Text variant="title" style={styles.title}>
          Create with AI
        </Text>

        <View style={styles.previewRow}>
          <Animated.View style={loading ? pulseStyle : undefined}>
            {plate(96, 28)}
          </Animated.View>
          <View style={styles.previewSmall}>
            {plate(44, 13)}
            {plate(30, 9)}
          </View>
        </View>
        <Text
          variant="callout"
          tone="muted"
          align="center"
          style={styles.status}
        >
          {loading
            ? `${LOADING_LINES[line]}…`
            : draft
              ? `“${draft.prompt}”`
              : "Black and white, simple, and made to match your other icons."}
        </Text>

        <BottomSheetTextInput
          value={prompt}
          onChangeText={(t) => {
            setPrompt(t);
            if (error) setError("");
          }}
          placeholder="Describe it, e.g. surfboard"
          placeholderTextColor={COLORS.inkSubtle}
          maxLength={MAX_ICON_PROMPT}
          returnKeyType="go"
          onSubmitEditing={() => create()}
          editable={!loading && !saving}
          autoCorrect
          autoCapitalize="none"
          accessibilityLabel="Describe your icon"
          style={[
            styles.input,
            TYPE.body,
            { backgroundColor: COLORS.surface1, color: COLORS.ink },
          ]}
        />
        {!!error && (
          <Text variant="callout" tone="up" style={styles.error}>
            {error}
          </Text>
        )}

        {!draft && !loading && !prompt && (
          <View style={styles.chips}>
            {SUGGESTIONS.map((s) => (
              <Pressable
                key={s}
                onPress={() => create(s)}
                style={[styles.chip, { backgroundColor: COLORS.surface1 }]}
                accessibilityLabel={`Create a ${s} icon`}
              >
                <Text variant="callout">{s}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.actions}>
          {fresh ? (
            <>
              <Button
                title="Use icon"
                onPress={useDraft}
                loading={saving}
                haptic="success"
              />
              <Button
                title="Try again"
                variant="secondary"
                onPress={() => create()}
                disabled={loading || saving}
                loading={loading}
              />
            </>
          ) : (
            <Button
              title={draft ? "Create new icon" : "Create icon"}
              onPress={() => create()}
              loading={loading}
              disabled={!prompt.trim() || saving}
            />
          )}
        </View>
      </View>
    );

    return (
      <BottomSheetModal
        ref={modal}
        snapPoints={["88%"]}
        backdropComponent={renderBackdrop}
        onDismiss={reset}
        keyboardBehavior="extend"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        backgroundStyle={{
          backgroundColor: COLORS.paper,
          borderRadius: RADIUS.xl,
        }}
        handleIndicatorStyle={{ backgroundColor: COLORS.inkSubtle, width: 36 }}
      >
        <BottomSheetView style={styles.fill}>
          {mode === "browse" ? browse : createView}
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

const styles = StyleSheet.create({
  fill: { flex: 1 },
  gutter: { paddingHorizontal: SPACE.gutter },
  title: { paddingVertical: SPACE.sm, marginBottom: SPACE.sm },
  createRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    padding: SPACE.md,
    borderRadius: RADIUS.lg,
  },
  section: { marginTop: SPACE.lg, marginBottom: SPACE.sm },
  library: {
    alignItems: "center",
    paddingHorizontal: SPACE.lg,
    marginTop: SPACE.md,
  },
  cell: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    margin: SPACE.xs,
    justifyContent: "center",
    alignItems: "center",
  },
  search: {
    alignSelf: "stretch",
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm + 2,
    marginBottom: SPACE.md,
  },
  createHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: -SPACE.xs,
  },
  back: { flexDirection: "row", alignItems: "center", marginLeft: -SPACE.sm },
  previewRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: SPACE.lg,
    marginTop: SPACE.md,
  },
  previewSmall: { flexDirection: "row", alignItems: "flex-end", gap: SPACE.md },
  status: { marginTop: SPACE.md, marginBottom: SPACE.lg, minHeight: 18 },
  input: {
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.md,
  },
  error: { marginTop: SPACE.sm },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACE.sm,
    marginTop: SPACE.md,
  },
  chip: {
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
    borderRadius: RADIUS.pill,
  },
  actions: { marginTop: SPACE.xl, gap: SPACE.sm },
});

IconPickerSheet.displayName = "IconPickerSheet";
export default IconPickerSheet;
