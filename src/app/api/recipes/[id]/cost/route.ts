import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { computeRecipeCost } from "@/lib/pricing/cost-service";

export const dynamic = "force-dynamic";

interface RouteContext {
    params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
    try {
        const { id } = await context.params;
        const body = (await request.json()) as {
            storeIds?: unknown;
            servings?: unknown;
        };

        const storeIds = Array.isArray(body.storeIds)
            ? body.storeIds.filter((value): value is string => typeof value === "string" && value.length > 0)
            : [];
        const servings = typeof body.servings === "number" ? body.servings : undefined;

        const result = await computeRecipeCost(id, storeIds, servings);
        return NextResponse.json(result);
    } catch (error) {
        return errorResponse(error);
    }
}
