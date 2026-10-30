import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { createRecipe, listRecipes } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
    try {
        return NextResponse.json({ recipes: listRecipes() });
    } catch (error) {
        return errorResponse(error);
    }
}

export async function POST(request: Request): Promise<NextResponse> {
    try {
        const body = await request.json();
        const recipe = createRecipe(body);
        return NextResponse.json({ recipe }, { status: 201 });
    } catch (error) {
        return errorResponse(error);
    }
}
