import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { getNoumeaStores } from "@/lib/prixnc/client";
import { normalizeText } from "@/lib/text";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
    try {
        const query = normalizeText(new URL(request.url).searchParams.get("q") ?? "");
        const stores = await getNoumeaStores();

        const filtered =
            query.length > 0
                ? stores.filter((store) => {
                    const haystack = normalizeText(`${store.label} ${store.type ?? ""} ${store.commune}`);
                    return haystack.includes(query);
                })
                : stores;

        return NextResponse.json({ stores: filtered });
    } catch (error) {
        return errorResponse(error);
    }
}
