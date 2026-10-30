import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { seedIfEmpty } from "./seed";

const globalForDb = globalThis as unknown as {
  __prixNoumeaDb?: DatabaseSync;
};

const DB_FILENAME = "app.db";

/**
 * Les plateformes serverless (Vercel, Lambda…) exposent un système de fichiers
 * en lecture seule : seul `os.tmpdir()` est accessible en écriture.
 */
function isServerlessRuntime(): boolean {
  return Boolean(
    process.env.VERCEL ||
    process.env.VERCEL_ENV ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT ||
    process.env.NETLIFY,
  );
}

function toAbsolute(target: string): string {
  // Le commentaire turbopackIgnore empêche le traceur de considérer tout le
  // projet comme une dépendance du serveur (sinon le bundle inclut la racine).
  return path.isAbsolute(target)
    ? target
    : path.join(/*turbopackIgnore: true*/ process.cwd(), target);
}

/**
 * Liste ordonnée des emplacements candidats pour le fichier SQLite.
 * Le premier chemin ouvrable en écriture est retenu.
 */
function candidateDbPaths(): string[] {
  const configured = process.env.DATABASE_PATH?.trim();
  if (configured === ":memory:") return [":memory:"];

  const ordered: string[] = [];

  if (configured) {
    ordered.push(toAbsolute(configured));
  }

  if (isServerlessRuntime()) {
    ordered.push(path.join(/*turbopackIgnore: true*/ os.tmpdir(), DB_FILENAME));
  }

  ordered.push(path.join(process.cwd(), "data", DB_FILENAME));
  ordered.push(path.join(/*turbopackIgnore: true*/ os.tmpdir(), "prix-noumea", DB_FILENAME));

  return Array.from(new Set(ordered));
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

    CREATE TABLE IF NOT EXISTS product_images (
      gencode TEXT PRIMARY KEY,
      image_url TEXT,
      thumb_url TEXT,
      source TEXT NOT NULL DEFAULT 'openfoodfacts',
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

function openDatabase(dbPath: string): DatabaseSync {
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON;");
  initializeSchema(db);
  seedIfEmpty(db);
  return db;
}

export function getDb(): DatabaseSync {
  const cached = globalForDb.__prixNoumeaDb;
  if (cached) return cached;

  const failures: string[] = [];

  for (const candidate of candidateDbPaths()) {
    try {
      const db = openDatabase(candidate);
      if (candidate !== ":memory:") {
        console.info(`[db] SQLite ouvert: ${candidate}`);
      }
      globalForDb.__prixNoumeaDb = db;
      return db;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${candidate} (${message})`);
    }
  }

  // Dernier recours : base en mémoire, réinitialisée à chaque instance.
  try {
    const db = openDatabase(":memory:");
    console.warn("[db] Repli sur une base en mémoire (aucune persistance).");
    globalForDb.__prixNoumeaDb = db;
    return db;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push(`:memory: (${message})`);
  }

  throw new Error(
    `Impossible d'ouvrir la base SQLite. Emplacements essayés : ${failures.join(" | ")}`,
  );
}
