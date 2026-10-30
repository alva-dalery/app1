import assert from "node:assert/strict";
import test from "node:test";
import {
    inferPackInfo,
    isPackagedProduct,
    toBase,
    unitInfoFromPriceLabel,
} from "../src/lib/pricing/units";

test("convertit les unités de masse et de volume vers l'unité de base", () => {
    assert.deepEqual(toBase(1, "kg"), { value: 1_000, dimension: "mass", baseUnit: "g" });
    assert.deepEqual(toBase(250, "g"), { value: 250, dimension: "mass", baseUnit: "g" });
    assert.deepEqual(toBase(2, "L"), { value: 2_000, dimension: "volume", baseUnit: "ml" });
    assert.deepEqual(toBase(20, "cl"), { value: 200, dimension: "volume", baseUnit: "ml" });
    assert.deepEqual(toBase(3, "unité"), { value: 3, dimension: "count", baseUnit: "unité" });
});

test("rejette une unité inconnue", () => {
    assert.throws(() => toBase(1, "brouette"), /Unité inconnue/);
});

test("interprète les libellés de prix unitaire", () => {
    assert.equal(unitInfoFromPriceLabel("Kilogramme")?.factor, 1_000);
    assert.equal(unitInfoFromPriceLabel("100 g")?.factor, 100);
    assert.equal(unitInfoFromPriceLabel("Litre")?.factor, 1_000);
    assert.equal(unitInfoFromPriceLabel("kg")?.factor, 1_000);
});

test("détecte les produits conditionnés", () => {
    assert.equal(isPackagedProduct("riz jasmin Excel Dragon paquet 1 kg"), true);
    assert.equal(isPackagedProduct("lait de coco conserve 400 ml"), true);
    assert.equal(isPackagedProduct("tomate ronde"), false);
    assert.equal(isPackagedProduct("poulet entier pays au kilo"), false);
});

test("déduit la taille du pack depuis le prix et le prix unitaire", () => {
    const rice = inferPackInfo("riz jasmin paquet 1 kg", 102, 102, "Kilogramme", "kg");
    assert.equal(rice.packaged, true);
    assert.equal(rice.dimension, "mass");
    assert.equal(rice.packSizeBase, 1_000);
    assert.equal(rice.source, "api");

    const coconut = inferPackInfo("lait de coco conserve 400 ml", 200, 500, "Litre", "L");
    assert.equal(coconut.packaged, true);
    assert.equal(coconut.packSizeBase, 400);
});

test("déduit la taille du pack depuis le nom si le prix unitaire manque", () => {
    const rice = inferPackInfo("riz jasmin sachet 5 kg", 580, undefined, undefined, undefined);
    assert.equal(rice.packaged, true);
    assert.equal(rice.packSizeBase, 5_000);
    assert.equal(rice.source, "name");
});
