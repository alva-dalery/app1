import { normalizeText, tokenize } from "@/lib/text";
import { Product } from "@/lib/prixnc/types";

const NON_FOOD_CATEGORY_HINTS = [
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

function categoryIsFood(product: Product): boolean {
    const category = normalizeText(`${product.category ?? ""} ${product.subCategory ?? ""}`);
    return !NON_FOOD_CATEGORY_HINTS.some((hint) => category.includes(hint));
}

function scoreProduct(queryTokens: string[], query: string, product: Product): number {
    if (!categoryIsFood(product)) return -1_000;
    if (!product.bestPrice || product.bestPrice <= 0) return -1_000;

    const productName = normalizeText(product.name);
    const productTokens = new Set(tokenize(product.name));

    let score = 0;

    if (productName === query) score += 60;
    if (productName.startsWith(query)) score += 25;
    if (productName.includes(query)) score += 15;

    for (const token of queryTokens) {
        if (productTokens.has(token)) score += 10;
        else if (productName.includes(token)) score += 5;
    }

    const matchedTokens = queryTokens.filter((token) => productTokens.has(token)).length;
    if (queryTokens.length > 0 && matchedTokens === queryTokens.length) score += 20;

    const lengthPenalty = Math.max(0, productTokens.size - queryTokens.length - 2) * 1.5;
    score -= lengthPenalty;

    if (product.promotion) score += 1;

    return score;
}

export interface RankedProduct {
    product: Product;
    score: number;
}

export function rankProducts(label: string, products: Product[], limit = 8): RankedProduct[] {
    const query = normalizeText(label);
    const queryTokens = tokenize(label);

    if (queryTokens.length === 0) return [];

    return products
        .map((product) => ({
            product,
            score: scoreProduct(queryTokens, query, product),
        }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return (a.product.rank ?? 99) - (b.product.rank ?? 99);
        })
        .slice(0, limit);
}

export function pickBestProduct(label: string, products: Product[]): Product | null {
    return rankProducts(label, products, 1)[0]?.product ?? null;
}
