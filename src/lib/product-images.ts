import { getCachedProductImages, saveProductImages } from "@/lib/db/repository";

/**
 * prix.nc n'expose aucun visuel produit (ni dans `/produits`, ni dans
 * `/relevesprix`). On résout donc les photos via Open Food Facts, à partir du
 * code-barres EAN (`gencod`) fourni par prix.nc.
 */
const OFF_BASE = (process.env.OFF_BASE_URL ?? "https://world.openfoodfacts.org").replace(/\/$/, "");

const OFF_FIELDS = "code,product_name,image_front_url,image_front_small_url,image_url";

/** Durée pendant laquelle une réponse (même négative) est considérée valide. */
const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 4_000;
const CONCURRENCY = 4;
const MAX_CODES = 40;

export interface ProductImage {
    url: string;
    thumbUrl: string;
    source: "openfoodfacts";
}

interface OffProduct {
    image_front_url?: string;
    image_front_small_url?: string;
    image_url?: string;
}

interface OffResponse {
    status?: number;
    product?: OffProduct;
}

function normalizeGencodes(codes: string[]): string[] {
    const unique = new Set<string>();
    for (const code of codes) {
        const trimmed = code.trim();
        if (/^[0-9]{6,14}$/.test(trimmed)) unique.add(trimmed);
        if (unique.size >= MAX_CODES) break;
    }
    return Array.from(unique);
}

async function fetchFromOpenFoodFacts(gencode: string): Promise<ProductImage | null> {
    const url = `${OFF_BASE}/api/v2/product/${gencode}.json?fields=${OFF_FIELDS}`;

    let response: Response;
    try {
        response = await fetch(url, {
            headers: {
                Accept: "application/json",
                "User-Agent": "prix-noumea-planner/0.1 (contact: app)",
            },
            // Le cache de données Next évite de rappeler l'API à chaque rendu.
            next: { revalidate: 60 * 60 * 24 * 7 },
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
    } catch {
        // Réseau indisponible ou délai dépassé : on n'échoue jamais la requête.
        return null;
    }

    if (!response.ok) return null;

    let payload: OffResponse;
    try {
        payload = (await response.json()) as OffResponse;
    } catch {
        return null;
    }

    if (payload.status !== 1 || !payload.product) return null;

    const full = payload.product.image_front_url ?? payload.product.image_url;
    if (!full) return null;

    const thumb =
        payload.product.image_front_small_url ??
        full.replace(/\.(\d+)\.(400|full)\./, ".$1.200.");

    return { url: full, thumbUrl: thumb, source: "openfoodfacts" };
}

async function mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    task: (item: T) => Promise<R>,
): Promise<R[]> {
    const results = new Array<R>(items.length);
    let cursor = 0;

    async function worker(): Promise<void> {
        while (cursor < items.length) {
            const index = cursor;
            cursor += 1;
            results[index] = await task(items[index]);
        }
    }

    const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
    await Promise.all(workers);
    return results;
}

/**
 * Résout les visuels des codes-barres demandés : cache SQLite d'abord, puis
 * Open Food Facts pour les codes manquants ou périmés.
 */
export async function resolveProductImages(
    gencodes: string[],
): Promise<Record<string, ProductImage>> {
    const codes = normalizeGencodes(gencodes);
    if (codes.length === 0) return {};

    const cached = getCachedProductImages(codes);
    const now = Date.now();
    const resolved: Record<string, ProductImage> = {};
    const missing: string[] = [];

    for (const code of codes) {
        const entry = cached.get(code);
        if (!entry) {
            missing.push(code);
            continue;
        }

        const age = now - new Date(entry.updatedAt).getTime();
        if (Number.isFinite(age) && age > CACHE_MAX_AGE_MS) {
            missing.push(code);
            continue;
        }

        if (entry.imageUrl) {
            resolved[code] = {
                url: entry.imageUrl,
                thumbUrl: entry.thumbUrl ?? entry.imageUrl,
                source: "openfoodfacts",
            };
        }
    }

    if (missing.length === 0) return resolved;

    const fetched = await mapWithConcurrency(missing, CONCURRENCY, async (code) => {
        const image = await fetchFromOpenFoodFacts(code);
        return { code, image };
    });

    const toPersist: Array<{ gencode: string; imageUrl: string | null; thumbUrl: string | null }> = [];

    for (const { code, image } of fetched) {
        toPersist.push({
            gencode: code,
            imageUrl: image?.url ?? null,
            thumbUrl: image?.thumbUrl ?? null,
        });
        if (image) resolved[code] = image;
    }

    try {
        saveProductImages(toPersist);
    } catch {
        // Le cache est un confort : un échec d'écriture ne doit pas casser la réponse.
    }

    return resolved;
}
