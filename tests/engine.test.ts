import assert from "node:assert/strict";
import test from "node:test";
import {
    calculateRecipeCost,
    EngineIngredient,
    EngineStore,
} from "../src/lib/pricing/engine";

const stores: EngineStore[] = [
    { id: "a", label: "Magasin A" },
    { id: "b", label: "Magasin B" },
];

function ingredient(
    overrides: Partial<EngineIngredient> & Pick<EngineIngredient, "id" | "label" | "quantity" | "unit">,
): EngineIngredient {
    return {
        optional: false,
        productId: "p1",
        productName: "produit",
        offers: [],
        ...overrides,
    };
}

test("calcule le panier par magasin et la répartition optimisée", () => {
    const rice = ingredient({
        id: "rice",
        label: "Riz",
        quantity: 400,
        unit: "g",
        productId: "rice-id",
        productName: "riz paquet 1 kg",
        offers: [
            { storeId: "a", price: 100, unitPrice: 100, unitShort: "kg" },
            { storeId: "b", price: 120, unitPrice: 120, unitShort: "kg" },
        ],
    });

    const oil = ingredient({
        id: "oil",
        label: "Huile",
        quantity: 20,
        unit: "ml",
        productId: "oil-id",
        productName: "huile bouteille 1 l",
        offers: [
            { storeId: "a", price: 300, unitPrice: 300, unitShort: "L" },
            { storeId: "b", price: 250, unitPrice: 250, unitShort: "L" },
        ],
    });

    const result = calculateRecipeCost({
        ingredients: [rice, oil],
        stores,
        servings: 4,
        baseServings: 4,
    });

    assert.equal(result.stores.length, 2);
    assert.equal(result.stores[0].totalPurchase, 400);
    assert.equal(result.stores[1].totalPurchase, 370);
    assert.equal(result.bestSingleStoreId, "b");
    assert.equal(result.bestPartialStoreId, null);
    assert.equal(result.optimizedSplit?.totalPurchase, 350);
    assert.equal(result.optimizedSplit?.savingsVsBestSingle, 20);
    assert.equal(result.optimizedSplit?.complete, true);
    assert.equal(result.coverage.mapped, 2);
    assert.equal(result.coverage.total, 2);
});

test("ne présente pas un magasin incomplet comme meilleur panier", () => {
    const rice = ingredient({
        id: "rice",
        label: "Riz",
        quantity: 400,
        unit: "g",
        productId: "rice-id",
        productName: "riz paquet 1 kg",
        offers: [{ storeId: "a", price: 100, unitPrice: 100, unitShort: "kg" }],
    });

    const oil = ingredient({
        id: "oil",
        label: "Huile",
        quantity: 20,
        unit: "ml",
        productId: "oil-id",
        productName: "huile bouteille 1 l",
        offers: [{ storeId: "b", price: 250, unitPrice: 250, unitShort: "L" }],
    });

    const result = calculateRecipeCost({
        ingredients: [rice, oil],
        stores,
        servings: 4,
        baseServings: 4,
    });

    assert.equal(result.bestSingleStoreId, null);
    assert.equal(result.bestPartialStoreId, "a");
    assert.equal(result.stores.find((store) => store.storeId === "a")?.missingRequired, 1);
    assert.equal(result.stores.find((store) => store.storeId === "b")?.missingRequired, 1);
    assert.equal(result.optimizedSplit?.totalPurchase, 350);
    assert.equal(result.optimizedSplit?.complete, true);
    assert.equal(result.optimizedSplit?.savingsVsBestSingle, 0);
});

test("ignore un ingrédient optionnel manquant dans la complétude", () => {
    const rice = ingredient({
        id: "rice",
        label: "Riz",
        quantity: 400,
        unit: "g",
        productId: "rice-id",
        productName: "riz paquet 1 kg",
        offers: [{ storeId: "a", price: 100, unitPrice: 100, unitShort: "kg" }],
    });

    const optionalOil = ingredient({
        id: "oil",
        label: "Huile",
        quantity: 20,
        unit: "ml",
        optional: true,
        productId: "oil-id",
        productName: "huile bouteille 1 l",
        offers: [],
    });

    const result = calculateRecipeCost({
        ingredients: [rice, optionalOil],
        stores,
        servings: 4,
        baseServings: 4,
    });

    const storeA = result.stores.find((store) => store.storeId === "a");
    assert.equal(storeA?.missingRequired, 0);
    assert.equal(storeA?.missingOptional, 1);
    assert.equal(storeA?.complete, true);
    assert.equal(result.bestSingleStoreId, "a");
});

test("calcule un produit vendu au poids sans arrondir au pack", () => {
    const tomatoes = ingredient({
        id: "tomato",
        label: "Tomate",
        quantity: 300,
        unit: "g",
        productId: "tomato-id",
        productName: "tomate ronde",
        offers: [{ storeId: "a", price: 400, unitPrice: 400, unitShort: "kg" }],
    });

    const result = calculateRecipeCost({
        ingredients: [tomatoes],
        stores: [stores[0]],
        servings: 2,
        baseServings: 2,
    });

    const offer = result.ingredients[0].offers.a;
    assert.equal(offer.available, true);
    assert.equal(offer.purchaseCost, 120);
    assert.equal(offer.consumedCost, 120);
    assert.equal(offer.packaged, false);
});

test("arrondit un conditionnement de plusieurs unités", () => {
    const eggs = ingredient({
        id: "eggs",
        label: "Œufs",
        quantity: 2,
        unit: "unité",
        productId: "eggs-id",
        productName: "œufs frais",
        offers: [{ storeId: "a", price: 300, unitPrice: 50, unitShort: "unité" }],
    });

    const result = calculateRecipeCost({
        ingredients: [eggs],
        stores: [stores[0]],
        servings: 2,
        baseServings: 2,
    });

    const offer = result.ingredients[0].offers.a;
    assert.equal(offer.available, true);
    assert.equal(offer.purchaseCost, 300);
    assert.equal(offer.consumedCost, 100);
    assert.equal(offer.packaged, true);
});

test("signale une conversion approximative entre unité et poids", () => {
    const tomatoes = ingredient({
        id: "tomatoes",
        label: "Tomates",
        quantity: 2,
        unit: "unité",
        productId: "tomato-id",
        productName: "tomate ronde",
        offers: [{ storeId: "a", price: 400, unitPrice: 400, unitShort: "kg" }],
    });

    const result = calculateRecipeCost({
        ingredients: [tomatoes],
        stores: [stores[0]],
        servings: 2,
        baseServings: 2,
    });

    const offer = result.ingredients[0].offers.a;
    assert.equal(offer.available, true);
    assert.equal(offer.purchaseCost, 800);
    assert.match(offer.warning ?? "", /approximative/i);
});

test("adapte les quantités au nombre de portions", () => {
    const rice = ingredient({
        id: "rice",
        label: "Riz",
        quantity: 400,
        unit: "g",
        productId: "rice-id",
        productName: "riz paquet 1 kg",
        offers: [{ storeId: "a", price: 100, unitPrice: 100, unitShort: "kg" }],
    });

    const result = calculateRecipeCost({
        ingredients: [rice],
        stores: [stores[0]],
        servings: 8,
        baseServings: 4,
    });

    assert.equal(result.ingredients[0].quantity, 800);
    assert.equal(result.ingredients[0].offers.a.purchaseCost, 100);
    assert.equal(result.ingredients[0].offers.a.consumedCost, 80);
});
