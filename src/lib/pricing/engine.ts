import {
    Dimension,
    inferPackInfo,
    toBase,
    UnknownUnitError,
} from "./units";
import { roundXpf } from "./currency";

export interface EnginePriceOffer {
    storeId: string;
    price: number;
    unitPrice?: number;
    unitLabel?: string;
    unitShort?: string;
    promotion?: boolean;
    observedAt?: string;
}

export interface EngineIngredient {
    id: string;
    label: string;
    quantity: number;
    unit: string;
    optional: boolean;
    productId?: string | null;
    productName?: string | null;
    offers: EnginePriceOffer[];
}

export interface EngineStore {
    id: string;
    label: string;
}

export interface StoreOfferCost {
    storeId: string;
    storeLabel: string;
    available: boolean;
    price?: number;
    unitPrice?: number;
    unitLabel?: string;
    unitShort?: string;
    packSizeBase?: number | null;
    packs?: number;
    purchaseCost?: number;
    consumedCost?: number;
    promotion?: boolean;
    observedAt?: string;
    packaged?: boolean;
    warning?: string;
}

export interface IngredientCost {
    id: string;
    label: string;
    quantity: number;
    unit: string;
    optional: boolean;
    productId?: string | null;
    productName?: string | null;
    neededBase?: number;
    dimension?: Dimension;
    offers: Record<string, StoreOfferCost>;
    bestStoreId?: string;
    bestPurchaseCost?: number;
    warning?: string;
}

export interface StoreSummary {
    storeId: string;
    storeLabel: string;
    totalPurchase: number;
    totalConsumed: number;
    missingRequired: number;
    missingOptional: number;
    complete: boolean;
    lines: StoreOfferCost[];
}

export interface SplitAssignment {
    ingredientId: string;
    label: string;
    storeId: string;
    storeLabel: string;
    purchaseCost: number;
    consumedCost: number;
}

export interface SplitSummary {
    totalPurchase: number;
    totalConsumed: number;
    savingsVsBestSingle: number;
    missingRequired: number;
    complete: boolean;
    assignments: SplitAssignment[];
}

export interface CostResult {
    ingredients: IngredientCost[];
    stores: StoreSummary[];
    bestSingleStoreId: string | null;
    bestPartialStoreId: string | null;
    optimizedSplit: SplitSummary | null;
    warnings: string[];
    coverage: {
        mapped: number;
        total: number;
    };
    servings: number;
}

export interface CostCalculationInput {
    ingredients: EngineIngredient[];
    stores: EngineStore[];
    servings: number;
    baseServings: number;
}

function offerTimestamp(offer: EnginePriceOffer): number {
    if (!offer.observedAt) return 0;
    const value = new Date(offer.observedAt).getTime();
    return Number.isFinite(value) ? value : 0;
}

function unavailable(store: EngineStore, warning: string): StoreOfferCost {
    return {
        storeId: store.id,
        storeLabel: store.label,
        available: false,
        warning,
    };
}

function evaluateOffer(
    ingredient: EngineIngredient,
    offer: EnginePriceOffer,
    store: EngineStore,
    scaledQuantity: number,
): StoreOfferCost {
    if (!ingredient.productId) {
        return unavailable(store, "Aucun produit associé à cet ingrédient.");
    }

    if (!Number.isFinite(scaledQuantity) || scaledQuantity <= 0) {
        return unavailable(store, "Quantité invalide.");
    }

    let needed;
    try {
        needed = toBase(scaledQuantity, ingredient.unit);
    } catch (error) {
        const message =
            error instanceof UnknownUnitError
                ? `Unité de recette inconnue : ${ingredient.unit}.`
                : "Quantité de recette invalide.";
        return unavailable(store, message);
    }

    const pack = inferPackInfo(
        ingredient.productName ?? "",
        offer.price,
        offer.unitPrice,
        offer.unitLabel,
        offer.unitShort,
    );

    if (!Number.isFinite(offer.price) || offer.price <= 0) {
        return unavailable(store, "Prix indisponible.");
    }

    if (pack.dimension === null) {
        return {
            storeId: store.id,
            storeLabel: store.label,
            available: true,
            price: offer.price,
            unitPrice: offer.unitPrice,
            unitLabel: offer.unitLabel,
            unitShort: offer.unitShort,
            purchaseCost: roundXpf(offer.price),
            consumedCost: roundXpf(offer.price),
            promotion: offer.promotion,
            observedAt: offer.observedAt,
            packaged: pack.packaged,
            warning:
                "Unité de vente inconnue : coût estimé sur un pack. Vérifiez la correspondance produit.",
        };
    }

    if (needed.dimension !== pack.dimension) {
        if (needed.dimension === "count" && pack.dimension !== "count") {
            const packs = Math.max(1, Math.ceil(needed.value));
            const purchaseCost = roundXpf(packs * offer.price);
            return {
                storeId: store.id,
                storeLabel: store.label,
                available: true,
                price: offer.price,
                unitPrice: offer.unitPrice,
                unitLabel: offer.unitLabel,
                unitShort: offer.unitShort,
                packSizeBase: pack.packSizeBase,
                packs,
                purchaseCost,
                consumedCost: purchaseCost,
                promotion: offer.promotion,
                observedAt: offer.observedAt,
                packaged: pack.packaged,
                warning:
                    "Conversion approximative : la recette est exprimée en unités et le produit est vendu au poids ou au volume.",
            };
        }

        return unavailable(
            store,
            `Unités incompatibles : recette en ${needed.baseUnit}, produit vendu en ${pack.dimension}.`,
        );
    }

    const countPack =
        pack.dimension === "count" && pack.packSizeBase !== null && pack.packSizeBase > 1;

    if (pack.packaged || countPack) {
        const packSize = pack.packSizeBase && pack.packSizeBase > 0 ? pack.packSizeBase : needed.value;
        const packs = Math.max(1, Math.ceil(needed.value / packSize));
        const purchaseCost = roundXpf(packs * offer.price);
        const consumedCost = roundXpf((needed.value / packSize) * offer.price);
        const warning =
            pack.source === "none"
                ? "Taille du conditionnement inconnue : coût estimé sur un pack."
                : undefined;

        return {
            storeId: store.id,
            storeLabel: store.label,
            available: true,
            price: offer.price,
            unitPrice: offer.unitPrice,
            unitLabel: offer.unitLabel,
            unitShort: offer.unitShort,
            packSizeBase: pack.packSizeBase,
            packs,
            purchaseCost,
            consumedCost,
            promotion: offer.promotion,
            observedAt: offer.observedAt,
            packaged: true,
            warning,
        };
    }

    let consumedCost: number;
    let packSizeBase = pack.packSizeBase;
    let warning: string | undefined;

    if (packSizeBase && packSizeBase > 0) {
        consumedCost = roundXpf((needed.value / packSizeBase) * offer.price);
    } else if (offer.unitPrice && pack.unitFactor && pack.unitFactor > 0) {
        consumedCost = roundXpf((needed.value / pack.unitFactor) * offer.unitPrice);
    } else {
        consumedCost = roundXpf(offer.price);
        packSizeBase = needed.value;
        warning =
            "Produit vendu au poids sans prix unitaire : coût estimé sur un pack.";
    }

    return {
        storeId: store.id,
        storeLabel: store.label,
        available: true,
        price: offer.price,
        unitPrice: offer.unitPrice,
        unitLabel: offer.unitLabel,
        unitShort: offer.unitShort,
        packSizeBase,
        packs: packSizeBase && packSizeBase > 0 ? needed.value / packSizeBase : undefined,
        purchaseCost: consumedCost,
        consumedCost,
        promotion: offer.promotion,
        observedAt: offer.observedAt,
        packaged: false,
        warning,
    };
}

function bestOfferForStore(
    ingredient: EngineIngredient,
    store: EngineStore,
    scaledQuantity: number,
): StoreOfferCost {
    const candidates = ingredient.offers
        .filter((offer) => offer.storeId === store.id)
        .sort((a, b) => offerTimestamp(b) - offerTimestamp(a));

    if (candidates.length === 0) {
        return unavailable(store, "Produit non référencé dans ce magasin.");
    }

    const evaluated = candidates
        .map((offer) => evaluateOffer(ingredient, offer, store, scaledQuantity))
        .filter((offer) => offer.available);

    if (evaluated.length === 0) {
        return evaluateOffer(ingredient, candidates[0], store, scaledQuantity);
    }

    evaluated.sort((a, b) => {
        const purchaseDiff = (a.purchaseCost ?? Number.MAX_SAFE_INTEGER) - (b.purchaseCost ?? Number.MAX_SAFE_INTEGER);
        if (purchaseDiff !== 0) return purchaseDiff;
        return (a.consumedCost ?? Number.MAX_SAFE_INTEGER) - (b.consumedCost ?? Number.MAX_SAFE_INTEGER);
    });

    return evaluated[0];
}

export function calculateRecipeCost(input: CostCalculationInput): CostResult {
    const { ingredients, stores } = input;
    const servings = Number.isFinite(input.servings) && input.servings > 0 ? input.servings : input.baseServings;
    const baseServings = input.baseServings > 0 ? input.baseServings : 1;
    const scale = servings / baseServings;

    const warnings = new Set<string>();

    const ingredientCosts: IngredientCost[] = ingredients.map((ingredient) => {
        const scaledQuantity = ingredient.quantity * scale;
        const offers: Record<string, StoreOfferCost> = {};

        for (const store of stores) {
            offers[store.id] = bestOfferForStore(ingredient, store, scaledQuantity);
        }

        let neededBase: number | undefined;
        let dimension: Dimension | undefined;
        try {
            const needed = toBase(scaledQuantity, ingredient.unit);
            neededBase = needed.value;
            dimension = needed.dimension;
        } catch {
            // Le warning est déjà porté par chaque offre indisponible.
        }

        const availableOffers = Object.values(offers).filter((offer) => offer.available);
        availableOffers.sort((a, b) => {
            const purchaseDiff = (a.purchaseCost ?? Number.MAX_SAFE_INTEGER) - (b.purchaseCost ?? Number.MAX_SAFE_INTEGER);
            if (purchaseDiff !== 0) return purchaseDiff;
            return (a.consumedCost ?? Number.MAX_SAFE_INTEGER) - (b.consumedCost ?? Number.MAX_SAFE_INTEGER);
        });

        const best = availableOffers[0];
        const offerWarnings = Object.values(offers)
            .map((offer) => offer.warning)
            .filter((warning): warning is string => Boolean(warning));

        for (const warning of offerWarnings) {
            warnings.add(`${ingredient.label} : ${warning}`);
        }

        return {
            id: ingredient.id,
            label: ingredient.label,
            quantity: scaledQuantity,
            unit: ingredient.unit,
            optional: ingredient.optional,
            productId: ingredient.productId,
            productName: ingredient.productName,
            neededBase,
            dimension,
            offers,
            bestStoreId: best?.storeId,
            bestPurchaseCost: best?.purchaseCost,
            warning: offerWarnings[0],
        };
    });

    const storeSummaries: StoreSummary[] = stores.map((store) => {
        const lines = ingredientCosts.map((ingredient) => ingredient.offers[store.id]);
        const availableLines = lines.filter((line) => line?.available);

        const totalPurchase = availableLines.reduce((sum, line) => sum + (line.purchaseCost ?? 0), 0);
        const totalConsumed = availableLines.reduce((sum, line) => sum + (line.consumedCost ?? 0), 0);

        const missingRequired = ingredientCosts.filter(
            (ingredient) => !ingredient.optional && !ingredient.offers[store.id]?.available,
        ).length;
        const missingOptional = ingredientCosts.filter(
            (ingredient) => ingredient.optional && !ingredient.offers[store.id]?.available,
        ).length;

        return {
            storeId: store.id,
            storeLabel: store.label,
            totalPurchase: roundXpf(totalPurchase),
            totalConsumed: roundXpf(totalConsumed),
            missingRequired,
            missingOptional,
            complete: missingRequired === 0,
            lines,
        };
    });

    const sortedStores = [...storeSummaries].sort((a, b) => a.totalPurchase - b.totalPurchase);
    const completeStores = sortedStores.filter((store) => store.complete);
    // Un magasin incomplet ne peut pas être présenté comme le meilleur panier.
    const bestSingleStoreId = completeStores[0]?.storeId ?? null;
    const bestPartialStoreId = completeStores.length === 0 ? sortedStores[0]?.storeId ?? null : null;

    const assignments: SplitAssignment[] = [];
    let splitPurchase = 0;
    let splitConsumed = 0;
    let splitMissingRequired = 0;

    for (const ingredient of ingredientCosts) {
        const available = Object.values(ingredient.offers)
            .filter((offer) => offer.available)
            .sort((a, b) => {
                const purchaseDiff =
                    (a.purchaseCost ?? Number.MAX_SAFE_INTEGER) - (b.purchaseCost ?? Number.MAX_SAFE_INTEGER);
                if (purchaseDiff !== 0) return purchaseDiff;
                return (a.consumedCost ?? Number.MAX_SAFE_INTEGER) - (b.consumedCost ?? Number.MAX_SAFE_INTEGER);
            });

        const best = available[0];
        if (!best) {
            if (!ingredient.optional) splitMissingRequired += 1;
            continue;
        }

        assignments.push({
            ingredientId: ingredient.id,
            label: ingredient.label,
            storeId: best.storeId,
            storeLabel: best.storeLabel,
            purchaseCost: best.purchaseCost ?? 0,
            consumedCost: best.consumedCost ?? 0,
        });
        splitPurchase += best.purchaseCost ?? 0;
        splitConsumed += best.consumedCost ?? 0;
    }

    const bestSingle = storeSummaries.find((store) => store.storeId === bestSingleStoreId);
    const split: SplitSummary | null =
        stores.length > 0
            ? {
                totalPurchase: roundXpf(splitPurchase),
                totalConsumed: roundXpf(splitConsumed),
                savingsVsBestSingle: bestSingle
                    ? Math.max(0, bestSingle.totalPurchase - roundXpf(splitPurchase))
                    : 0,
                missingRequired: splitMissingRequired,
                complete: splitMissingRequired === 0,
                assignments,
            }
            : null;

    return {
        ingredients: ingredientCosts,
        stores: storeSummaries,
        bestSingleStoreId,
        bestPartialStoreId,
        optimizedSplit: split,
        warnings: Array.from(warnings),
        coverage: {
            mapped: ingredientCosts.filter((ingredient) => Boolean(ingredient.productId)).length,
            total: ingredientCosts.length,
        },
        servings,
    };
}
