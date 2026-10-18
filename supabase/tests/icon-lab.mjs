// Icon prompt lab: renders a spread of subjects through the real FLUX
// endpoint with the exact production prompt (functions/ai/icon_prompt.mjs),
// so the house style can be checked before shipping. Spends ~1 generation
// per subject on your Azure account. Never runs in CI.
//
//   node supabase/tests/icon-lab.mjs                 # asks for the key (hidden)
//   node supabase/tests/icon-lab.mjs "chai" "rent"   # custom subjects
//
// Then trace them with the Rust SDK and look at the results:
//   (cd sdk && ICON_LAB_DIR=/tmp/icon-lab cargo test icon_lab -- --ignored --nocapture)
//   open /tmp/icon-lab/sheet.html

import { mkdirSync, writeFileSync } from "node:fs";
import { cleanSubject, iconPrompt } from "../functions/ai/icon_prompt.mjs";

const FLUX_URL =
  process.env.FLUX_URL ??
  "https://expensify-resource.services.ai.azure.com/providers/blackforestlabs/v1/flux-2-pro?api-version=preview";
const OUT = process.env.ICON_LAB_DIR ?? "/tmp/icon-lab";

// Concrete objects, abstract money ideas, multi-word, non-English, and
// things that tempt the model into scenes or text.
const DEFAULT_SUBJECTS = [
  "coffee",
  "surfboard",
  "rent",
  "salary",
  "gym",
  "pet food",
  "electricity bill",
  "flight to Goa",
  "चाय",
  "Netflix subscription",
  "birthday gift for mom",
  "doctor visit",
];

async function readKey() {
  if (process.env.AZURE_API_KEY) return process.env.AZURE_API_KEY;
  process.stdout.write("Azure key (input hidden): ");
  const { stdin } = process;
  stdin.setRawMode?.(true);
  stdin.resume();
  stdin.setEncoding("utf8");
  return new Promise((resolve) => {
    let key = "";
    stdin.on("data", (ch) => {
      if (ch === "\r" || ch === "\n" || ch === "\u0004") {
        stdin.setRawMode?.(false);
        stdin.pause();
        process.stdout.write("\n");
        resolve(key.trim());
      } else if (ch === "\u0003") {
        process.exit(130);
      } else if (ch === "\u007f") {
        key = key.slice(0, -1);
      } else {
        key += ch;
      }
    });
  });
}

const slug = (s) =>
  s.normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase() || "icon";

async function generate(key, raw) {
  const cleaned = cleanSubject(raw);
  if ("error" in cleaned) return { raw, error: cleaned.error };
  const started = Date.now();
  const res = await fetch(FLUX_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ prompt: iconPrompt(cleaned.subject), model: "FLUX.2-pro", width: 512, height: 512, n: 1 }),
  });
  const ms = Date.now() - started;
  if (!res.ok) return { raw, error: `HTTP ${res.status} ${(await res.text()).slice(0, 200)}`, ms };
  const b64 = (await res.json())?.data?.[0]?.b64_json;
  if (typeof b64 !== "string") return { raw, error: "no image in response", ms };
  const ext = b64.startsWith("iVBOR") ? "png" : "jpg";
  const file = `${OUT}/${slug(cleaned.subject)}.${ext}`;
  writeFileSync(file, Buffer.from(b64, "base64"));
  return { raw, subject: cleaned.subject, file, ms };
}

const subjects = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_SUBJECTS;
mkdirSync(OUT, { recursive: true });
const key = await readKey();
if (!key) {
  console.error("No key given");
  process.exit(2);
}

const results = [];
for (let i = 0; i < subjects.length; i += 3) {
  results.push(...(await Promise.all(subjects.slice(i, i + 3).map((s) => generate(key, s)))));
}
writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
for (const r of results) {
  console.log(r.error ? `✗ ${r.raw}: ${r.error}` : `✓ ${r.raw} → ${r.file} (${r.ms} ms)`);
}
console.log(`\nSaved to ${OUT}. Next: (cd sdk && ICON_LAB_DIR=${OUT} cargo test icon_lab -- --ignored --nocapture)`);
