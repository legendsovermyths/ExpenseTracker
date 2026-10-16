# Paper & Ink — design language & migration guide

This is the single source of truth for how every screen in the app looks and
behaves. If a screen disagrees with this file, the screen is wrong.

- Live gallery: **Settings → Design system** (dev builds only) renders every
  kit component in every state, with a theme switcher.

---

## 1. Principles

1. **Paper, not boxes.** Content sits on the page. Whitespace and hairlines
   separate things. The *only* container is `RowGroup`, and only for groups of
   **tappable rows** (settings, form fields, link rows). Never box a headline,
   a stat, a chart, or plain text — containers make the app feel generated.
   *Single exception:* the Dashboard gradient hero card. Do not touch it.
2. **Numbers are the hero.** Amounts get the strongest type on a screen
   (`display` / `amountLarge` / `amount`), always via `<Amount>` (tabular
   figures). Everything else is quiet.
3. **One accent, used for intent.** `accent` = actions + selection. Green/red
   (`down`/`up` tones) = money direction only. Never decorative colour.
   Category colour comes from `COLORS.ordinal[id % length]` (stable per id).
4. **Same job → same component.** Back, save, confirm-delete, empty, loading,
   search, section titles — always the kit component, never hand-rolled.
5. **Motion explains, never decorates.** Press feedback, sheet springs, a
   fade-up on first mount. 150–250 ms, transform/opacity only, UI thread only.
6. **Thumb-first.** Primary actions live at the bottom (`BottomBar`) or the
   form bar's Save. Destructive actions are text buttons and always confirmed.

## 2. Hard rules (definition of done for a migrated file)

A migrated screen/component must have **none** of:

- `TouchableOpacity` / `TouchableHighlight` / RN `Pressable` → kit `Pressable` (or `Button`, `ListRow`, `HeaderIconButton`…).
- `Alert.alert` → `confirm()` for destructive/blocking choices, `toast()` for results/errors. (Exception: `ActionSheetIOS` source pickers.)
- `fontWeight` anywhere → a `TYPE` role / `FONT.*` face.
- Raw hex colours (except `#fff`/black on photos and scrims) → theme tokens.
- Numeric `borderRadius` → `RADIUS.*`. Numeric spacing where a `SPACE.*` exists.
- Legacy `FONTS.*` / `SIZES.*` → `TYPE.*` / `SPACE.*` / `RADIUS.*`.
- `react-native-paper` UI (`TextInput`, `Button`, `Snackbar`, `FAB`, `Dialog`, `Provider`, `Portal`) and `react-native-elements` `Icon` → kit.
- `HeaderNavigator` / `HeaderText` / hard-coded `paddingTop: SIZES.padding * 2.5` → `Page` / `PageList` / `Form` / `LargeTitle`.
- `ActivityIndicator` as a full-screen first load → `SkeletonList` (spinners are fine inside buttons).
- Ad-hoc empty text → `EmptyState`.
- `FlatList`/`SectionList` for unbounded data → `FlashList` (`PageList` for pages).
- Boxes around non-tappable content (principle 1).

And it **must**:

- Match exactly one archetype (§5).
- Pass `npx tsc --noEmit` (0 errors) and `npx eslint <files>` with no new
  warnings in touched files.
- Look right in one light theme (Classic) and one dark theme (Graphite/Ocean).
- Keep behaviour identical. This is a visual/interaction migration — business
  logic, data flow and navigation params stay as they are.

## 3. Tokens (`constants/tokens.ts`, exported from `constants`)

```ts
import { FONT, TYPE, SPACE, RADIUS, MOTION, ICON } from "../constants";
```

| | |
|---|---|
| `FONT` | `light · regular · medium · bold · black` (Satoshi faces) |
| `TYPE` | `display 40` · `largeTitle 32` · `title 18` · `headline 16` · `body 15` · `callout 13` · `caption 12` · `label 11 CAPS` · `amount 16` · `amountLarge 28` |
| `SPACE` | `xs 4 · sm 8 · md 12 · lg 16 · xl 24 · xxl 32 · xxxl 48 · gutter 24` |
| `RADIUS` | `sm 8 · md 12 · lg 16 · xl 24 · pill` |
| `ICON` | `sm 16 · md 20 · lg 24` |

Colours come from `useTheme().COLORS` — semantic names only:
`paper surface1 surface2 hairline ink inkMuted inkSubtle accent accentWarm
accentSoft deltaUp deltaDown neutral warn ordinal[] heroGradient heroInk…`
(The old aliases `primary/white/lightGray/darkgray/gray/red…` no longer exist.)

Satoshi files are **not committed** (licence forbids public hosting). They're
fetched by `npm install` (postinstall) or `npm run fonts`.

## 4. Kit (`components/ui` — import everything from `"../components/ui"`)

**Text & numbers**
- `<Text variant="headline" tone="muted" align="center">` — tones: `ink muted subtle accent up down warn onAccent`.
- `<Amount cents={n} variant="amount|amountLarge|display|title|caption…" tone sign="none|auto|always" decimals="auto|always|never" animated />`
  **Takes paise/cents.** Store amounts are rupee floats → `Math.round(x * 100)`. Split/ledger APIs already use cents.
- `formatMoney(cents, decimals, sign)` for strings.

**Touch**
- `<Pressable haptic="light|selection|success|warning|error" scale={false}>` — the only tappable primitive.
- `<Button title variant="primary|secondary|destructive" icon loading disabled fullWidth />` — primary = filled accent 52pt; secondary = accent text; destructive = red text.
- `<HeaderIconButton icon label tone="accent|ink|destructive|onMedia" disabled />` (`onMedia` = white on a round scrim, for full-bleed screens), `<HeaderTextButton label emphasis loading />`.

**Rows & structure**
- `<SectionLabel title right={…} />` — the only section title.
- `<ListRow title subtitle leading|icon iconColor value trailing chevron destructive placeholder onPress dense padded={false} />`
  On paper inside a gutter use `padded={false}`; inside `RowGroup` keep the default.
- `<RowGroup inset={…}>` — the only container (tappable rows). For rows with an `icon`, use `inset={SPACE.lg + 34 + SPACE.md}` so separators start under the text.
- `<StatStrip><Stat value={<Amount …/>} label="spent" /></StatStrip>` — key numbers on paper.
- `<DetailHero icon iconType iconColor | leading title meta label amountCents amountTone caption />` — centered hero for detail pages.
- `<Field label icon error trailing …TextInputProps />` — inline input, lives in a `RowGroup`.
- `<EmptyState icon title message actionLabel onAction />`, `<SkeletonList rows padded />`.
- `<SegmentedControl value onChange options={[{key,label}]} size="sm|md" />` — never chips/pills for mode switches.
- `<SearchField value onChangeText placeholder />`.
- `<FilterRail value onChange options onMedia />` — text tabs with accent underline for 4+ filters.
- Existing primitives re-exported: `Avatar`, `avatarColor`, `GlyphPlate`, `Sparkline`, `RangeChipRail`, `Chip`.

**Screens**
- `<Page title subtitle right back onBack footer refreshing onRefresh padded hero>` — pushed pages.
- `<PageList title subtitle right header footer refreshing onRefresh …FlashListProps>` — pushed list pages.
- `<Form ref title onSave saveLabel canSave saving dirty right footer scroll padded>` + `formRef.current.close()`.
- `<LargeTitle title subtitle right topInset gutter>` — fixed title for tab screens.
- `<BottomBar followKeyboard divider>` — pinned primary action(s).
- `<Screen scroll padded topInset footer>` — plain body (rarely needed now).

**Overlays & feedback**
- `<Sheet ref title actionLabel onAction snapPoints scroll onDismiss>` (`scroll={false}` + snapPoints when children bring their own list) + `ref.present()/dismiss()` — pickers over a screen/form.
- `toast(message, "success|error|info")` — after saves/deletes and for errors. Fires the matching haptic.
- `await confirm({ title, message, confirmLabel, destructive })`, `confirmDiscard()`.
- `haptic(kind)` — only for moments in §7; kit components already fire their own.

**Shared domain pieces (already migrated — use, don't fork)**
`CustomFAB` (Create sheet), `TransactionCard`, `TransactionList`, `BarGraph`,
`CustomKeyboard` + `useCustomKeyboard`, `CategoryBottomSheet` (`open(parentId?)/close()`),
`AttachmentStrip` + `useAttachmentDraft`, `SplitBreakdownCard`.

## 5. Screen archetypes

Every screen is exactly one of these. Copy the reference.

### Tab screen (bottom-tab root)
Fixed `LargeTitle` (with `topInset`) + content. No back.
*Reference:* `screens/TransactionScreen.tsx`. (Dashboard is the hero exception.)
```tsx
<View style={{ flex: 1, backgroundColor: COLORS.paper }}>
  <LargeTitle title="Balances" right={<HeaderIconButton icon="magnify" label="Search" tone="ink" onPress={…} />} />
  <FlashList … contentContainerStyle={{ paddingBottom: 120 }} />  {/* rows carry the gutter */}
  <CustomFAB />
</View>
```

### Detail page (pushed)
`Page` + `DetailHero` (or the default large title) → content on paper →
`RowGroup` only for link rows → actions in a `BottomBar` footer.
Bar actions (edit/settings icons) go in `right`, not in the content.
*Reference:* `screens/SplitSummary.tsx`.
```tsx
<Page
  title={name}
  hero={<DetailHero … />}
  footer={<BottomBar><Button title="Edit" … /><Button title="Delete" variant="destructive" … /></BottomBar>}
>
  <SectionLabel title="Breakdown" />
  …
</Page>
```

### List page (pushed)
`PageList` with `header` for search/summary; rows carry the gutter
(`ListRow` default padding, or `paddingHorizontal: SPACE.gutter`). No sticky
headers (they'd stick under the bar).

### Form (modal) — two tiers
All add/edit screens are already presented as modal sheets by the navigator
(don't change presentation). Wrap the screen in `Form`:
```tsx
const form = useRef<FormRef>(null);
<Form ref={form} title="New group" onSave={save} canSave={valid} saving={saving} dirty={dirty}>
  <RowGroup><Field label="Name" value={…} onChangeText={…} /></RowGroup>
  …
</Form>
// after a successful save:
toast("Group created");
form.current?.close();
```
- **Light forms** (few fields): body scrolls; Save in the bar.
- **Involved forms** (keypad, pickers, many fields — Transaction input, Add
  split, Add group expense, Category input, Shared image): use
  `Form scroll={false}` when you lay out a keypad yourself; put
  `CustomKeyboard` in `footer`; open pickers as `Sheet`s (category →
  `CategoryBottomSheet`). Never navigate away from a half-filled form. Make
  sure the focused row scrolls into view above the keypad (see the
  exact-amount pattern in `AddGroupExpenseScreen`).
- `dirty` must be accurate: it blocks swipe-to-dismiss and prompts on Cancel.
- Validation errors: inline under the field (`Field error=`) or
  `toast(…, "error")` — never alerts.
- *Reference:* `screens/BalanceEditScreen.tsx`.

### Picker sheet
`Sheet` over the current screen for choosing from a set (category, account,
participants, date). *Reference:* `components/CategoryBottomSheet.tsx`,
`components/CustomFAB.tsx`.

### Full-bleed (camera, photo viewer, shared-image preview)
Dark/black canvas is fine. Floating ✕ via `HeaderIconButton` on a scrim,
top-left with the safe-area inset. Still kit components + tokens.

### Auth (welcome / sign in / sign up / verify)
No back bar on the first screen. Brand title (`largeTitle`), `RowGroup` of
`Field`s, primary `Button` in a `BottomBar` (follows keyboard), secondary
`Button` for the alternate path. Errors inline.

## 6. Patterns & gotchas (learned the hard way)

- **FlashList sticky headers ignore `contentContainerStyle` padding** — give
  each row the gutter itself (see `components/TransactionList.tsx`).
- **FlashList needs a sized parent** (`flex: 1`) and `estimatedItemSize`;
  use `getItemType` when rows differ.
- **`SegmentedControl` infers its key type from `value`** — pass a typed
  `useState<"a" | "b">` and `onChange={setX}` directly.
- **Amounts are cents in `Amount`.** Double-check every `× 100`.
- **Sheets inside forms** work because modal routes are wrapped with their own
  `BottomSheetModalProvider` + `SafeAreaProvider` (`withSheets` in
  `AppNavigator`). Don't add providers in screens.
- **Insets:** `Page`/`PageList` handle top + bottom; `Form` handles its own top
  (0 in a sheet); `LargeTitle` adds the top inset for tabs; `BottomBar`
  handles the home indicator and keyboard.
- **Don't edit `AppNavigator.tsx`** — routes, presentation and providers are
  set for every screen. Screens draw their own chrome.
- **Never reuse the gradient hero** outside Dashboard.
- **Loading:** first load → `SkeletonList` inside the real chrome
  (`<Page title="…"><SkeletonList /></Page>`) so the title never jumps.
- People lists → `Avatar` leading. Category lists → `GlyphPlate` with
  `ordinal` colour. Actions/settings → `ListRow icon=` (accent plate).
- Found a real bug while migrating? Fix it in a separate small commit and
  mention it in your report.

## 7. Motion & haptics

| Moment | Motion | Haptic |
|---|---|---|
| Any press | kit `Pressable` (scale 0.97) | – (buttons: light) |
| Keypad key | – | selection (built into `CustomKeyboard`) |
| Save success | dismiss + `toast()` | success (built into `toast`) |
| Destructive confirm | – | warning (built into `confirm`) |
| Segment / tab switch | thumb spring | selection (built in) |
| First load of a screen's sections | `entering={FadeInDown.delay(60 + i * 50).duration(320)}` (Reanimated), max ~6 | – |
| Error | `toast(…, "error")` | error (built in) |

No React Native `Animated` with `useNativeDriver: false`; no `LayoutAnimation`
except for selection toggles.

## 8. Verify your work

1. `npx tsc --noEmit` → 0 errors.
2. `npx eslint <changed files>` → no new warnings in touched files.
3. Grep your files for everything banned in §2.
4. Visual check if you can run a simulator (below). If you can't, say so in
   your report — the coordinator will QA.

**Preview a screen** (the simulator already has the dev build installed):
```sh
npx expo start --dev-client --port 8082          # own port if 8081 is taken
# Temporarily set initialRouteName (+ initialParams if needed) on the root
# Stack.Navigator in screens/AppNavigator.tsx — NEVER commit this.
xcrun simctl terminate booted com.finance.expensify
xcrun simctl openurl booted "exp+expensify://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8082"
xcrun simctl io booted screenshot /tmp/shot.png
```

## 9. Git conventions

- Work on your own branch; small, focused commits; short imperative messages
  (e.g. `Migrate group detail to Paper & Ink`). **No co-author trailers.**
- Never push, rebase shared branches, or edit files outside your assigned
  scope. Need a kit change? Ask the coordinator instead of editing
  `components/ui/*` or another group's files.

## 10. Migration status

| Screen / component | Archetype | Status |
|---|---|---|
| Dashboard | Tab (hero) | ✅ |
| Transactions (+ list, card, search, graph) | Tab | ✅ |
| Split summary | Detail | ✅ |
| Monthly budget (`BalanceEditScreen`) | Form (light) | ✅ |
| `CustomFAB`, `CategoryBottomSheet`, `CustomKeyboard`, `AttachmentStrip` | Shared | ✅ |
| Everything else | per coordinator assignment | ⏳ |
