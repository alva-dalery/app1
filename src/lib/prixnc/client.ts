import {
    HalCollection,
    PriceOffer,
    PrixNcBasketRaw,
    PrixNcPriceRaw,
    PrixNcProductPriceRaw,
    PrixNcStoreRaw,
    Product,
    ProductSearchResponse,
    Store,
} from "./types";
import { normalizeText, unique } from "@/lib/text";

const BASE_URL = (process.env.PRIXNC_BASE_URL ?? "https://prix.nc/api/v1").replace(/\/$/, "");
const CACHE_TTL_SECONDS = Number(process.env.PRIXNC_CACHE_TTL_SECONDS ?? 21_600);
const API_KEY = process.env.PRIXNC_API_KEY?.trim();
const AUTH_HEADER = process.env.PRIXNC_AUTH_HEADER?.trim() || "Authorization";

const NOUMEA_COMMUNE_ID = "1";

const GROCERY_TYPES = new Set([
    "Grande surface",
    "Moyenne surface",
    "Petite surface",
    "Grande surface spécialisée",
]);

const TYPE_ORDER: Record<string, number> = {
    "Grande surface": 0,
    "Moyenne surface": 1,
    "Grande surface spécialisée": 2,
    "Petite surface": 3,
};

const NON_FOOD_HINTS = [
    "animalerie",
    "entretien",
    "hygiene",
    "beaute",
    "parapharmacie",
    "pharmacie",
    "bebe",
    "papeterie",
    "bricolage",
    "jardin",
    "automobile",
    "garage",
    "banque",
    "coiffeur",
    "optique",
    "textile",
    "bijouterie",
    "electromenager",
    "sport",
    "loisir",
    "culture",
    "jouet",
];

type NextFetchInit = RequestInit & {
    next?: {
        revalidate?: number;
    };
};

export class PrixNcError extends Error {
    status: number;

    constructor(message: string, status = 502) {
        super(message);
        this.name = "PrixNcError";
        this.status = status;
    }
}

function firstEmbedded<T>(data: HalCollection<T> | null | undefined): T[] {
    if (!data?._embedded) return [];
    const key = Object.keys(data._embedded)[0];
    return key ? data._embedded[key] ?? [] : [];
}

function toIsoDate(value: number | string | undefined): string | undefined {
    if (value === undefined || value === null) return undefined;
    if (typeof value === "number") {
        return Number.isFinite(value) ? new Date(value).toISOString() : undefined;
    }
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 1_000_000_000) {
        return new Date(numeric).toISOString();
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
        Accept: "application/json",
        "User-Agent": "prix-noumea-planner/0.1",
    };

    if (API_KEY) {
        if (AUTH_HEADER.toLowerCase() === "authorization" && !/^bearer\s/i.test(API_KEY)) {
            headers[AUTH_HEADER] = `Bearer ${API_KEY}`;
        } else {
            headers[AUTH_HEADER] = API_KEY;
        }
    }

    return headers;
}

async function prixNcGet<T>(
    path: string,
    params?: Record<string, string | string[] | number | undefined>,
    options?: { revalidate?: number },
): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`);

    if (params) {
        for (const [key, value] of Object.entries(params)) {
            if (value === undefined || value === "") continue;
            if (Array.isArray(value)) {
                for (const item of value) url.searchParams.append(key, item);
            } else {
                url.searchParams.set(key, String(value));
            }
        }
    }

    const init: NextFetchInit = {
        headers: buildHeaders(),
        next: { revalidate: options?.revalidate ?? CACHE_TTL_SECONDS },
    };

    let response: Response;
    try {
        response = await fetch(url, init);
    } catch (error) {
        throw new PrixNcError(
            `Impossible de joindre prix.nc : ${error instanceof Error ? error.message : "erreur réseau"}`,
            502,
        );
    }

    if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new PrixNcError(
            `L'API prix.nc a répondu ${response.status}${body ? ` : ${body.slice(0, 180)}` : ""}`,
            response.status,
        );
    }

    return (await response.json()) as T;
}

function storeIdFrom(raw: PrixNcStoreRaw): string | undefined {
    if (raw.id) return raw.id;
    const href = raw._links?.self?.href;
    if (!href) return undefined;
    return href.split("/").filter(Boolean).pop();
}

function mapStore(raw: PrixNcStoreRaw): Store | null {
    const id = storeIdFrom(raw);
    if (!id || !raw.label) return null;

    return {
        id,
        label: raw.label,
        commune: raw.commune ?? "Nouméa",
        province: raw.province,
        type: raw.typeCommerce ?? null,
        latitude: raw.latitude,
        longitude: raw.longitude,
    };
}

export async function getNoumeaStores(): Promise<Store[]> {
    const data = await prixNcGet<HalCollection<PrixNcStoreRaw>>(
        "/magasins/search/findByIdCommuneIgnoreCaseOrderByLabelAsc",
        { idCommune: NOUMEA_COMMUNE_ID },
        { revalidate: 43_200 },
    );

    const stores = firstEmbedded(data)
        .map(mapStore)
        .filter((store): store is Store => store !== null)
        .filter((store) => store.type === null || GROCERY_TYPES.has(store.type));

    const byId = new Map<string, Store>();
    for (const store of stores) byId.set(store.id, store);

    return Array.from(byId.values()).sort((a, b) => {
        const typeDiff = (TYPE_ORDER[a.type ?? ""] ?? 9) - (TYPE_ORDER[b.type ?? ""] ?? 9);
        if (typeDiff !== 0) return typeDiff;
        return a.label.localeCompare(b.label, "fr");
    });
}

function toProduct(raw: PrixNcProductPriceRaw): Product | null {
    if (!raw.idProduit || !raw.nom) return null;
    return {
        id: raw.idProduit,
        name: raw.nom,
        brand: raw.marque,
        gencode: raw.gencod,
        category: raw.secteurConso,
        subCategory: raw.sousSecteurConso,
        bestPrice: raw.meilleurPrix,
        bestUnitPrice: raw.meilleurPrixParUnite,
        unitLabel: raw.uniteLabel,
        unitShort: raw.uniteLabelCourt,
        promotion: Boolean(raw.promotion),
        score: raw.score,
        rank: raw.rank,
    };
}

function isFoodProduct(product: Product): boolean {
    const haystack = normalizeText(`${product.category ?? ""} ${product.subCategory ?? ""}`);
    return !NON_FOOD_HINTS.some((hint) => haystack.includes(hint));
}

export async function searchProducts(
    query: string,
    options?: { page?: number; size?: number },
): Promise<ProductSearchResponse> {
    const trimmed = query.trim();
    const page = Math.max(0, options?.page ?? 0);
    const size = Math.min(50, Math.max(1, options?.size ?? 20));

    if (trimmed.length < 2) {
        return { products: [], page, size, total: 0 };
    }

    const data = await prixNcGet<HalCollection<PrixNcProductPriceRaw>>(
        "/produitsprix/search",
        {
            nom: trimmed,
            communeIds: NOUMEA_COMMUNE_ID,
            page,
            size,
        },
        { revalidate: 10_800 },
    );

    const rows = firstEmbedded(data);
    const products = rows
        .map(toProduct)
        .filter((product): product is Product => product !== null)
        .filter(isFoodProduct);

    const deduped = new Map<string, Product>();
    for (const product of products) {
        if (!deduped.has(product.id)) deduped.set(product.id, product);
    }

    return {
        products: Array.from(deduped.values()),
        page: data.page?.number ?? page,
        size: data.page?.size ?? size,
        total: data.page?.totalElements ?? products.length,
    };
}

function mapPriceOffer(raw: PrixNcPriceRaw): PriceOffer | null {
    if (!raw.idProduit || !raw.idMagasin || typeof raw.prix !== "number") return null;
    return {
        productId: raw.idProduit,
        productName: raw.nom ?? "Produit",
        storeId: raw.idMagasin,
        storeLabel: raw.magasin ?? "Magasin",
        price: raw.prix,
        unitPrice: raw.prixParUnite,
        unitLabel: raw.uniteLabel,
        unitShort: raw.uniteLabelCourt,
        promotion: Boolean(raw.promotion),
        observedAt: toIsoDate(raw.dateReleve),
    };
}

export async function getPricesForProducts(
    productIds: string[],
    storeIds: string[],
): Promise<PriceOffer[]> {
    const uniqueProducts = unique(productIds.filter(Boolean));
    const uniqueStores = unique(storeIds.filter(Boolean));
    if (uniqueProducts.length === 0 || uniqueStores.length === 0) return [];

    const data = await prixNcGet<HalCollection<PrixNcPriceRaw>>(
        "/relevesprix/search/findByIdProduitInAndIdMagasinIn",
        {
            produitIds: uniqueProducts.join(","),
            magasinIds: uniqueStores.join(","),
        },
        { revalidate: 10_800 },
    );

    return firstEmbedded(data)
        .map(mapPriceOffer)
        .filter((offer): offer is PriceOffer => offer !== null);
}

export async function getProductPricesInNoumea(productId: string): Promise<PriceOffer[]> {
    const data = await prixNcGet<HalCollection<PrixNcPriceRaw>>(
        "/relevesprix/search/findByIdProduitAndIdCommuneInOrderByPrixParUniteAsc",
        {
            idProduit: productId,
            idCommune: NOUMEA_COMMUNE_ID,
        },
        { revalidate: 10_800 },
    );

    return firstEmbedded(data)
        .map(mapPriceOffer)
        .filter((offer): offer is PriceOffer => offer !== null);
}

export async function compareBasket(
    productIds: string[],
    quantities: number[],
    storeIds: string[],
): Promise<PrixNcBasketRaw | null> {
    if (storeIds.length < 2) {
        throw new PrixNcError("La comparaison de panier nécessite au moins deux magasins.", 400);
    }

    const data = await prixNcGet<HalCollection<PrixNcBasketRaw>>(
        "/paniers/comparaison",
        {
            produitIds: productIds.join(","),
            quantites: quantities.join(","),
            magasinIds: storeIds.join(","),
        },
        { revalidate: 3_600 },
    );

    return firstEmbedded(data)[0] ?? null;
}

export async function findStore(storeId: string): Promise<Store | undefined> {
    const stores = await getNoumeaStores();
    return stores.find((store) => store.id === storeId);
}
