import React, { useRef } from "react";
import { StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { RADIUS, SPACE } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import { Icon, ListRow, Pressable, RowGroup, SectionLabel, Sheet, SheetRef } from "./ui";

interface CreateAction {
  icon: string;
  title: string;
  subtitle: string;
  route: string;
}

const ADD: CreateAction[] = [
  { icon: "receipt", title: "Transaction", subtitle: "Log an expense or income", route: "AddTransaction" },
  { icon: "account-multiple-outline", title: "Split", subtitle: "Share a cost with a friend", route: "SearchPeople" },
  { icon: "account-group-outline", title: "Group", subtitle: "For trips, flats and dinners", route: "CreateGroupScreen" },
  { icon: "piggy-bank-outline", title: "Fund", subtitle: "Pool money with someone", route: "CreateFundScreen" },
];

const SETUP: CreateAction[] = [
  { icon: "bank-outline", title: "Account", subtitle: "Bank account, card or wallet", route: "AddBank" },
  { icon: "tag-outline", title: "Category", subtitle: "Organise how you spend", route: "AddCategory" },
];

const GLYPH_INSET = SPACE.lg + 34 + SPACE.md;

// Floating "+" that opens the Create sheet. Long-press jumps straight to
// adding a transaction.
const CustomFAB: React.FC = () => {
  const { COLORS } = useTheme();
  const navigation: any = useNavigation();
  const sheet = useRef<SheetRef>(null);

  const go = (route: string) => {
    sheet.current?.dismiss();
    navigation.navigate(route);
  };

  const renderGroup = (items: CreateAction[]) => (
    <RowGroup inset={GLYPH_INSET}>
      {items.map((a) => (
        <ListRow key={a.route} icon={a.icon} title={a.title} subtitle={a.subtitle} onPress={() => go(a.route)} />
      ))}
    </RowGroup>
  );

  return (
    <>
      <Pressable
        haptic="light"
        accessibilityLabel="Create"
        onPress={() => sheet.current?.present()}
        onLongPress={() => go("AddTransaction")}
        style={[styles.fab, { backgroundColor: COLORS.accent }]}
      >
        <Icon name="plus" size={28} color={COLORS.paper} />
      </Pressable>

      <Sheet ref={sheet} title="Create">
        {renderGroup(ADD)}
        <SectionLabel title="Set up" style={styles.section} />
        {renderGroup(SETUP)}
      </Sheet>
    </>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: SPACE.gutter,
    bottom: SPACE.gutter,
    width: 56,
    height: 56,
    borderRadius: RADIUS.lg,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  section: { marginTop: SPACE.lg },
});

export default CustomFAB;
