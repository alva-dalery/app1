import { randomUUID } from "node:crypto";
import { getUnitInfo } from "@/lib/pricing/units";
import { ingredientKey } from "@/lib/text";
import { getDb } from "./index";

export class RecipeValidationError extends Error {
    status = 400;

    constructor(message: string) {
        super(message);
        this.name = "RecipeValidationError";
    }
}

export interface RecipeIngredientInput {
    id?: string;
    label: string;
    quantity: number;
    unit: string;
    optional?: boolean;
}

export interface RecipeInput {
    name: string;
    description?: string;
    baseServings: number;
    ingredients: RecipeIngredientInput[];
}

export type MappingSource = "manual" | "auto" | null;

export interface RecipeIngredient {
    id: string;
    recipeId: string;
    canonicalIngredientId: string | null;
    label: string;
    quantity: number;
    unit: string;
    optional: boolean;
    productId: string | null;
    productName: string | null;
    productUnit: string | null;
    mappingSource: MappingSource;
}

export interface Recipe {
    id: string;
    name: string;
    description: string;
    baseServings: number;
    createdAt: string;
    updatedAt: string;
    ingredients: RecipeIngredient[];
}

export interface RecipeSummary {
    id: string;
    name: string;
    description: string;
    baseServings: number;
    createdAt: string;
    updatedAt: string;
    ingredientCount: number;
}

interface RecipeRow {
    id: string;
    name: string;
    description: string;
    base_servings: number;
    created_at: string;
    updated_at: string;
    ingredient_count?: number;
}

interface IngredientRow {
    id: string;
    recipe_id: string;
    canonical_ingredient_id: string | null;
    label: string;
    quantity: number;
    unit: string;
    optional: number;
    product_id: string | null;
    product_name: string | null;
    product_unit: string | null;
    mapping_source: string | null;
}

interface MappingRow {
    ingredient_key: string;
    product_id: string;
    product_name: string;
    product_unit: string | null;
    source: string | null;
}

export interface IngredientMapping {
    productId: string;
    productName: string;
    productUnit: string | null;
    source: MappingSource;
}

function mapIngredient(row: IngredientRow): RecipeIngredient {
    return {
        id: row.id,
        recipeId: row.recipe_id,
        canonicalIngredientId: row.canonical_ingredient_id,
        label: row.label,
        quantity: row.quantity,
        unit: row.unit,
        optional: Boolean(row.optional),
        productId: row.product_id,
        productName: row.product_name,
        productUnit: row.product_unit,
        mappingSource:
            row.mapping_source === "manual" || row.mapping_source === "auto"
                ? row.mapping_source
                : null,
    };
}

function validateRecipeInput(input: RecipeInput): RecipeInput {
    const name = input.name?.trim();
    if (!name) throw new RecipeValidationError("Le nom de la recette est obligatoire.");
    if (name.length > 120) throw new RecipeValidationError("Le nom de la recette est trop long.");

    const baseServings = Number(input.baseServings);
    if (!Number.isInteger(baseServings) || baseServings < 1 || baseServings > 100) {
        throw new RecipeValidationError("Le nombre de portions doit être compris entre 1 et 100.");
    }

    if (!Array.isArray(input.ingredients) || input.ingredients.length === 0) {
        throw new RecipeValidationError("Ajoutez au moins un ingrédient.");
    }

    if (input.ingredients.length > 60) {
        throw new RecipeValidationError("La recette contient trop d'ingrédients.");
    }

    const ingredients = input.ingredients.map((ingredient) => {
        const label = ingredient.label?.trim();
        if (!label) throw new RecipeValidationError("Chaque ingrédient doit avoir un nom.");

        const quantity = Number(ingredient.quantity);
        if (!Number.isFinite(quantity) || quantity <= 0) {
            throw new RecipeValidationError(`Quantité invalide pour « ${label} ».`);
        }

        if (!getUnitInfo(ingredient.unit)) {
            throw new RecipeValidationError(`Unité invalide pour « ${label} » : ${ingredient.unit}.`);
        }

        return {
            id: ingredient.id,
            label,
            quantity,
            unit: ingredient.unit,
            optional: Boolean(ingredient.optional),
        };
    });

    return {
        name,
        description: input.description?.trim() ?? "",
        baseServings,
        ingredients,
    };
}

export function listRecipes(): RecipeSummary[] {
    const db = getDb();
    const rows = db
        .prepare(
            `SELECT r.id, r.name, r.description, r.base_servings, r.created_at, r.updated_at,
              COUNT(ri.id) AS ingredient_count
       FROM recipes r
       LEFT JOIN recipe_ingredients ri ON ri.recipe_id = r.id
       GROUP BY r.id
       ORDER BY r.created_at DESC`,
        )
        .all() as unknown as RecipeRow[];

    return rows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        baseServings: row.base_servings,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        ingredientCount: row.ingredient_count ?? 0,
    }));
}

export function getRecipe(id: string): Recipe | null {
    const db = getDb();
    const row = db
        .prepare(
            `SELECT id, name, description, base_servings, created_at, updated_at
       FROM recipes WHERE id = ?`,
        )
        .get(id) as RecipeRow | undefined;

    if (!row) return null;

    const ingredients = db
        .prepare(
            `SELECT id, recipe_id, canonical_ingredient_id, label, quantity, unit, optional,
              product_id, product_name, product_unit, mapping_source
       FROM recipe_ingredients
       WHERE recipe_id = ?
       ORDER BY rowid ASC`,
        )
        .all(id) as unknown as IngredientRow[];

    return {
        id: row.id,
        name: row.name,
        description: row.description,
        baseServings: row.base_servings,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        ingredients: ingredients.map(mapIngredient),
    };
}

export function createRecipe(input: RecipeInput): Recipe {
    const db = getDb();
    const validated = validateRecipeInput(input);
    const id = randomUUID();
    const now = new Date().toISOString();

    db.exec("BEGIN");
    try {
        db.prepare(
            `INSERT INTO recipes (id, name, description, base_servings, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
        ).run(id, validated.name, validated.description ?? "", validated.baseServings, now, now);

        for (const ingredient of validated.ingredients) {
            db.prepare(
                `INSERT INTO recipe_ingredients
          (id, recipe_id, canonical_ingredient_id, label, quantity, unit, optional, created_at)
         VALUES (?, ?, NULL, ?, ?, ?, ?, ?)`,
            ).run(
                randomUUID(),
                id,
                ingredient.label,
                ingredient.quantity,
                ingredient.unit,
                ingredient.optional ? 1 : 0,
                now,
            );
        }

        db.exec("COMMIT");
    } catch (error) {
        db.exec("ROLLBACK");
        throw error;
    }

    const recipe = getRecipe(id);
    if (!recipe) throw new Error("La recette créée est introuvable.");
    return recipe;
}

export function updateRecipe(id: string, input: RecipeInput): Recipe {
    const db = getDb();
    const existing = getRecipe(id);
    if (!existing) throw new RecipeValidationError("Recette introuvable.");

    const validated = validateRecipeInput(input);
    const now = new Date().toISOString();
    const existingIds = new Set(existing.ingredients.map((ingredient) => ingredient.id));
    const keptIds = new Set<string>();

    db.exec("BEGIN");
    try {
        db.prepare(
            `UPDATE recipes SET name = ?, description = ?, base_servings = ?, updated_at = ?
       WHERE id = ?`,
        ).run(validated.name, validated.description ?? "", validated.baseServings, now, id);

        for (const ingredient of validated.ingredients) {
            if (ingredient.id && existingIds.has(ingredient.id)) {
                db.prepare(
                    `UPDATE recipe_ingredients
           SET label = ?, quantity = ?, unit = ?, optional = ?
           WHERE id = ? AND recipe_id = ?`,
                ).run(
                    ingredient.label,
                    ingredient.quantity,
                    ingredient.unit,
                    ingredient.optional ? 1 : 0,
                    ingredient.id,
                    id,
                );
                keptIds.add(ingredient.id);
            } else {
                const newId = randomUUID();
                db.prepare(
                    `INSERT INTO recipe_ingredients
            (id, recipe_id, canonical_ingredient_id, label, quantity, unit, optional, created_at)
           VALUES (?, ?, NULL, ?, ?, ?, ?, ?)`,
                ).run(
                    newId,
                    id,
                    ingredient.label,
                    ingredient.quantity,
                    ingredient.unit,
                    ingredient.optional ? 1 : 0,
                    now,
                );
                keptIds.add(newId);
            }
        }

        for (const existingId of existingIds) {
            if (!keptIds.has(existingId)) {
                db.prepare("DELETE FROM recipe_ingredients WHERE id = ? AND recipe_id = ?").run(existingId, id);
            }
        }

        db.exec("COMMIT");
    } catch (error) {
        db.exec("ROLLBACK");
        throw error;
    }

    const recipe = getRecipe(id);
    if (!recipe) throw new Error("La recette mise à jour est introuvable.");
    return recipe;
}

export function deleteRecipe(id: string): boolean {
    const db = getDb();
    const result = db.prepare("DELETE FROM recipes WHERE id = ?").run(id);
    return result.changes > 0;
}

export function updateRecipeIngredientMapping(
    ingredientId: string,
    productId: string,
    productName: string,
    productUnit?: string | null,
    source: MappingSource = "auto",
): boolean {
    const db = getDb();
    const result = db
        .prepare(
            `UPDATE recipe_ingredients
       SET product_id = ?, product_name = ?, product_unit = ?, mapping_source = ?
       WHERE id = ?`,
        )
        .run(productId, productName, productUnit ?? null, source, ingredientId);
    return result.changes > 0;
}

export function getIngredientMapping(label: string): IngredientMapping | null {
    const key = ingredientKey(label);
    if (!key) return null;

    const db = getDb();
    const row = db
        .prepare(
            `SELECT ingredient_key, product_id, product_name, product_unit, source
       FROM ingredient_mappings WHERE ingredient_key = ?`,
        )
        .get(key) as MappingRow | undefined;

    if (!row) return null;

    return {
        productId: row.product_id,
        productName: row.product_name,
        productUnit: row.product_unit,
        source: row.source === "manual" || row.source === "auto" ? row.source : null,
    };
}

export function saveIngredientMapping(
    label: string,
    productId: string,
    productName: string,
    productUnit?: string | null,
    source: MappingSource = "auto",
): void {
    const key = ingredientKey(label);
    if (!key) return;

    const db = getDb();
    db.prepare(
        `INSERT INTO ingredient_mappings (ingredient_key, product_id, product_name, product_unit, source, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(ingredient_key) DO UPDATE SET
       product_id = excluded.product_id,
       product_name = excluded.product_name,
       product_unit = excluded.product_unit,
       source = excluded.source,
       updated_at = excluded.updated_at`,
    ).run(key, productId, productName, productUnit ?? null, source, new Date().toISOString());
}
