import React, { useRef, useState } from "react";
import { ScrollView, StyleSheet, Switch, View } from "react-native";
import { SPACE, TYPE, TypeRole } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import {
  Amount,
  Avatar,
  BottomBar,
  Button,
  EmptyState,
  Field,
  GlyphPlate,
  ListRow,
  RowGroup,
  Page,
  SectionLabel,
  SegmentedControl,
  Sheet,
  SheetRef,
  SkeletonList,
  Text,
  confirm,
  toast,
} from "../components/ui";
import { BarChart, Donut, LineChart, ProgressRing } from "../components/charts";

// Dev-only gallery of every Paper & Ink component in every state. The
// visual source of truth while migrating screens — open from Settings in
// development builds.
export default function DesignSystemScreen() {
  const { COLORS, themes, themeId, setTheme } = useTheme();
  const [seg, setSeg] = useState<"equal" | "exact" | "ratio">("equal");
  const [toggle, setToggle] = useState(true);
  const [amount, setAmount] = useState(123456);
  const [name, setName] = useState("");
  const sheet = useRef<SheetRef>(null);
  const randomSeries = (n: number, max: number) => Array.from({ length: n }, () => Math.round(Math.random() * max));
  const [lineData, setLineData] = useState(() => randomSeries(30, 4000));
  const [barData, setBarData] = useState(() => randomSeries(7, 2500));
  const [slice, setSlice] = useState<number | null>(null);
  const reshuffle = () => {
    setLineData(randomSeries(30, 4000));
    setBarData(randomSeries(7, 2500));
  };

  const roles = Object.keys(TYPE) as TypeRole[];

  return (
    <Page
      title="Design system"
      subtitle="Every Paper & Ink component"
      footer={
        <BottomBar divider>
          <Button title="Primary action" onPress={() => toast("Saved")} />
        </BottomBar>
      }
    >
      <SectionLabel title="Theme" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.themes}>
        {themes.map((t) => (
          <Button
            key={t.id}
            title={t.name}
            variant={t.id === themeId ? "primary" : "secondary"}
            fullWidth={false}
            onPress={() => setTheme(t.id)}
            style={styles.themeBtn}
          />
        ))}
      </ScrollView>

      <SectionLabel title="Type" />
      {roles.map((r) => (
        <Text key={r} variant={r} numberOfLines={1}>
          {r} · ₹12,480.50
        </Text>
      ))}

      <SectionLabel title="Tones" />
      <View style={styles.wrap}>
        {(["ink", "muted", "subtle", "accent", "up", "down", "warn"] as const).map((t) => (
          <Text key={t} tone={t} variant="headline">
            {t}
          </Text>
        ))}
      </View>

      <SectionLabel title="Amount" right={<Button title="Change" variant="secondary" fullWidth={false} onPress={() => setAmount(Math.round(Math.random() * 5_000_000))} />} />
      <Amount cents={amount} variant="display" animated />
      <View style={styles.wrap}>
        <Amount cents={-42050} sign="auto" tone="up" />
        <Amount cents={180000} sign="always" tone="down" />
        <Amount cents={99} decimals="always" tone="muted" />
      </View>

      <SectionLabel title="Buttons" />
      <View style={styles.stack}>
        <Button title="Save expense" icon="check" onPress={() => toast("Saved")} />
        <Button title="Loading" loading onPress={() => {}} />
        <Button title="Disabled" disabled onPress={() => {}} />
        <Button title="Secondary action" variant="secondary" onPress={() => toast("Heads up", "info")} />
        <Button
          title="Delete split"
          variant="destructive"
          onPress={async () => (await confirm({ title: "Delete split?", message: "This can't be undone." })) && toast("Deleted", "error")}
        />
      </View>

      <SectionLabel title="Segmented control" />
      <SegmentedControl
        value={seg}
        onChange={setSeg}
        options={[
          { key: "equal", label: "Equally" },
          { key: "exact", label: "Exact" },
          { key: "ratio", label: "Ratio" },
        ]}
      />

      <SectionLabel title="Rows on paper" />
      <ListRow
        padded={false}
        leading={<GlyphPlate name="food" color={COLORS.ordinal[1]} size={36} radius={10} />}
        title="Dinner at Bombay Canteen"
        subtitle="Today · HDFC"
        trailing={<Amount cents={-245000} sign="auto" tone="up" />}
        onPress={() => {}}
      />
      <ListRow
        padded={false}
        leading={<Avatar name="Pragya Singh" size={36} />}
        title="Pragya Singh"
        subtitle="owes you"
        trailing={<Amount cents={42133} tone="down" />}
        onPress={() => {}}
      />

      <SectionLabel title="Row group" />
      <RowGroup inset={SPACE.lg + 34 + SPACE.md}>
        <ListRow icon="palette-outline" title="Appearance" value="Classic" chevron onPress={() => {}} />
        <ListRow icon="bell-outline" title="Notifications" trailing={<Switch value={toggle} onValueChange={setToggle} trackColor={{ true: COLORS.accent }} />} />
        <ListRow icon="tag-outline" title="Category" value="Choose" placeholder chevron onPress={() => sheet.current?.present()} />
        <ListRow icon="logout" title="Sign out" destructive onPress={() => {}} />
      </RowGroup>

      <SectionLabel title="Fields" />
      <RowGroup>
        <Field label="Description" placeholder="What was it for?" value={name} onChangeText={setName} />
        <Field label="Note" placeholder="Optional" error={name.length > 20 ? "Keep it under 20 characters" : null} value={name} onChangeText={setName} />
      </RowGroup>

      <SectionLabel title="Line chart" right={<Text variant="caption" tone="subtle">drag to scrub</Text>} />
      <LineChart
        series={[
          { data: lineData, color: COLORS.accent },
          { data: lineData.map((v) => v * 0.8 + 300), dashed: true, fill: false, name: "Prior" },
        ]}
        labels={lineData.map((_, i) => String(i + 1))}
        tooltipLabel={(i) => `Day ${i + 1}`}
      />
      <Button title="Shuffle data" variant="secondary" fullWidth={false} onPress={reshuffle} />

      <SectionLabel title="Bar chart" right={<Text variant="caption" tone="subtle">tap a bar</Text>} />
      <BarChart
        data={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => ({
          label: d,
          value: barData[i],
          highlight: i === 4,
        }))}
        average={barData.reduce((a, b) => a + b, 0) / barData.length}
      />

      <SectionLabel title="Donut" right={<Text variant="caption" tone="subtle">tap a segment</Text>} />
      <Donut
        segments={barData.slice(0, 5).map((v, i) => ({ value: v, color: COLORS.ordinal[i], label: `Category ${i + 1}` }))}
        selected={slice}
        onSelect={setSlice}
        center={(sel) =>
          sel === null ? (
            <Amount cents={barData.slice(0, 5).reduce((a, b) => a + b, 0) * 100} decimals="never" variant="title" />
          ) : (
            <>
              <Text variant="caption" tone="muted">{`Category ${sel + 1}`}</Text>
              <Amount cents={barData[sel] * 100} decimals="never" variant="title" />
            </>
          )
        }
      />

      <SectionLabel title="Progress ring" />
      <ProgressRing progress={(barData[0] % 100) / 100} size={140}>
        <Text variant="title">{barData[0] % 100}%</Text>
      </ProgressRing>

      <SectionLabel title="Empty chart" />
      <LineChart series={[{ data: [0, 0, 0, 0, 0] }]} labels={["1", "2", "3", "4", "5"]} height={100} />

      <SectionLabel title="Empty state" />
      <EmptyState icon="account-group-outline" title="No groups yet" message="Create a group to split trips, flats and dinners." actionLabel="Create group" onAction={() => {}} />

      <SectionLabel title="Skeleton" />
      <SkeletonList rows={3} />

      <Sheet ref={sheet} title="Choose category" actionLabel="Done">
        {["Food", "Travel", "Groceries", "Rent"].map((c) => (
          <ListRow key={c} padded={false} title={c} onPress={() => sheet.current?.dismiss()} />
        ))}
      </Sheet>
    </Page>
  );
}

const styles = StyleSheet.create({
  themes: { gap: SPACE.sm },
  themeBtn: { minHeight: 36, paddingHorizontal: SPACE.lg },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: SPACE.lg, marginTop: SPACE.sm },
  stack: { gap: SPACE.sm },
});
