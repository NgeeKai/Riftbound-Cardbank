// Pulls the full Riftbound card list from the public Riftcodex API
// and writes it to data/cards.json for the website to search locally.
//
// Run with: node scripts/fetch-cards.js
// (Node 18+ has global fetch built in.)

import fs from "fs";
import path from "path";

const BASE = "https://api.riftcodex.com/api/cards";
const PAGE_SIZE = 100;
const MAX_PAGES = 200; // safety valve so a bug can't loop forever

async function fetchAllCards() {
  let page = 1;
  let all = [];
  let total = Infinity;

  while (all.length < total && page <= MAX_PAGES) {
    const url = `${BASE}?limit=${PAGE_SIZE}&page=${page}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Request to ${url} failed: ${res.status} ${res.statusText}`);
    }
    const data = await res.json();

    total = data.total ?? data.totalCount ?? all.length;
    const items = data.items ?? data.data ?? [];
    if (items.length === 0) break;

    all = all.concat(items);
    console.log(`Fetched page ${page} (${all.length}/${total} cards)`);
    page += 1;
  }

  return all;
}

async function main() {
  const cards = await fetchAllCards();

  if (cards.length === 0) {
    throw new Error("No cards were fetched — refusing to overwrite existing data.json with an empty file.");
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
