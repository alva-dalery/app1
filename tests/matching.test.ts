import assert from "node:assert/strict";
import test from "node:test";
import { pickBestProduct, rankProducts } from "../src/lib/ingredient-matching";
import type { Product } from "../src/lib/prixnc/types";

const products: Product[] = [
    {
        id: "dog-food",
        name: "croquette pour chien adulte riz sac 3 kg",
        category: "animalerie",
        subCategory: "animalerie : alimentation",
        bestPrice: 1_000,
    },
    {
        id: "rice-1",
        name: "riz jasmin Excel Dragon paquet 1 kg",
        category: "épicerie salée",
        subCategory: "pâte, riz, purée, céréale",
        bestPrice: 102,
        rank: 1,
    },
    {
        id: "rice-red",
        name: "riz rouge Ko-Ko sachet 1 kg",
        category: "épicerie salée",
        subCategory: "pâte, riz, purée, céréale",
        bestPrice: 395,
        rank: 2,
    },
];

test("écarte les produits non alimentaires", () => {
    const best = pickBestProduct("riz", products);
    assert.notEqual(best?.id, "dog-food");
    assert.ok(best?.id === "rice-1" || best?.id === "rice-red");
});

test("classe les produits pertinents avant les autres", () => {
    const ranked = rankProducts("riz jasmin", products, 3);
    assert.equal(ranked[0].product.id, "rice-1");
    assert.ok(ranked.every((entry) => entry.score > 0));
});

test("retourne null sans correspondance alimentaire", () => {
    assert.equal(pickBestProduct("brouette", products), null);
});
