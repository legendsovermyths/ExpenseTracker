// End-to-end RLS + sync suite. Drives real users through the exact
// supabase-js calls services/BackgroundSync.ts makes, then checks the true
// database state with the service role.
//
// Run through supabase/tests/run.sh (local Docker stack, never production).
//
// Two kinds of check:
//   allow - a real app flow. Must work before AND after hardening.
//   deny  - an attack / leak. Must be blocked after hardening; in
//           `baseline` mode it is only reported (shows today's holes).

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const URL = process.env.RLS_API_URL;
const ANON = process.env.RLS_ANON_KEY;
const SERVICE = process.env.RLS_SERVICE_KEY;
const MODE = process.env.RLS_MODE ?? "hardened";
if (!URL || !ANON || !SERVICE) {
  console.error("Run via supabase/tests/run.sh");
  process.exit(2);
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(URL, SERVICE, opts);
const anon = createClient(URL, ANON, opts);

// ── reporting ─────────────────────────────────────────────────────────────

const results = [];
let section = "";
const C = { g: "\x1b[32m", r: "\x1b[31m", y: "\x1b[33m", d: "\x1b[2m", x: "\x1b[0m" };

function heading(name) {
  section = name;
  console.log(`\n${name}`);
}

async function check(kind, name, fn, { hardenedOnly = false } = {}) {
  if (hardenedOnly && MODE === "baseline") return;
  let ok = false;
  let detail = "";
  try {
    const r = await fn();
    ok = r === true || r?.ok === true;
    detail = r?.detail ?? "";
  } catch (e) {
    ok = false;
    detail = e?.message ?? String(e);
  }
  const expectedOpen = kind === "deny" && MODE === "baseline";
  const status = ok ? "pass" : expectedOpen ? "open" : "fail";
  results.push({ section, kind, name, status, detail });
  const mark =
    status === "pass" ? `${C.g}✓${C.x}` : status === "open" ? `${C.y}○ OPEN${C.x}` : `${C.r}✗ FAIL${C.x}`;
  console.log(`  ${mark} ${C.d}[${kind}]${C.x} ${name}${!ok && detail ? ` ${C.d}(${detail})${C.x}` : ""}`);
}

const blocked = async (p) => {
  const { error } = await p;
  return error ? { ok: true } : { ok: false, detail: "request succeeded" };
};

// ── users ─────────────────────────────────────────────────────────────────

const run = randomUUID().slice(0, 8);
async function makeUser(name) {
  const email = `${name.toLowerCase()}-${run}@rls.test`;
  const password = `pw-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  if (error) throw error;
  const client = createClient(URL, ANON, opts);
  const { error: signErr } = await client.auth.signInWithPassword({ email, password });
  if (signErr) throw signErr;
  return { id: data.user.id, name, email, c: client };
}

// ── the app's sync calls (services/BackgroundSync.ts, verbatim shapes) ────

async function pushSplits(c, entries, lines) {
  const { error: leErr } = await c.from("ledger_entry").upsert(entries, { onConflict: "id" }).select();
  if (leErr) throw leErr;
  const { error: liErr } = await c.from("line_item").upsert(lines, { onConflict: "entry_id, user_id" });
  if (liErr) throw liErr;
}

async function pullSplits(c) {
  const [le, li] = await Promise.all([
    c.from("ledger_entry").select("*"),
    c.from("line_item").select("*"),
  ]);
  if (le.error) throw le.error;
  if (li.error) throw li.error;
  return { ledger: le.data, items: li.data };
}

async function pushGroups(c, groups, members) {
  if (groups.length > 0) {
    const { error } = await c.from("grp").upsert(groups, { onConflict: "id" });
    if (error) throw error;
  }
  if (members.length > 0) {
    const { error } = await c.from("grp_member").upsert(members, { onConflict: "grp_id,user_id" });
    if (error) throw error;
  }
}

async function pullGroups(c) {
  const [g, m] = await Promise.all([
    c.from("grp").select("id,name,created_by,created_at,updated_at,is_deleted"),
    c.from("grp_member").select("grp_id,user_id,joined_at,updated_at,is_deleted"),
  ]);
  if (g.error) throw g.error;
  if (m.error) throw m.error;
  const ids = [...new Set(m.data.map((r) => r.user_id))];
  const names = {};
  if (ids.length) {
    const { data, error } = await c.from("profiles").select("id,full_name").in("id", ids);
    if (error) throw error;
    data.forEach((p) => (names[p.id] = p.full_name || "Unknown"));
  }
  return { groups: g.data, members: m.data, names };
}

// services/Splits.ts fetchBalances
async function balances(c, me) {
  const { data: bal, error } = await c.from("balance_pair_me").select("user_lo,user_hi,net_cents");
  if (error) throw error;
  const friendIds = bal.map((r) => (r.user_lo === me ? r.user_hi : r.user_lo));
  const { data: friends, error: frErr } = await c.from("profiles").select("id,full_name").in("id", friendIds);
  if (frErr) throw frErr;
  const names = Object.fromEntries(friends.map((f) => [f.id, f.full_name]));
  return Object.fromEntries(
    bal.map((r) => {
      const fid = r.user_lo === me ? r.user_hi : r.user_lo;
      return [fid, { net: r.user_lo === me ? r.net_cents : -r.net_cents, name: names[fid] }];
    }),
  );
}

async function pushFunds(c, funds, entries) {
  if (funds.length > 0) {
    const { error } = await c.from("fund").upsert(funds, { onConflict: "id" });
    if (error) throw error;
  }
  if (entries.length > 0) {
    const { error } = await c.from("fund_entry").upsert(entries, { onConflict: "id" });
    if (error) throw error;
  }
}

async function pullFunds(c) {
  const [f, e] = await Promise.all([c.from("fund").select("*"), c.from("fund_entry").select("*")]);
  if (f.error) throw f.error;
  if (e.error) throw e.error;
  return { funds: f.data, entries: e.data };
}

// ── row builders (SDK row shapes) ─────────────────────────────────────────

const now = () => new Date().toISOString();
const entry = (id, created_by, o = {}) => ({
  id,
  kind: o.kind ?? "SPLIT",
  description: o.description ?? "Dinner",
  created_by,
  total_cents: o.total_cents ?? 0,
  created_at: o.created_at ?? now(),
  is_deleted: o.is_deleted ?? false,
  grp_id: o.grp_id ?? null,
});
const line = (entry_id, user_id, paid, owed) => ({
  entry_id,
  user_id,
  amount_cents: paid - owed,
  paid_cents: paid,
  owed_cents: owed,
});

const dbEntry = async (id) => (await admin.from("ledger_entry").select("*").eq("id", id).maybeSingle()).data;
const dbLines = async (id) => (await admin.from("line_item").select("*").eq("entry_id", id)).data ?? [];
const sees = async (u, id) => {
  const { ledger, items } = await pullSplits(u.c);
  return { entry: ledger.find((e) => e.id === id), lines: items.filter((i) => i.entry_id === id) };
};

// ══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log(`RLS e2e · mode=${MODE} · ${URL}`);
  const A = await makeUser("Asha");
  const B = await makeUser("Bala");
  const Cc = await makeUser("Chetan");
  const D = await makeUser("Dev");
  const E = await makeUser("Esha");

  heading("Accounts");
  await check("allow", "signup creates a profile for every user", async () => {
    const { data } = await admin.from("profiles").select("id").in("id", [A.id, B.id, Cc.id, D.id, E.id]);
    return { ok: data.length === 5, detail: `${data.length}/5 profiles` };
  });

  // ── 1:1 split ──────────────────────────────────────────────────────────
  heading("1:1 split (A paid, B owes)");
  const S1 = randomUUID();
  await check("allow", "A adds a split with B", async () => {
    await pushSplits(A.c, [entry(S1, A.id, { total_cents: 1000 })], [line(S1, A.id, 1000, 500), line(S1, B.id, 0, 500)]);
    return (await dbLines(S1)).length === 2;
  });
  await check("allow", "A views the split and both lines", async () => {
    const v = await sees(A, S1);
    return !!v.entry && v.lines.length === 2;
  });
  await check("allow", "B views the split and both lines", async () => {
    const v = await sees(B, S1);
    return !!v.entry && v.lines.length === 2;
  });
  await check("allow", "B's balances show A by name, owing 500", async () => {
    const b = await balances(B.c, B.id);
    return { ok: b[A.id]?.net === -500 && b[A.id]?.name === "Asha", detail: JSON.stringify(b[A.id]) };
  });
  await check("allow", "A's balances show B by name, owed 500", async () => {
    const b = await balances(A.c, A.id);
    return { ok: b[B.id]?.net === 500 && b[B.id]?.name === "Bala", detail: JSON.stringify(b[B.id]) };
  });
  await check("allow", "B gets a split_added notification", async () => {
    const { data, error } = await B.c.from("notifications").select("type,payload").eq("type", "split_added");
    if (error) throw error;
    return data.some((n) => n.payload?.entry_id === S1);
  });
  await check("deny", "C (not involved) can't see the split", async () => {
    const v = await sees(Cc, S1);
    return !v.entry && v.lines.length === 0;
  });
  await check("deny", "D (outsider) can't see the split", async () => {
    const v = await sees(D, S1);
    return !v.entry && v.lines.length === 0;
  });
  await check("allow", "B edits A's split (description, total, shares)", async () => {
    await pushSplits(
      B.c,
      [entry(S1, A.id, { description: "Dinner (edited by B)", total_cents: 1200 })],
      [line(S1, A.id, 1200, 600), line(S1, B.id, 0, 600)],
    );
    const e = await dbEntry(S1);
    const ls = await dbLines(S1);
    return e.description === "Dinner (edited by B)" && ls.find((l) => l.user_id === B.id).owed_cents === 600;
  });
  await check("allow", "A sees B's edit", async () => {
    const v = await sees(A, S1);
    return v.entry?.description === "Dinner (edited by B)" && v.lines.find((l) => l.user_id === B.id)?.owed_cents === 600;
  });
  await check("allow", "A edits it again", async () => {
    await pushSplits(A.c, [entry(S1, A.id, { description: "Dinner", total_cents: 1000 })], [line(S1, A.id, 1000, 500), line(S1, B.id, 0, 500)]);
    return (await dbEntry(S1)).description === "Dinner";
  });
  await check("deny", "D can't edit the split", async () => {
    await D.c.from("ledger_entry").upsert([entry(S1, A.id, { description: "hacked" })], { onConflict: "id" }).select();
    return (await dbEntry(S1)).description === "Dinner";
  });
  await check("deny", "D can't delete the split (hard delete)", async () => {
    await D.c.from("ledger_entry").delete().eq("id", S1);
    return !!(await dbEntry(S1));
  });
  await check("deny", "D can't soft-delete the split", async () => {
    await D.c.from("ledger_entry").update({ is_deleted: true }).eq("id", S1);
    return (await dbEntry(S1)).is_deleted === false;
  });
  await check("deny", "D can't add themself to the split", async () => {
    await D.c.from("line_item").upsert([line(S1, D.id, 0, 100)], { onConflict: "entry_id, user_id" });
    return !(await dbLines(S1)).some((l) => l.user_id === D.id);
  });
  await check("deny", "B can't pull outsider D into A's split", async () => {
    await B.c.from("line_item").upsert([line(S1, D.id, 0, 100)], { onConflict: "entry_id, user_id" });
    return !(await dbLines(S1)).some((l) => l.user_id === D.id);
  });
  await check("deny", "B can't make themself the split's creator", async () => {
    await B.c.from("ledger_entry").upsert([entry(S1, B.id)], { onConflict: "id" }).select();
    return (await dbEntry(S1)).created_by === A.id;
  });
  await check("allow", "B soft-deletes A's split", async () => {
    await pushSplits(B.c, [entry(S1, A.id, { is_deleted: true })], []);
    return (await dbEntry(S1)).is_deleted === true;
  });
  await check("allow", "A sees it deleted and the balance clears", async () => {
    const v = await sees(A, S1);
    const b = await balances(A.c, A.id);
    return { ok: v.entry?.is_deleted === true && (b[B.id]?.net ?? 0) === 0, detail: JSON.stringify(b[B.id]) };
  });
  await check("allow", "B can hard-delete a split A created with them", async () => {
    const T = randomUUID();
    await pushSplits(A.c, [entry(T, A.id)], [line(T, A.id, 100, 50), line(T, B.id, 0, 50)]);
    const { error } = await B.c.from("ledger_entry").delete().eq("id", T);
    if (error) throw error;
    return !(await dbEntry(T));
  });

  heading("Forged splits");
  await check("deny", "D can't create a split pretending to be A", async () => {
    const F = randomUUID();
    await D.c.from("ledger_entry").upsert([entry(F, A.id)], { onConflict: "id" }).select();
    return !(await dbEntry(F));
  });
  await check("allow", "D creates their own split with A (creator may add anyone)", async () => {
    const F = randomUUID();
    await pushSplits(D.c, [entry(F, D.id, { total_cents: 200 })], [line(F, D.id, 200, 100), line(F, A.id, 0, 100)]);
    const v = await sees(A, F);
    await admin.from("ledger_entry").delete().eq("id", F);
    return !!v.entry && v.lines.length === 2;
  });

  // ── A pays for B and C ────────────────────────────────────────────────
  heading("Split across three (A pays for B and C, no group)");
  const S2 = randomUUID();
  await check("allow", "A adds a split for B and C", async () => {
    await pushSplits(
      A.c,
      [entry(S2, A.id, { description: "Cab", total_cents: 900 })],
      [line(S2, A.id, 900, 300), line(S2, B.id, 0, 300), line(S2, Cc.id, 0, 300)],
    );
    return (await dbLines(S2)).length === 3;
  });
  for (const u of [A, B, Cc]) {
    await check("allow", `${u.name} views it with all 3 lines`, async () => {
      const v = await sees(u, S2);
      return !!v.entry && v.lines.length === 3;
    });
  }
  await check("allow", "B opens C's balances without an error (B and C settle to 0)", async () => {
    const b = await balances(B.c, B.id);
    return { ok: (b[Cc.id]?.net ?? 0) === 0 && b[A.id]?.net === -300, detail: JSON.stringify(b) };
  });
  await check("allow", "B can read C's name (they share a split)", async () => {
    const { data, error } = await B.c.from("profiles").select("id,full_name").eq("id", Cc.id);
    if (error) throw error;
    return data[0]?.full_name === "Chetan";
  });
  await check("deny", "D can't see it", async () => !(await sees(D, S2)).entry);
  await check("allow", "C edits A's split", async () => {
    await pushSplits(
      Cc.c,
      [entry(S2, A.id, { description: "Cab (C fixed)", total_cents: 900 })],
      [line(S2, A.id, 900, 400), line(S2, B.id, 0, 300), line(S2, Cc.id, 0, 200)],
    );
    return (await dbEntry(S2)).description === "Cab (C fixed)";
  });
  await check("allow", "B soft-deletes it", async () => {
    await pushSplits(B.c, [entry(S2, A.id, { description: "Cab (C fixed)", is_deleted: true })], []);
    return (await dbEntry(S2)).is_deleted === true;
  });
  await check("allow", "A and C see it deleted", async () => {
    return (await sees(A, S2)).entry?.is_deleted === true && (await sees(Cc, S2)).entry?.is_deleted === true;
  });

  heading("Settle up (PAYMENT)");
  const P1 = randomUUID();
  await check("allow", "B records paying A", async () => {
    await pushSplits(B.c, [entry(P1, B.id, { kind: "PAYMENT", description: "Settle", total_cents: 500 })], [line(P1, B.id, 500, 0), line(P1, A.id, 0, 500)]);
    return !!(await dbEntry(P1));
  });
  await check("allow", "A sees the payment", async () => !!(await sees(A, P1)).entry);
  await check("allow", "A gets a split_payment notification", async () => {
    const { data } = await A.c.from("notifications").select("type,payload").eq("type", "split_payment");
    return data.some((n) => n.payload?.entry_id === P1);
  });
  await check("allow", "A deletes the payment", async () => {
    await pushSplits(A.c, [entry(P1, B.id, { kind: "PAYMENT", description: "Settle", total_cents: 500, is_deleted: true })], []);
    return (await dbEntry(P1)).is_deleted === true;
  });

  // ── groups ─────────────────────────────────────────────────────────────
  heading("Groups");
  const G = randomUUID();
  const grp = (o = {}) => ({ id: G, name: o.name ?? "Goa trip", created_by: o.created_by ?? A.id, created_at: now(), is_deleted: o.is_deleted ?? false });
  const mem = (uid, is_deleted = false) => ({ grp_id: G, user_id: uid, joined_at: now(), is_deleted });

  await check("allow", "A creates a group with B and C", async () => {
    await pushGroups(A.c, [grp()], [mem(A.id), mem(B.id), mem(Cc.id)]);
    return (await admin.from("grp_member").select("user_id").eq("grp_id", G)).data.length === 3;
  });
  for (const u of [A, B, Cc]) {
    await check("allow", `${u.name} sees the group, 3 members and their names`, async () => {
      const r = await pullGroups(u.c);
      const ms = r.members.filter((m) => m.grp_id === G);
      const named = ms.every((m) => r.names[m.user_id] && r.names[m.user_id] !== "Unknown");
      return { ok: r.groups.some((g) => g.id === G) && ms.length === 3 && named, detail: JSON.stringify(r.names) };
    });
  }
  await check("deny", "D can't see the group or its members", async () => {
    const r = await pullGroups(D.c);
    return !r.groups.some((g) => g.id === G) && !r.members.some((m) => m.grp_id === G);
  });
  await check("deny", "D can't add themself to the group", async () => {
    await D.c.from("grp_member").upsert([mem(D.id)], { onConflict: "grp_id,user_id" });
    return !(await admin.from("grp_member").select("user_id").eq("grp_id", G).eq("user_id", D.id)).data.length;
  });
  await check("deny", "D can't rename the group", async () => {
    await D.c.from("grp").upsert([grp({ name: "pwned" })], { onConflict: "id" });
    await D.c.from("grp").upsert([grp({ name: "pwned", created_by: D.id })], { onConflict: "id" });
    return (await admin.from("grp").select("name").eq("id", G).single()).data.name === "Goa trip";
  });
  await check("allow", "B (member) renames the group", async () => {
    await pushGroups(B.c, [grp({ name: "Goa 2026" })], []);
    return (await admin.from("grp").select("name").eq("id", G).single()).data.name === "Goa 2026";
  });
  await check("deny", "B can't take over the group's creator", async () => {
    await B.c.from("grp").upsert([grp({ name: "Goa 2026", created_by: B.id })], { onConflict: "id" });
    return (await admin.from("grp").select("created_by").eq("id", G).single()).data.created_by === A.id;
  });
  await check("allow", "B adds E to the group", async () => {
    await pushGroups(B.c, [], [mem(E.id)]);
    const r = await pullGroups(E.c);
    return r.groups.some((g) => g.id === G) && r.members.filter((m) => m.grp_id === G).length === 4;
  });
  await check("allow", "E gets a group_added notification", async () => {
    const { data } = await E.c.from("notifications").select("type,payload").eq("type", "group_added");
    return data.some((n) => n.payload?.grp_id === G);
  });

  heading("Group splits");
  const GE1 = randomUUID();
  const gentry = (id, by, o = {}) => entry(id, by, { ...o, grp_id: G });
  await check("allow", "A adds a group expense (E left out as a zero line)", async () => {
    await pushSplits(
      A.c,
      [gentry(GE1, A.id, { description: "Villa", total_cents: 900 })],
      [line(GE1, A.id, 900, 300), line(GE1, B.id, 0, 300), line(GE1, Cc.id, 0, 300), line(GE1, E.id, 0, 0)],
    );
    return (await dbLines(GE1)).length === 4;
  });
  for (const u of [A, B, Cc, E]) {
    await check("allow", `${u.name} views the group expense with all lines`, async () => {
      const v = await sees(u, GE1);
      return !!v.entry && v.lines.length === 4;
    });
  }
  await check("deny", "D can't see the group expense", async () => !(await sees(D, GE1)).entry);
  await check("allow", "C edits A's group expense (brings E in)", async () => {
    await pushSplits(
      Cc.c,
      [gentry(GE1, A.id, { description: "Villa (4 ways)", total_cents: 900 })],
      [line(GE1, A.id, 900, 225), line(GE1, B.id, 0, 225), line(GE1, Cc.id, 0, 225), line(GE1, E.id, 0, 225)],
    );
    return (await dbLines(GE1)).find((l) => l.user_id === E.id).owed_cents === 225;
  });
  await check("allow", "A sees C's edit", async () => (await sees(A, GE1)).entry?.description === "Villa (4 ways)");

  const GE2 = randomUUID();
  await check("allow", "A adds a group expense with only B", async () => {
    await pushSplits(A.c, [gentry(GE2, A.id, { description: "Snacks", total_cents: 200 })], [line(GE2, A.id, 200, 100), line(GE2, B.id, 0, 100)]);
    return (await dbLines(GE2)).length === 2;
  });
  await check("allow", "C (group member, not on it) views it", async () => !!(await sees(Cc, GE2)).entry);
  await check("allow", "C edits it to add themself and E (group members)", async () => {
    await pushSplits(
      Cc.c,
      [gentry(GE2, A.id, { description: "Snacks", total_cents: 200 })],
      [line(GE2, A.id, 200, 50), line(GE2, B.id, 0, 50), line(GE2, Cc.id, 0, 50), line(GE2, E.id, 0, 50)],
    );
    return (await dbLines(GE2)).length === 4;
  });
  await check("deny", "B can't add outsider D to a group expense", async () => {
    await B.c.from("line_item").upsert([line(GE1, D.id, 0, 10)], { onConflict: "entry_id, user_id" });
    return !(await dbLines(GE1)).some((l) => l.user_id === D.id);
  });
  await check("deny", "B can't move a group expense to another group", async () => {
    const G2 = randomUUID();
    await pushGroups(B.c, [{ id: G2, name: "B's", created_by: B.id, created_at: now(), is_deleted: false }], [{ grp_id: G2, user_id: B.id, joined_at: now(), is_deleted: false }]);
    await B.c.from("ledger_entry").upsert([entry(GE1, A.id, { grp_id: G2, description: "Villa (4 ways)" })], { onConflict: "id" }).select();
    return (await dbEntry(GE1)).grp_id === G;
  });
  await check("deny", "D can't add an expense to the group", async () => {
    const X = randomUUID();
    await D.c.from("ledger_entry").upsert([gentry(X, D.id)], { onConflict: "id" }).select();
    return !(await dbEntry(X));
  });
  const GE3 = randomUUID();
  await check("allow", "B adds a group expense", async () => {
    await pushSplits(B.c, [gentry(GE3, B.id, { description: "Fuel", total_cents: 400 })], [line(GE3, B.id, 400, 200), line(GE3, A.id, 0, 200)]);
    return (await sees(A, GE3)).lines.length === 2;
  });
  await check("allow", "E soft-deletes A's group expense", async () => {
    await pushSplits(E.c, [gentry(GE1, A.id, { description: "Villa (4 ways)", is_deleted: true })], []);
    return (await dbEntry(GE1)).is_deleted === true;
  });
  await check("allow", "A and B see it deleted", async () => {
    return (await sees(A, GE1)).entry?.is_deleted === true && (await sees(B, GE1)).entry?.is_deleted === true;
  });

  heading("Removing a member");
  await check("allow", "A removes C from the group", async () => {
    await pushGroups(A.c, [], [mem(Cc.id, true)]);
    return (await admin.from("grp_member").select("is_deleted").eq("grp_id", G).eq("user_id", Cc.id).single()).data.is_deleted;
  });
  await check("allow", "C still syncs the group row and their removal", async () => {
    const r = await pullGroups(Cc.c);
    return r.groups.some((g) => g.id === G) && r.members.some((m) => m.grp_id === G && m.user_id === Cc.id && m.is_deleted);
  });
  await check("allow", "C still sees expenses they're on", async () => !!(await sees(Cc, GE2)).entry);
  await check("deny", "C no longer sees group expenses they're not on", async () => !(await sees(Cc, GE3)).entry);
  await check("deny", "C can't re-add themself", async () => {
    await Cc.c.from("grp_member").upsert([mem(Cc.id)], { onConflict: "grp_id,user_id" });
    return (await admin.from("grp_member").select("is_deleted").eq("grp_id", G).eq("user_id", Cc.id).single()).data.is_deleted;
  });
  await check("deny", "C can't add a new expense to the group", async () => {
    const X = randomUUID();
    await Cc.c.from("ledger_entry").upsert([gentry(X, Cc.id)], { onConflict: "id" }).select();
    return !(await dbEntry(X));
  });
  await check("allow", "B deletes the group", async () => {
    await pushGroups(B.c, [grp({ name: "Goa 2026", is_deleted: true })], []);
    return (await admin.from("grp").select("is_deleted").eq("id", G).single()).data.is_deleted;
  });
  await check("allow", "A sees the group deleted", async () => (await pullGroups(A.c)).groups.find((g) => g.id === G)?.is_deleted === true);

  // ── funds ──────────────────────────────────────────────────────────────
  heading("Funds");
  const F = randomUUID();
  const fund = (o = {}) => ({
    id: F, name: o.name ?? "Trip kitty", icon_name: null, icon_type: null, is_shared: true,
    owner_id: o.owner_id ?? A.id, other_participant_id: o.other ?? B.id, other_participant_name: "Bala",
    target_cents: 100000, target_date: null, created_at: now(), is_deleted: o.is_deleted ?? false,
  });
  const fentry = (id, by, o = {}) => ({
    id, fund_id: F, contributor_id: by, amount_cents: o.amount ?? 1000, direction: o.direction ?? "CONTRIBUTION",
    note: o.note ?? null, linked_transaction_id: null, created_at: now(), is_deleted: o.is_deleted ?? false,
  });
  await check("allow", "A creates a shared fund with B", async () => {
    await pushFunds(A.c, [fund()], []);
    return (await pullFunds(B.c)).funds.some((f) => f.id === F);
  });
  await check("allow", "B gets a fund_created notification", async () => {
    const { data } = await B.c.from("notifications").select("payload").eq("type", "fund_created");
    return data.some((n) => n.payload?.fund_id === F);
  });
  const FE1 = randomUUID();
  const FE2 = randomUUID();
  await check("allow", "B contributes; A sees it", async () => {
    await pushFunds(B.c, [], [fentry(FE1, B.id)]);
    return (await pullFunds(A.c)).entries.some((e) => e.id === FE1);
  });
  await check("allow", "A contributes; B sees it", async () => {
    await pushFunds(A.c, [], [fentry(FE2, A.id, { amount: 2000 })]);
    return (await pullFunds(B.c)).entries.some((e) => e.id === FE2);
  });
  await check("allow", "B renames the fund", async () => {
    await pushFunds(B.c, [fund({ name: "Goa kitty" })], []);
    return (await admin.from("fund").select("name").eq("id", F).single()).data.name === "Goa kitty";
  });
  await check("deny", "B can't take ownership of the fund", async () => {
    await B.c.from("fund").upsert([fund({ name: "Goa kitty", owner_id: B.id, other: A.id })], { onConflict: "id" });
    return (await admin.from("fund").select("owner_id").eq("id", F).single()).data.owner_id === A.id;
  });
  await check("deny", "B can't swap the other participant for D", async () => {
    await B.c.from("fund").upsert([fund({ name: "Goa kitty", other: D.id })], { onConflict: "id" });
    return (await admin.from("fund").select("other_participant_id").eq("id", F).single()).data.other_participant_id === B.id;
  });
  await check("deny", "D can't see the fund or its entries", async () => {
    const r = await pullFunds(D.c);
    return !r.funds.some((f) => f.id === F) && !r.entries.some((e) => e.fund_id === F);
  });
  await check("deny", "D can't add an entry to the fund", async () => {
    const X = randomUUID();
    await D.c.from("fund_entry").upsert([fentry(X, D.id)], { onConflict: "id" });
    return !(await admin.from("fund_entry").select("id").eq("id", X)).data.length;
  });
  await check("deny", "B can't edit A's contribution", async () => {
    await B.c.from("fund_entry").upsert([fentry(FE2, A.id, { amount: 1 })], { onConflict: "id" });
    return (await admin.from("fund_entry").select("amount_cents").eq("id", FE2).single()).data.amount_cents === 2000;
  });
  await check("allow", "B deletes their own contribution", async () => {
    await pushFunds(B.c, [], [fentry(FE1, B.id, { is_deleted: true })]);
    return (await admin.from("fund_entry").select("is_deleted").eq("id", FE1).single()).data.is_deleted;
  });
  await check("allow", "A deletes the fund", async () => {
    await pushFunds(A.c, [fund({ name: "Goa kitty", is_deleted: true })], []);
    return (await pullFunds(B.c)).funds.find((f) => f.id === F)?.is_deleted === true;
  });

  // ── profiles ───────────────────────────────────────────────────────────
  heading("Profiles");
  await check("deny", "D can't list other users' profiles", async () => {
    const { data, error } = await D.c.from("profiles").select("id,full_name");
    if (error) throw error;
    return { ok: data.every((p) => p.id === D.id), detail: `${data.length} rows visible` };
  });
  await check("deny", "D can't look up a stranger by email", async () => {
    const { data, error } = await D.c.from("profiles").select("id").ilike("email", `%${E.email.split("@")[0]}%`);
    return { ok: !!error || data.length === 0, detail: `${data?.length} rows` };
  });
  await check("deny", "B can read A's name but never A's email or phone", async () => {
    const name = await B.c.from("profiles").select("id,full_name").eq("id", A.id);
    const email = await B.c.from("profiles").select("email").eq("id", A.id);
    const phone = await B.c.from("profiles").select("phone").eq("id", A.id);
    const leaked = [email, phone].some((r) => !r.error && r.data?.some((p) => p.email || p.phone));
    return { ok: name.data?.[0]?.full_name === "Asha" && !leaked, detail: leaked ? "contact visible" : "" };
  });
  await check("deny", "a one-sided split doesn't reveal the stranger's email", async () => {
    const X = randomUUID();
    await pushSplits(D.c, [entry(X, D.id)], [line(X, D.id, 100, 50), line(X, E.id, 0, 50)]);
    const r = await D.c.from("profiles").select("email,phone").eq("id", E.id);
    await admin.from("ledger_entry").delete().eq("id", X);
    return { ok: !!r.error || !r.data?.some((p) => p.email || p.phone), detail: r.error ? "" : JSON.stringify(r.data) };
  });
  await check("allow", "profile_name resolves a scanned QR's name", async () => {
    const { data, error } = await D.c.rpc("profile_name", { pid: E.id });
    if (error) throw error;
    return data === "Esha";
  }, { hardenedOnly: true });
  await check("deny", "profile_name isn't available signed out", async () => blocked(anon.rpc("profile_name", { pid: E.id })), { hardenedOnly: true });
  await check("allow", "everyone can read their own profile", async () => {
    for (const u of [A, B, Cc, D, E]) {
      const { data } = await u.c.from("profiles").select("full_name").eq("id", u.id);
      if (data?.[0]?.full_name !== u.name) return { ok: false, detail: u.name };
    }
    return true;
  });

  // ── notifications / push tokens ────────────────────────────────────────
  heading("Notifications and push tokens");
  await check("allow", "B marks a notification read", async () => {
    const { data } = await B.c.from("notifications").select("id").limit(1);
    const { error } = await B.c.from("notifications").update({ read_at: now() }).eq("id", data[0].id);
    if (error) throw error;
    return !!(await admin.from("notifications").select("read_at").eq("id", data[0].id).single()).data.read_at;
  });
  await check("deny", "D can't read B's notifications", async () => {
    const { data } = await D.c.from("notifications").select("id").eq("user_id", B.id);
    return data.length === 0;
  });
  await check("deny", "D can't mark B's notifications read", async () => {
    const { data: n } = await admin.from("notifications").select("id").eq("user_id", B.id).is("read_at", null).limit(1);
    await D.c.from("notifications").update({ read_at: now() }).eq("id", n[0].id);
    return !(await admin.from("notifications").select("read_at").eq("id", n[0].id).single()).data.read_at;
  });
  const phone = `ExponentPushToken[${run}phone]`;
  const tokenOwners = async (t) =>
    ((await admin.from("push_tokens").select("user_id").eq("token", t)).data ?? []).map((r) => r.user_id);
  await check("allow", "A registers this phone for pushes", async () => {
    const { error } = await A.c.rpc("register_push_token", { p_token: phone, p_platform: "ios" });
    if (error) throw error;
    return (await tokenOwners(phone)).join() === A.id;
  }, { hardenedOnly: true });
  await check("allow", "registering again is harmless", async () => {
    const { error } = await A.c.rpc("register_push_token", { p_token: phone, p_platform: "ios" });
    if (error) throw error;
    return (await tokenOwners(phone)).length === 1;
  }, { hardenedOnly: true });
  await check("deny", "B signing in on A's phone takes the token over (A stops getting pushes there)", async () => {
    const { error } = await B.c.rpc("register_push_token", { p_token: phone, p_platform: "ios" });
    if (error) throw error;
    return { ok: (await tokenOwners(phone)).join() === B.id, detail: JSON.stringify(await tokenOwners(phone)) };
  }, { hardenedOnly: true });
  await check("allow", "logging out removes this phone's token", async () => {
    const { error } = await B.c.from("push_tokens").delete().eq("token", phone);
    if (error) throw error;
    return (await tokenOwners(phone)).length === 0;
  }, { hardenedOnly: true });
  await check("deny", "junk push tokens are rejected", async () =>
    blocked(D.c.rpc("register_push_token", { p_token: "https://evil.example", p_platform: "ios" })), { hardenedOnly: true });
  await check("deny", "signed out: can't register a push token", async () =>
    blocked(anon.rpc("register_push_token", { p_token: `ExponentPushToken[${run}anon]`, p_platform: "ios" })), { hardenedOnly: true });
  await A.c.rpc("register_push_token", { p_token: `ExponentPushToken[${run}asha]`, p_platform: "ios" });
  await check("deny", "D can't read A's push tokens", async () => {
    const { data } = await D.c.from("push_tokens").select("token").eq("user_id", A.id);
    return data.length === 0;
  });

  // ── API surface ────────────────────────────────────────────────────────
  heading("API surface");
  await check("deny", "signed out: no splits, groups, funds or profiles", async () => {
    for (const t of ["ledger_entry", "line_item", "grp", "grp_member", "fund", "fund_entry", "profiles", "notifications", "balance_pair_me"]) {
      const { data } = await anon.from(t).select("*").limit(1);
      if (data?.length) return { ok: false, detail: `${t} readable` };
    }
    return true;
  });
  await check("deny", "signed out: can't create a split", async () => {
    const X = randomUUID();
    await anon.from("ledger_entry").insert(entry(X, A.id));
    return !(await dbEntry(X));
  });
  await check("deny", "old membership helper isn't callable over /rpc", async () =>
    blocked(D.c.rpc("user_can_access_entry", { eid: GE2, uid: A.id })));
  await check("deny", "group-member helper isn't callable over /rpc", async () =>
    blocked(D.c.rpc("is_grp_member", { gid: G, uid: A.id })));
  await check("deny", "trigger functions aren't callable over /rpc", async () =>
    blocked(D.c.rpc("refresh_balance_pair_trg")));
  await check("deny", "users can't spend the AI quota directly", async () =>
    blocked(D.c.rpc("ai_consume_quota", { p_user: D.id, p_limit: 1000 })), { hardenedOnly: true });
  await check("allow", "AI quota counts per user per day (service role)", async () => {
    const r = [];
    for (let i = 0; i < 3; i++) r.push((await admin.rpc("ai_consume_quota", { p_user: E.id, p_limit: 2 })).data);
    return { ok: r.join() === "true,true,false", detail: r.join() };
  }, { hardenedOnly: true });

  // ── ai Edge Function (local stack runs it with a fake key, limit 3) ────
  heading("AI Edge Function");
  const ai = (c, body) => c.functions.invoke("ai", { body });
  const status = async (p) => {
    const { error } = await p;
    return error?.context?.status ?? 200;
  };
  const tinyJpeg = "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";
  const receipt = { task: "parse_receipt", image_b64: tinyJpeg, today: "2026-10-18", merchants: "", categories: "1:Food", accounts: "1:Cash" };
  await check("deny", "signed out callers are refused", async () => {
    const s = await status(ai(anon, receipt));
    return { ok: s === 401, detail: `HTTP ${s}` };
  }, { hardenedOnly: true });
  await check("deny", "unknown tasks are refused", async () => {
    const s = await status(ai(D.c, { task: "chat", prompt: "anything" }));
    return { ok: s === 400, detail: `HTTP ${s}` };
  }, { hardenedOnly: true });
  await check("deny", "oversized images are refused", async () => {
    const s = await status(ai(D.c, { ...receipt, image_b64: "A".repeat(4 * 1024 * 1024 + 4) }));
    return { ok: s === 413, detail: `HTTP ${s}` };
  }, { hardenedOnly: true });
  await check("deny", "non-image data is refused", async () => {
    const s = await status(ai(D.c, { ...receipt, image_b64: "<script>" }));
    return { ok: s === 400, detail: `HTTP ${s}` };
  }, { hardenedOnly: true });
  await check("allow", "valid scans reach OpenAI (502 with the fake key)", async () => {
    const r = [];
    for (let i = 0; i < 3; i++) r.push(await status(ai(D.c, receipt)));
    return { ok: r.every((s) => s === 502 || s === 200), detail: r.join(",") };
  }, { hardenedOnly: true });
  await check("deny", "the 4th scan of the day hits the daily limit", async () => {
    const s = await status(ai(D.c, receipt));
    return { ok: s === 429, detail: `HTTP ${s}` };
  }, { hardenedOnly: true });
  await check("allow", "the limit is per user (E can still scan)", async () => {
    const s = await status(ai(E.c, receipt));
    return { ok: s === 502 || s === 200, detail: `HTTP ${s}` };
  }, { hardenedOnly: true });

  // ── send-push (only the notifications trigger may call it) ─────────────
  heading("send-push");
  const pushUrl = `${URL}/functions/v1/send-push`;
  const callPush = async (key, body) => {
    const res = await fetch(pushUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
      body: JSON.stringify(body),
    });
    let json = null;
    try {
      json = await res.json();
    } catch {
      /* empty body */
    }
    return { status: res.status, json };
  };
  const { data: cNotes } = await admin.from("notifications").select("id").eq("user_id", Cc.id).limit(1);
  const cNoteId = cNotes?.[0]?.id;
  const spoof = {
    record: { id: cNoteId, user_id: A.id, type: "group_added", actor_id: B.id, payload: { group_name: "Verify your account at evil.example" } },
  };
  await check("deny", "anyone on the internet is refused", async () => {
    const r = await callPush(null, spoof);
    return { ok: r.status === 401, detail: `HTTP ${r.status}` };
  }, { hardenedOnly: true });
  await check("deny", "the app's public key is refused", async () => {
    const r = await callPush(ANON, spoof);
    return { ok: r.status === 401, detail: `HTTP ${r.status}` };
  }, { hardenedOnly: true });
  await check("deny", "a signed-in user is refused", async () => {
    const { data } = await D.c.auth.getSession();
    const r = await callPush(data.session.access_token, spoof);
    return { ok: r.status === 401, detail: `HTTP ${r.status}` };
  }, { hardenedOnly: true });
  await check("deny", "the trusted caller can't redirect a push (stored row wins over the body)", async () => {
    // The body says "send to A" (who has a device); the stored row is C's (no device).
    const r = await callPush(SERVICE, spoof);
    return { ok: r.status === 200 && r.json?.skipped === "no push tokens", detail: `HTTP ${r.status} ${JSON.stringify(r.json)}` };
  }, { hardenedOnly: true });
  await check("deny", "made-up notification ids go nowhere", async () => {
    const r = await callPush(SERVICE, { record: { id: randomUUID() } });
    return { ok: r.status === 404, detail: `HTTP ${r.status}` };
  }, { hardenedOnly: true });
  await check("deny", "an already-sent push is never re-sent", async () => {
    await admin.from("notifications").update({ push_sent_at: now() }).eq("id", cNoteId);
    const r = await callPush(SERVICE, { record: { id: cNoteId } });
    return { ok: r.status === 200 && r.json?.skipped === "already sent", detail: JSON.stringify(r.json) };
  }, { hardenedOnly: true });

  // ── send-mail (local: no mail password, limit 3) ─────────────────────────
  heading("send-mail");
  const pdf = Buffer.from("%PDF-1.4\n%test report\n").toString("base64");
  const mail = (c, body) => status(c.functions.invoke("send-mail", { body }));
  await check("deny", "signed out callers are refused", async () => {
    const s = await mail(anon, { to: "victim@evil.example", pdfBase64: pdf });
    return { ok: s === 401, detail: `HTTP ${s}` };
  }, { hardenedOnly: true });
  await check("deny", "non-PDF attachments are refused", async () => {
    const s = await mail(D.c, { pdfBase64: Buffer.from("<html>phish</html>").toString("base64") });
    return { ok: s === 400, detail: `HTTP ${s}` };
  }, { hardenedOnly: true });
  await check("deny", "oversized attachments are refused", async () => {
    const s = await mail(D.c, { pdfBase64: "JVBER" + "A".repeat(8 * 1024 * 1024) });
    return { ok: s === 413, detail: `HTTP ${s}` };
  }, { hardenedOnly: true });
  await check("allow", "a valid report gets as far as sending (500: no mail password locally)", async () => {
    const r = [];
    for (let i = 0; i < 3; i++) r.push(await mail(D.c, { to: "victim@evil.example", pdfBase64: pdf }));
    return { ok: r.every((x) => x === 500), detail: r.join(",") };
  }, { hardenedOnly: true });
  await check("deny", "the 4th email of the day hits the daily limit", async () => {
    const s = await mail(D.c, { pdfBase64: pdf });
    return { ok: s === 429, detail: `HTTP ${s}` };
  }, { hardenedOnly: true });

  // ── summary ────────────────────────────────────────────────────────────
  const fails = results.filter((r) => r.status === "fail");
  const open = results.filter((r) => r.status === "open");
  const pass = results.filter((r) => r.status === "pass");
  console.log(`\n${pass.length} passed · ${fails.length} failed${MODE === "baseline" ? ` · ${open.length} open holes (expected before hardening)` : ""}`);
  if (fails.length) {
    console.log(`${C.r}Failures:${C.x}`);
    fails.forEach((f) => console.log(`  ${f.section} › ${f.name} ${f.detail ? `(${f.detail})` : ""}`));
  }
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
