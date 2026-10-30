import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { getRecipe, saveIngredientMapping, updateRecipeIngredientMapping } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

interface RouteContext {
    params: Promise<{ id: string; ingredientId: string }>;
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
    try {
        const { id, ingredientId } = await context.params;
        const recipe = getRecipe(id);
        if (!recipe) {
            return NextResponse.json({ error: "Recette introuvable." }, { status: 404 });
        }

        const ingredient = recipe.ingredients.find((item) => item.id === ingredientId);
        if (!ingredient) {
            return NextResponse.json({ error: "Ingrédient introuvable." }, { status: 404 });
        }

        const body = (await request.json()) as {
            productId?: unknown;
            productName?: unknown;
            productUnit?: unknown;
        };

        const productId = typeof body.productId === "string" ? body.productId.trim() : "";
        const productName = typeof body.productName === "string" ? body.productName.trim() : "";
        const productUnit = typeof body.productUnit === "string" ? body.productUnit : null;

        if (!productId || !productName) {
            return NextResponse.json(
                { error: "Le produit sélectionné est invalide." },
                { status: 400 },
            );
        }

        updateRecipeIngredientMapping(ingredientId, productId, productName, productUnit, "manual");
        saveIngredientMapping(ingredient.label, productId, productName, productUnit, "manual");

        return NextResponse.json({ ok: true, recipe: getRecipe(id) });
    } catch (error) {
        return errorResponse(error);
    }
}
