import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { resolveProductImages } from "@/lib/product-images";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
    try {
        const raw = new URL(request.url).searchParams.get("codes") ?? "";
        const codes = raw.split(",");

        const images = await resolveProductImages(codes);

        return NextResponse.json({ images });
    } catch (error) {
        return errorResponse(error);
    }
}
