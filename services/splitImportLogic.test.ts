import {
  buildApplyPayload,
  buildStartItems,
  categoryRefs,
  fallbackCategoryId,
  historyMatches,
  JobItem,
  normalizeDescription,
} from "./splitImportLogic";
import { Category } from "../types/entity/Category";
import { Transaction } from "../types/entity/Transaction";

const cat = (id: number, name: string, parent?: number, is_deleted = false): Category => ({
  id,
  name,
  icon_name: "x",
  icon_type: "material-community",
  is_subcategory: parent != null,
  parent_category: parent as number,
  is_deleted,
});

const CATS: Record<number, Category> = {
  1: cat(1, "Food"),
  2: cat(2, "Dining Out", 1),
  3: cat(3, "Others"),
  4: cat(4, "Old", undefined, true),
  5: cat(5, "Orphan", 4),
};

const txn = (id: number, description: string, category_id: number, subcategory_id?: number): Transaction => ({
  id,
  description,
  amount: 10,
  is_credit: false,
  account_id: 1,
  category_id,
  subcategory_id: subcategory_id as number,
  date_time: "2026-10-01T00:00:00.000Z",
});

const item = (over: Partial<JobItem>): JobItem => ({
  entry_id: "e",
  description: "d",
  amount_cents: 1250,
  entry_created_at: "2026-03-01T10:00:00+00:00",
  done: true,
  category_id: 1,
  subcategory_id: null,
  new_category_key: null,
  confidence: "high",
  ...over,
});

test("normalizeDescription ignores digits, case and punctuation", () => {
  expect(normalizeDescription("Swiggy #123")).toBe(normalizeDescription("SWIGGY!"));
  expect(normalizeDescription("123")).toBe("123");
});

test("categoryRefs drops deleted categories and orphaned subcategories", () => {
  expect(categoryRefs(CATS)).toEqual([
    { id: 1, name: "Food", parent_id: null },
    { id: 2, name: "Dining Out", parent_id: 1 },
    { id: 3, name: "Others", parent_id: null },
  ]);
});

test("fallbackCategoryId prefers Others", () => {
  expect(fallbackCategoryId(CATS)).toBe(3);
  expect(fallbackCategoryId({ 7: cat(7, "Zed"), 6: cat(6, "Amy") })).toBe(6);
});

test("history matches only consistent descriptions and pre-fills start items", () => {
  const matches = historyMatches(
    [
      txn(1, "Swiggy 1", 1, 2),
      txn(2, "swiggy", 1, 2),
      txn(3, "Dinner", 1),
      txn(4, "Dinner", 3),
    ],
    CATS,
  );
  expect(matches.get("swiggy")).toEqual({ category_id: 1, subcategory_id: 2 });
  expect(matches.has("dinner")).toBe(false);

  const items = buildStartItems(
    [
      { entry_id: "a", description: "SWIGGY 99", created_at: "t", owed_cents: 500, grp_name: null, counterpart_name: null },
      { entry_id: "b", description: null, created_at: "t", owed_cents: 300, grp_name: null, counterpart_name: null },
      { entry_id: "c", description: "Zero", created_at: "t", owed_cents: 0, grp_name: null, counterpart_name: null },
    ],
    matches,
  );
  expect(items).toEqual([
    { entry_id: "a", description: "SWIGGY 99", amount_cents: 500, created_at: "t", category_id: 1, subcategory_id: 2 },
    { entry_id: "b", description: "Split", amount_cents: 300, created_at: "t" },
  ]);
});

test("buildApplyPayload validates categories and keeps only used proposals", () => {
  const isValidIcon = (n: string) => n === "paw";
  const res = buildApplyPayload(
    [
      item({ entry_id: "a", new_category_key: "pets", category_id: null }),
      item({ entry_id: "b", category_id: 4 }),
      item({ entry_id: "c", category_id: 1, subcategory_id: 5 }),
      item({ entry_id: "d", done: false }),
      item({ entry_id: "e", new_category_key: "ghost", category_id: null }),
    ],
    [
      { key: "pets", name: "Pets", parent_id: 4, icon: "paw" },
      { key: "unused", name: "Unused", parent_id: null, icon: "nope" },
    ],
    CATS,
    3,
    isValidIcon,
  );
  expect(res.new_categories).toEqual([
    { key: "pets", name: "Pets", parent_id: null, icon_name: "paw", icon_type: "material-community" },
  ]);
  expect(res.items.map((i) => [i.entry_id, i.category_id, i.subcategory_id, i.new_category_key, i.confidence])).toEqual([
    ["a", null, null, "pets", "high"],
    ["b", 3, null, null, "low"],
    ["c", 1, null, null, "high"],
    ["e", 3, null, null, "low"],
  ]);
  expect(res.items[0].amount).toBe(12.5);
  expect(res.items[0].date_time).toBe("2026-03-01T10:00:00.000Z");
});
