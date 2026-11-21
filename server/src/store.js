import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const dataDir = path.resolve(here, "../data");
export const uploadsDir = path.resolve(here, "../uploads");
const dbFile = path.join(dataDir, "db.json");

const emptyData = () => ({
  settings: { displayName: "", currency: "₹", monthlyIncomeTarget: 0 },
  transactions: [],
  budgets: [],
  goals: [],
  subscriptions: [],
  receipts: []
});

let db;
let writeQueue = Promise.resolve();

export async function initStore() {
  await fs.mkdir(dataDir, {recursive:true});
  await fs.mkdir(uploadsDir, {recursive:true});
  try {
    db = JSON.parse(await fs.readFile(dbFile, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    db = emptyData();
    await persist();
  }
}
export function read() { return structuredClone(db); }
export function update(mutator) {
  const result = mutator(db);
  writeQueue = writeQueue.then(persist);
  return result;
}
async function persist() {
  const temp = dbFile + ".tmp";
  await fs.writeFile(temp, JSON.stringify(db, null, 2));
  await fs.rename(temp, dbFile);
}
export async function resetStore() {
  db = emptyData();
  await persist();
  return read();
}
