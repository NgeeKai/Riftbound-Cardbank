// Pulls the full Riftbound card list from a public community API and writes
// it to data/cards.json for the website to search locally.
//
// Tries Riftcodex first, and falls back to RiftScribe if that's blocked
// (some APIs reject requests from cloud/CI IP ranges or missing browser-like
// headers).
//
// Run with: node scripts/fetch-cards.js
// (Node 18+ has global fetch built in.)

import fs from "fs";
import path from "path";

const PAGE_SIZE = 100;
const MAX_PAGES = 200; // safety valve so a bug can't loop forever

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json",
};

async function fetchAllFromRiftcodex() {
  const base = "https://api.riftcodex.com/api/cards";
  let page = 1;
  let all = [];
  let total = Infinity;

  while (all.length < total && page <= MAX_PAGES) {
    const url = `${base}?limit=${PAGE_SIZE}&page=${page}`;
    const res = await fetch(url, { headers: BROWSER_HEADERS });
    if (!res.ok) {
      throw new Error(`Riftcodex request failed: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();

    total = data.total ?? data.totalCount ?? all.length;
    const items = data.items ?? data.data ?? [];
    if (items.length === 0) break;

    all = all.concat(items);
    console.log(`[riftcodex] page ${page} (${all.length}/${total})`);
    page += 1;
  }

  return all;
}

async function fetchAllFromRiftscribe() {
  const base = "https://riftscribe.gg/api/cards";
  let offset = 0;
  let all = [];
  let total = Infinity;

  while (all.length < total && offset / PAGE_SIZE <= MAX_PAGES) {
    const url = `${base}?limit=${PAGE_SIZE}&offset=${offset}`;
    const res = await fetch(url, { headers: BROWSER_HEADERS });
    if (!res.ok) {
      throw new Error(`RiftScribe request failed: ${res.status} ${res.statusText}`);
    }
    const totalHeader = res.headers.get("x-total-count");
    if (totalHeader) total = parseInt(totalHeader, 10);

    const data = await res.json();
    const items = Array.isArray(data) ? data : data.items ?? data.data ?? [];
    if (items.length === 0) break;

    all = all.concat(items);
    console.log(`[riftscribe] offset ${offset} (${all.length}${Number.isFinite(total) ? "/" + total : ""})`);
    offset += PAGE_SIZE;
    if (!Number.isFinite(total) && items.length < PAGE_SIZE) break;
  }

  return all;
}

async function fetchAllCards() {
  try {
    const cards = await fetchAllFromRiftcodex();
    if (cards.length > 0) return cards;
    console.warn("Riftcodex returned zero cards, trying RiftScribe instead.");
  } catch (err) {
    console.warn(`Riftcodex failed (${err.message}), trying RiftScribe instead.`);
  }

  return fetchAllFromRiftscribe();
}

async function main() {
  const cards = await fetchAllCards();

  if (cards.length === 0) {
    throw new Error("No cards were fetched from any source — refusing to overwrite existing cards.json with an empty file.");
  }

  const outDir = path.join(process.cwd(), "data");
  fs.mkdirSync(outDir, { recursive: true });

  const payload = {
    updatedAt: new Date().toISOString(),
    count: cards.length,
    cards,
  };

  fs.writeFileSync(path.join(outDir, "cards.json"), JSON.stringify(payload, null, 2));
  console.log(`Saved ${cards.length} cards to data/cards.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
