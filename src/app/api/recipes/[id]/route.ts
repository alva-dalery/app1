import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { deleteRecipe, getRecipe, updateRecipe } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

interface RouteContext {
    params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
    try {
        const { id } = await context.params;
        const recipe = getRecipe(id);
        if (!recipe) {
            return NextResponse.json({ error: "Recette introuvable." }, { status: 404 });
        }
        return NextResponse.json({ recipe });
    } catch (error) {
        return errorResponse(error);
    }
}

export async function PUT(request: Request, context: RouteContext): Promise<NextResponse> {
    try {
        const { id } = await context.params;
        const body = await request.json();
        const recipe = updateRecipe(id, body);
        return NextResponse.json({ recipe });
    } catch (error) {
        return errorResponse(error);
    }
}

export async function DELETE(_request: Request, context: RouteContext): Promise<NextResponse> {
    try {
        const { id } = await context.params;
        const deleted = deleteRecipe(id);
        if (!deleted) {
            return NextResponse.json({ error: "Recette introuvable." }, { status: 404 });
        }
        return NextResponse.json({ ok: true });
    } catch (error) {
        return errorResponse(error);
    }
}
