import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { getPricesForProducts, getProductPricesInNoumea } from "@/lib/prixnc/client";

export const dynamic = "force-dynamic";

interface RouteContext {
    params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext): Promise<NextResponse> {
    try {
        const { id } = await context.params;
        const storeIds = (new URL(request.url).searchParams.get("storeIds") ?? "")
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean);

        const offers =
            storeIds.length > 0
                ? await getPricesForProducts([id], storeIds)
                : await getProductPricesInNoumea(id);

        const sorted = [...offers].sort((a, b) => {
            const unitA = a.unitPrice ?? a.price;
            const unitB = b.unitPrice ?? b.price;
            if (unitA !== unitB) return unitA - unitB;
            return a.price - b.price;
        });

        return NextResponse.json({
            productId: id,
            offers: sorted,
            bestOffer: sorted[0] ?? null,
        });
    } catch (error) {
        return errorResponse(error);
    }
}
