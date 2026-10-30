import { NextResponse } from "next/server";

export function errorResponse(error: unknown): NextResponse {
    const status =
        typeof (error as { status?: unknown })?.status === "number"
            ? ((error as { status: number }).status ?? 500)
            : 500;

    const message = error instanceof Error ? error.message : "Erreur inattendue.";

    if (status >= 500) {
        console.error(error);
    }

    return NextResponse.json({ error: message }, { status });
}
