import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { seedIfEmpty } from "./seed";

const globalForDb = globalThis as unknown as {
  __prixNoumeaDb?: DatabaseSync;
};

function resolveDbPath(): string {
  const configured = process.env.DATABASE_PATH?.trim();
  if (!configured) return path.join(process.cwd(), "data", "app.db");
  if (configured === ":memory:") return configured;
  return path.isAbsolute(configured)
    ? configured
    : path.join(/*turbopackIgnore: true*/ process.cwd(), configured);
}

function initializeSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS canonical_ingredients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      default_unit TEXT NOT NULL DEFAULT 'g'
    );

    CREATE TABLE IF NOT EXISTS recipes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      base_servings INTEGER NOT NULL DEFAULT 4,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recipe_ingredients (
      id TEXT PRIMARY KEY,
      recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      canonical_ingredient_id TEXT REFERENCES canonical_ingredients(id),
      label TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      optional INTEGER NOT NULL DEFAULT 0,
      product_id TEXT,
      product_name TEXT,
      product_unit TEXT,
      mapping_source TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id
      ON recipe_ingredients(recipe_id);

    CREATE TABLE IF NOT EXISTS ingredient_mappings (
      ingredient_key TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      product_unit TEXT,
      source TEXT,
      updated_at TEXT NOT NULL
    );
  `);

  ensureColumn(db, "recipe_ingredients", "mapping_source", "TEXT");
  ensureColumn(db, "ingredient_mappings", "source", "TEXT");
}

function ensureColumn(
  db: DatabaseSync,
  table: string,
  column: string,
  definition: string,
): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as unknown as Array<{
    name: string;
  }>;
  if (!columns.some((entry) => entry.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function getDb(): DatabaseSync {
  if (globalForDb.__prixNoumeaDb) return globalForDb.__prixNoumeaDb;

  const dbPath = resolveDbPath();
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON;");
  initializeSchema(db);
  seedIfEmpty(db);

  globalForDb.__prixNoumeaDb = db;
  return db;
}
