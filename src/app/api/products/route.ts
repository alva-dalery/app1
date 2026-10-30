import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { searchProducts } from "@/lib/prixnc/client";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
    try {
        const searchParams = new URL(request.url).searchParams;
        const query = searchParams.get("q")?.trim() ?? "";
        const page = Number(searchParams.get("page") ?? 0);
        const size = Number(searchParams.get("size") ?? 20);

        if (query.length < 2) {
            return NextResponse.json({ products: [], page: 0, size, total: 0 });
        }

        const result = await searchProducts(query, {
            page: Number.isFinite(page) ? page : 0,
            size: Number.isFinite(size) ? size : 20,
        });

        return NextResponse.json(result);
    } catch (error) {
        return errorResponse(error);
    }
}
