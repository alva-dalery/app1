import type { DatabaseSync } from "node:sqlite";

interface SeedIngredient {
    id: string;
    label: string;
    quantity: number;
    unit: string;
    canonicalId: string;
    optional?: boolean;
}

interface SeedRecipe {
    id: string;
    name: string;
    description: string;
    baseServings: number;
    ingredients: SeedIngredient[];
}

const CANONICAL_INGREDIENTS: Array<{
    id: string;
    name: string;
    category: string;
    defaultUnit: string;
}> = [
        { id: "c-poulet", name: "Poulet", category: "Viande", defaultUnit: "g" },
        { id: "c-riz", name: "Riz", category: "Féculent", defaultUnit: "g" },
        { id: "c-lait-coco", name: "Lait de coco", category: "Épicerie", defaultUnit: "ml" },
        { id: "c-oignon", name: "Oignon", category: "Légume", defaultUnit: "g" },
        { id: "c-ail", name: "Ail", category: "Légume", defaultUnit: "g" },
        { id: "c-curry", name: "Curry", category: "Épice", defaultUnit: "g" },
        { id: "c-huile", name: "Huile", category: "Matière grasse", defaultUnit: "ml" },
        { id: "c-sel", name: "Sel", category: "Épicerie", defaultUnit: "g" },
        { id: "c-tomate", name: "Tomate", category: "Légume", defaultUnit: "g" },
        { id: "c-huile-olive", name: "Huile d'olive", category: "Matière grasse", defaultUnit: "ml" },
        { id: "c-vinaigre", name: "Vinaigre", category: "Épicerie", defaultUnit: "ml" },
        { id: "c-poivre", name: "Poivre", category: "Épice", defaultUnit: "g" },
        { id: "c-carotte", name: "Carotte", category: "Légume", defaultUnit: "g" },
        { id: "c-courgette", name: "Courgette", category: "Légume", defaultUnit: "g" },
        { id: "c-oeuf", name: "Œuf", category: "Œuf", defaultUnit: "unité" },
        { id: "c-sauce-soja", name: "Sauce soja", category: "Épicerie", defaultUnit: "ml" },
    ];

const RECIPES: SeedRecipe[] = [
    {
        id: "recipe-poulet-curry-coco",
        name: "Poulet curry coco",
        description:
            "Un curry doux et crémeux, parfait avec du riz jasmin. Recette économique pour quatre personnes.",
        baseServings: 4,
        ingredients: [
            { id: "ri-poulet-1", label: "Poulet", quantity: 600, unit: "g", canonicalId: "c-poulet" },
            { id: "ri-poulet-2", label: "Riz", quantity: 400, unit: "g", canonicalId: "c-riz" },
            { id: "ri-poulet-3", label: "Lait de coco", quantity: 400, unit: "ml", canonicalId: "c-lait-coco" },
            { id: "ri-poulet-4", label: "Oignon", quantity: 200, unit: "g", canonicalId: "c-oignon" },
            { id: "ri-poulet-5", label: "Ail", quantity: 10, unit: "g", canonicalId: "c-ail" },
            { id: "ri-poulet-6", label: "Curry", quantity: 10, unit: "g", canonicalId: "c-curry" },
            { id: "ri-poulet-7", label: "Huile", quantity: 20, unit: "ml", canonicalId: "c-huile" },
            { id: "ri-poulet-8", label: "Sel", quantity: 5, unit: "g", canonicalId: "c-sel" },
        ],
    },
    {
        id: "recipe-salade-tomates",
        name: "Salade de tomates",
        description: "Une salade fraîche et rapide, idéale en accompagnement.",
        baseServings: 2,
        ingredients: [
            { id: "ri-salade-1", label: "Tomate", quantity: 400, unit: "g", canonicalId: "c-tomate" },
            { id: "ri-salade-2", label: "Oignon", quantity: 100, unit: "g", canonicalId: "c-oignon" },
            { id: "ri-salade-3", label: "Huile d'olive", quantity: 20, unit: "ml", canonicalId: "c-huile-olive" },
            { id: "ri-salade-4", label: "Vinaigre", quantity: 10, unit: "ml", canonicalId: "c-vinaigre" },
            { id: "ri-salade-5", label: "Sel", quantity: 2, unit: "g", canonicalId: "c-sel" },
            { id: "ri-salade-6", label: "Poivre", quantity: 1, unit: "g", canonicalId: "c-poivre", optional: true },
        ],
    },
    {
        id: "recipe-riz-saute-legumes",
        name: "Riz sauté aux légumes",
        description: "Un riz sauté complet et coloré, avec œufs et légumes de saison.",
        baseServings: 4,
        ingredients: [
            { id: "ri-saute-1", label: "Riz", quantity: 400, unit: "g", canonicalId: "c-riz" },
            { id: "ri-saute-2", label: "Carotte", quantity: 200, unit: "g", canonicalId: "c-carotte" },
            { id: "ri-saute-3", label: "Courgette", quantity: 200, unit: "g", canonicalId: "c-courgette" },
            { id: "ri-saute-4", label: "Oignon", quantity: 100, unit: "g", canonicalId: "c-oignon" },
            { id: "ri-saute-5", label: "Œufs", quantity: 2, unit: "unité", canonicalId: "c-oeuf" },
            { id: "ri-saute-6", label: "Huile", quantity: 20, unit: "ml", canonicalId: "c-huile" },
            { id: "ri-saute-7", label: "Sauce soja", quantity: 30, unit: "ml", canonicalId: "c-sauce-soja" },
            { id: "ri-saute-8", label: "Ail", quantity: 5, unit: "g", canonicalId: "c-ail", optional: true },
        ],
    },
];

export function seedIfEmpty(db: DatabaseSync): void {
    const seeded = db.prepare("SELECT value FROM app_meta WHERE key = 'seeded'").get() as
        | { value: string }
        | undefined;
    if (seeded) return;

    const now = new Date().toISOString();

    db.exec("BEGIN");
    try {
        for (const ingredient of CANONICAL_INGREDIENTS) {
            db.prepare(
                `INSERT OR IGNORE INTO canonical_ingredients (id, name, category, default_unit)
         VALUES (?, ?, ?, ?)`,
            ).run(ingredient.id, ingredient.name, ingredient.category, ingredient.defaultUnit);
        }

        for (const recipe of RECIPES) {
            db.prepare(
                `INSERT OR IGNORE INTO recipes (id, name, description, base_servings, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
            ).run(recipe.id, recipe.name, recipe.description, recipe.baseServings, now, now);

            for (const ingredient of recipe.ingredients) {
                db.prepare(
                    `INSERT OR IGNORE INTO recipe_ingredients
            (id, recipe_id, canonical_ingredient_id, label, quantity, unit, optional, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                ).run(
                    ingredient.id,
                    recipe.id,
                    ingredient.canonicalId,
                    ingredient.label,
                    ingredient.quantity,
                    ingredient.unit,
                    ingredient.optional ? 1 : 0,
                    now,
                );
            }
        }

        db.prepare("INSERT INTO app_meta (key, value) VALUES ('seeded', '1')").run();
        db.exec("COMMIT");
    } catch (error) {
        db.exec("ROLLBACK");
        throw error;
    }
}
