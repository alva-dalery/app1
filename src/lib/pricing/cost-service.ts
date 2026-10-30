import { getNoumeaStores, getPricesForProducts, searchProducts } from "@/lib/prixnc/client";
import { PriceOffer, Product, Store } from "@/lib/prixnc/types";
import {
    getIngredientMapping,
    getRecipe,
    Recipe,
    saveIngredientMapping,
    updateRecipeIngredientMapping,
} from "@/lib/db/repository";
import { rankProducts } from "@/lib/ingredient-matching";
import { unique } from "@/lib/text";
import { calculateRecipeCost, CostResult, EngineIngredient } from "./engine";
import { inferPackInfo, toBase } from "./units";

export class CostServiceError extends Error {
    status: number;

    constructor(message: string, status = 400) {
        super(message);
        this.name = "CostServiceError";
        this.status = status;
    }
}

export interface AutoMappedIngredient {
    ingredientId: string;
    label: string;
    productId: string;
    productName: string;
}

export interface RecipeCostResponse extends CostResult {
    recipe: {
        id: string;
        name: string;
        description: string;
        baseServings: number;
        ingredientCount: number;
    };
    selectedStores: Array<{ id: string; label: string }>;
    autoMapped: AutoMappedIngredient[];
    unresolved: Array<{ ingredientId: string; label: string }>;
}

interface Candidate {
    product: Product;
    score: number;
    source: "saved" | "search";
}

interface CandidateWithOffers extends Candidate {
    offers: PriceOffer[];
    bestUnitPrice: number;
    estimatedPurchase: number;
}

function assertServings(value: number): number {
    if (!Number.isFinite(value) || value < 1 || value > 100) {
        throw new CostServiceError("Le nombre de portions doit être compris entre 1 et 100.");
    }
    return Math.round(value);
}

function groupOffersByProduct(offers: PriceOffer[]): Map<string, PriceOffer[]> {
    const grouped = new Map<string, PriceOffer[]>();
    for (const offer of offers) {
        const existing = grouped.get(offer.productId);
        if (existing) existing.push(offer);
        else grouped.set(offer.productId, [offer]);
    }
    return grouped;
}

async function resolveStores(storeIds: string[]): Promise<Store[]> {
    const requested = unique(storeIds.filter(Boolean));
    if (requested.length === 0) {
        throw new CostServiceError("Sélectionnez au moins un magasin.");
    }
    if (requested.length > 2) {
        throw new CostServiceError("Sélectionnez un ou deux magasins maximum.");
    }

    const allStores = await getNoumeaStores();
    const byId = new Map(allStores.map((store) => [store.id, store]));
    const stores = requested.map((id) => byId.get(id));

    if (stores.some((store) => !store)) {
        throw new CostServiceError("Un des magasins sélectionnés est inconnu.", 404);
    }

    return stores as Store[];
}

function bestUnitPrice(offers: PriceOffer[]): number {
    return offers.reduce((minimum, offer) => {
        const value = offer.unitPrice ?? offer.price;
        return Number.isFinite(value) ? Math.min(minimum, value) : minimum;
    }, Number.POSITIVE_INFINITY);
}

function estimatePurchaseCost(
    productName: string,
    offer: PriceOffer,
    quantity: number,
    unit: string,
): number | null {
    try {
        const needed = toBase(quantity, unit);
        const pack = inferPackInfo(
            productName,
            offer.price,
            offer.unitPrice,
            offer.unitLabel,
            offer.unitShort,
        );

        if (!pack.dimension || pack.dimension !== needed.dimension) return null;

        if (pack.packaged) {
            const packSize = pack.packSizeBase && pack.packSizeBase > 0 ? pack.packSizeBase : needed.value;
            return Math.ceil(needed.value / packSize) * offer.price;
        }

        if (offer.unitPrice && pack.unitFactor && pack.unitFactor > 0) {
            return (needed.value / pack.unitFactor) * offer.unitPrice;
        }

        if (pack.packSizeBase && pack.packSizeBase > 0) {
            return (needed.value / pack.packSizeBase) * offer.price;
        }

        return offer.price;
    } catch {
        return null;
    }
}

export async function computeRecipeCost(
    recipeId: string,
    storeIds: string[],
    requestedServings?: number,
): Promise<RecipeCostResponse> {
    const recipe = getRecipe(recipeId);
    if (!recipe) throw new CostServiceError("Recette introuvable.", 404);

    const stores = await resolveStores(storeIds);
    const servings = assertServings(requestedServings ?? recipe.baseServings);
    const selectedStoreIds = stores.map((store) => store.id);

    const autoMapped: AutoMappedIngredient[] = [];
    const unresolved: Array<{ ingredientId: string; label: string }> = [];

    const fixedProducts = new Map<string, { productId: string; productName: string }>();
    const candidateProducts = new Map<string, Candidate[]>();
    const candidateIds = new Set<string>();

    for (const ingredient of recipe.ingredients) {
        // Un mapping manuel est une décision de l'utilisateur : on ne le remplace pas.
        if (ingredient.productId && ingredient.mappingSource === "manual") {
            fixedProducts.set(ingredient.id, {
                productId: ingredient.productId,
                productName: ingredient.productName ?? "Produit associé",
            });
            candidateIds.add(ingredient.productId);
            continue;
        }

        const candidates: Candidate[] = [];

        if (ingredient.productId) {
            candidates.push({
                product: {
                    id: ingredient.productId,
                    name: ingredient.productName ?? "Produit associé",
                    unitShort: ingredient.productUnit ?? undefined,
                },
                score: 50,
                source: "saved",
            });
            candidateIds.add(ingredient.productId);
        }

        const savedMapping = getIngredientMapping(ingredient.label);

        if (savedMapping) {
            if (savedMapping.source === "manual") {
                fixedProducts.set(ingredient.id, {
                    productId: savedMapping.productId,
                    productName: savedMapping.productName,
                });
                candidateIds.add(savedMapping.productId);
                continue;
            }

            if (!candidates.some((candidate) => candidate.product.id === savedMapping.productId)) {
                candidates.push({
                    product: {
                        id: savedMapping.productId,
                        name: savedMapping.productName,
                        unitShort: savedMapping.productUnit ?? undefined,
                    },
                    score: 50,
                    source: "saved",
                });
            }
        }

        const found = await searchProducts(ingredient.label, { size: 50 });
        for (const ranked of rankProducts(ingredient.label, found.products, 12)) {
            if (candidates.some((candidate) => candidate.product.id === ranked.product.id)) continue;
            candidates.push({ product: ranked.product, score: ranked.score, source: "search" });
        }

        if (candidates.length === 0) {
            unresolved.push({ ingredientId: ingredient.id, label: ingredient.label });
            continue;
        }

        candidateProducts.set(ingredient.id, candidates);
        for (const candidate of candidates) candidateIds.add(candidate.product.id);
    }

    const allProductIds = Array.from(candidateIds);
    const offers =
        allProductIds.length > 0
            ? await getPricesForProducts(allProductIds, selectedStoreIds)
            : [];
    const offersByProduct = groupOffersByProduct(offers);

    const resolved: Array<
        Recipe["ingredients"][number] & {
            productId: string | null;
            productName: string | null;
        }
    > = [];

    for (const ingredient of recipe.ingredients) {
        const fixed = fixedProducts.get(ingredient.id);
        if (fixed) {
            resolved.push({
                ...ingredient,
                productId: fixed.productId,
                productName: fixed.productName,
            });
            continue;
        }

        const candidates = candidateProducts.get(ingredient.id) ?? [];
        const scaledQuantity = ingredient.quantity * (servings / recipe.baseServings);
        const available: CandidateWithOffers[] = candidates
            .map((candidate) => {
                const productOffers = offersByProduct.get(candidate.product.id) ?? [];
                const estimates = productOffers
                    .map((offer) =>
                        estimatePurchaseCost(
                            candidate.product.name,
                            offer,
                            scaledQuantity,
                            ingredient.unit,
                        ),
                    )
                    .filter((value): value is number => value !== null && Number.isFinite(value));

                return {
                    ...candidate,
                    offers: productOffers,
                    bestUnitPrice: bestUnitPrice(productOffers),
                    estimatedPurchase:
                        estimates.length > 0 ? Math.min(...estimates) : Number.POSITIVE_INFINITY,
                };
            })
            .filter((candidate) => candidate.offers.length > 0);

        const topScore = available.reduce(
            (maximum, candidate) => Math.max(maximum, candidate.score),
            0,
        );
        const relevant = available.filter((candidate) => candidate.score >= topScore * 0.55);
        const pool = relevant.length > 0 ? relevant : available;

        pool.sort((a, b) => {
            const estimateA = Number.isFinite(a.estimatedPurchase)
                ? a.estimatedPurchase
                : Number.POSITIVE_INFINITY;
            const estimateB = Number.isFinite(b.estimatedPurchase)
                ? b.estimatedPurchase
                : Number.POSITIVE_INFINITY;
            if (estimateA !== estimateB) return estimateA - estimateB;
            if (b.score !== a.score) return b.score - a.score;
            return a.bestUnitPrice - b.bestUnitPrice;
        });

        const chosen = pool[0];
        if (!chosen) {
            unresolved.push({ ingredientId: ingredient.id, label: ingredient.label });
            resolved.push({ ...ingredient, productId: null, productName: null });
            continue;
        }

        const productId = chosen.product.id;
        const productName = chosen.product.name;

        if (
            ingredient.productId !== productId ||
            ingredient.productName !== productName ||
            ingredient.mappingSource !== "auto"
        ) {
            saveIngredientMapping(
                ingredient.label,
                productId,
                productName,
                chosen.product.unitShort ?? null,
                "auto",
            );
            updateRecipeIngredientMapping(
                ingredient.id,
                productId,
                productName,
                chosen.product.unitShort ?? null,
                "auto",
            );
            autoMapped.push({
                ingredientId: ingredient.id,
                label: ingredient.label,
                productId,
                productName,
            });
        }

        resolved.push({ ...ingredient, productId, productName });
    }

    const engineIngredients: EngineIngredient[] = resolved.map((ingredient) => {
        const productOffers = ingredient.productId
            ? offersByProduct.get(ingredient.productId) ?? []
            : [];
        const productName = ingredient.productName ?? productOffers[0]?.productName ?? null;

        return {
            id: ingredient.id,
            label: ingredient.label,
            quantity: ingredient.quantity,
            unit: ingredient.unit,
            optional: ingredient.optional,
            productId: ingredient.productId,
            productName,
            offers: productOffers,
        };
    });

    const result = calculateRecipeCost({
        ingredients: engineIngredients,
        stores: stores.map((store) => ({ id: store.id, label: store.label })),
        servings,
        baseServings: recipe.baseServings,
    });

    return {
        ...result,
        recipe: {
            id: recipe.id,
            name: recipe.name,
            description: recipe.description,
            baseServings: recipe.baseServings,
            ingredientCount: recipe.ingredients.length,
        },
        selectedStores: stores.map((store) => ({ id: store.id, label: store.label })),
        autoMapped,
        unresolved,
    };
}
