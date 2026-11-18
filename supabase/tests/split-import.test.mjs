// Unit tests for supabase/functions/split-import/categorize.mjs.
// Run: node --test supabase/tests/split-import.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assignChunks,
  distinctDescriptions,
  parseChunkResult,
} from "../functions/split-import/categorize.mjs";

const CATS = [
  { id: 1, name: "Food", parent_id: null },
  { id: 2, name: "Dining Out", parent_id: 1 },
  { id: 3, name: "Transport", parent_id: null },
  { id: 4, name: "Others", parent_id: null },
];

test("same description shares a chunk and is sent once", () => {
  const items = [
    { description: "Swiggy 123" },
    { description: "Uber" },
    { description: "SWIGGY!" },
    { description: "Ola" },
  ];
  const chunked = assignChunks(items, 1);
  assert.deepEqual(chunked.map((c) => c.chunk), [0, 1, 0, 2]);
  const { descriptions, itemIndex } = distinctDescriptions(items);
  assert.deepEqual(descriptions, ["Swiggy 123", "Uber", "Ola"]);
  assert.deepEqual(itemIndex, [0, 1, 0, 2]);
});

test("invalid JSON yields low-confidence blanks", () => {
  const out = parseChunkResult("not json", 2, CATS, []);
  assert.equal(out.length, 2);
  assert.ok(out.every((r) => r.category_id === null && r.confidence === "low"));
});

test("unknown ids are dropped; subcategory as category moves under its parent", () => {
  const text = JSON.stringify({
    results: [
      { i: 0, category_id: 99, confidence: "high" },
      { i: 1, category_id: 2, confidence: "high" },
      { i: 2, category_id: 3, subcategory_id: 2, confidence: "weird" },
    ],
  });
  const out = parseChunkResult(text, 3, CATS, []);
  assert.equal(out[0].category_id, null);
  assert.deepEqual(out[1], { category_id: 1, subcategory_id: 2, new_category_key: null, confidence: "high" });
  // subcategory 2 doesn't belong to 3, so it's dropped; unknown confidence → medium
  assert.deepEqual(out[2], { category_id: 3, subcategory_id: null, new_category_key: null, confidence: "medium" });
});

test("new categories are deduped against existing and earlier proposals", () => {
  const proposed = [];
  const first = parseChunkResult(
    JSON.stringify({
      results: [
        { i: 0, new_category: "pets", confidence: "high" },
        { i: 1, new_category: "food2", confidence: "high" },
        { i: 2, new_category: "brunch", confidence: "medium" },
      ],
      new_categories: [
        { key: "pets", name: "pets", parent_id: null },
        { key: "food2", name: "FOOD", parent_id: null },
        { key: "brunch", name: "Brunch", parent_id: 1 },
      ],
    }),
    3,
    CATS,
    proposed,
  );
  assert.deepEqual(proposed, [
    { key: "pets", name: "Pets", parent_id: null },
    { key: "brunch", name: "Brunch", parent_id: 1 },
  ]);
  assert.equal(first[0].new_category_key, "pets");
  assert.deepEqual(first[1], { category_id: 1, subcategory_id: null, new_category_key: null, confidence: "high" });
  assert.deepEqual(first[2], { category_id: 1, subcategory_id: null, new_category_key: "brunch", confidence: "medium" });

  // A later chunk proposes "Pets" again under another key, and reuses a key directly.
  const second = parseChunkResult(
    JSON.stringify({
      results: [
        { i: 0, new_category: "pet-care", confidence: "high" },
        { i: 1, new_category: "brunch", confidence: "high" },
      ],
      new_categories: [{ key: "pet-care", name: "Pets", parent_id: null }],
    }),
    2,
    CATS,
    proposed,
  );
  assert.equal(proposed.length, 2);
  assert.equal(second[0].new_category_key, "pets");
  assert.equal(second[1].new_category_key, "brunch");
});

test("out-of-range indexes are ignored", () => {
  const out = parseChunkResult(
    JSON.stringify({ results: [{ i: 5, category_id: 1 }, { i: -1, category_id: 1 }] }),
    1,
    CATS,
    [],
  );
  assert.equal(out[0].category_id, null);
});
