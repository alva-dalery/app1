import { normalizeText } from "@/lib/text";

export type Dimension = "mass" | "volume" | "count";
export type BaseUnit = "g" | "ml" | "unité";

export interface UnitInfo {
    dimension: Dimension;
    factor: number;
    baseUnit: BaseUnit;
    label: string;
}

export class UnknownUnitError extends Error {
    constructor(unit: string) {
        super(`Unité inconnue : ${unit}`);
        this.name = "UnknownUnitError";
    }
}

const UNIT_ALIASES = new Map<string, UnitInfo>();

function addUnit(names: string[], info: UnitInfo): void {
    for (const name of names) UNIT_ALIASES.set(normalizeText(name), info);
}

const GRAM: UnitInfo = { dimension: "mass", factor: 1, baseUnit: "g", label: "g" };
const KILOGRAM: UnitInfo = { dimension: "mass", factor: 1_000, baseUnit: "g", label: "kg" };
const MILLIGRAM: UnitInfo = { dimension: "mass", factor: 0.001, baseUnit: "g", label: "mg" };
const MILLILITER: UnitInfo = { dimension: "volume", factor: 1, baseUnit: "ml", label: "ml" };
const CENTILITER: UnitInfo = { dimension: "volume", factor: 10, baseUnit: "ml", label: "cl" };
const LITER: UnitInfo = { dimension: "volume", factor: 1_000, baseUnit: "ml", label: "L" };
const COUNT: UnitInfo = { dimension: "count", factor: 1, baseUnit: "unité", label: "unité" };
const TABLESPOON: UnitInfo = { dimension: "volume", factor: 15, baseUnit: "ml", label: "c. à soupe" };
const TEASPOON: UnitInfo = { dimension: "volume", factor: 5, baseUnit: "ml", label: "c. à café" };
const PINCH: UnitInfo = { dimension: "mass", factor: 0.5, baseUnit: "g", label: "pincée" };

addUnit(["g", "gramme", "grammes"], GRAM);
addUnit(["kg", "kilo", "kilos", "kilogramme", "kilogrammes"], KILOGRAM);
addUnit(["mg", "milligramme", "milligrammes"], MILLIGRAM);
addUnit(["ml", "millilitre", "millilitres"], MILLILITER);
addUnit(["cl", "centilitre", "centilitres"], CENTILITER);
addUnit(["l", "litre", "litres"], LITER);
addUnit(["unite", "unites", "piece", "pieces", "u", "x"], COUNT);
addUnit(["cuillere a soupe", "cuilleres a soupe", "c a soupe", "cs"], TABLESPOON);
addUnit(["cuillere a cafe", "cuilleres a cafe", "c a cafe", "cc"], TEASPOON);
addUnit(["pincee", "pincees"], PINCH);

export function getUnitInfo(unit: string): UnitInfo | null {
    const normalized = normalizeText(unit);
    const direct = UNIT_ALIASES.get(normalized);
    if (direct) return direct;

    if (normalized.length > 1 && normalized.endsWith("s")) {
        const singular = UNIT_ALIASES.get(normalized.slice(0, -1));
        if (singular) return singular;
    }

    return null;
}

export function unitInfoFromPriceLabel(label: string | undefined): UnitInfo | null {
    if (!label) return null;
    const normalized = normalizeText(label);

    if (normalized.includes("100") && normalized.includes("g")) {
        return { dimension: "mass", factor: 100, baseUnit: "g", label: "100 g" };
    }

    if (normalized.includes("kilogramme") || normalized === "kg" || normalized === "kilo") {
        return KILOGRAM;
    }
    if (normalized.includes("gramme") || normalized === "g") {
        return GRAM;
    }
    if (normalized.includes("litre") || normalized === "l") {
        return LITER;
    }
    if (normalized.includes("centilitre") || normalized === "cl") {
        return CENTILITER;
    }
    if (normalized.includes("millilitre") || normalized === "ml") {
        return MILLILITER;
    }
    if (normalized.includes("piece") || normalized.includes("unite")) {
        return COUNT;
    }

    return getUnitInfo(label);
}

export interface BaseQuantity {
    value: number;
    dimension: Dimension;
    baseUnit: BaseUnit;
}

export function toBase(quantity: number, unit: string): BaseQuantity {
    const info = getUnitInfo(unit);
    if (!info) throw new UnknownUnitError(unit);
    if (!Number.isFinite(quantity)) throw new Error("Quantité invalide");
    return {
        value: quantity * info.factor,
        dimension: info.dimension,
        baseUnit: info.baseUnit,
    };
}

export function convertFromBase(value: number, unit: string): number {
    const info = getUnitInfo(unit);
    if (!info) throw new UnknownUnitError(unit);
    return value / info.factor;
}

const PACKAGING_WORDS = [
    "paquet",
    "sachet",
    "boite",
    "brique",
    "bouteille",
    "pot",
    "barquette",
    "conserve",
    "sac",
    "bidon",
    "pack",
    "etui",
    "coffret",
    "bocal",
    "doypack",
    "canette",
    "tetra",
    "tablette",
    "rouleau",
    "mousse",
    "lot de",
    "coque",
    "barre",
];

export function isPackagedProduct(name: string): boolean {
    const normalized = normalizeText(name);
    if (PACKAGING_WORDS.some((word) => normalized.includes(word))) return true;
    return /\b\d+\s*(oeuf|unite|piece|tranche)\b/.test(normalized);
}

export interface PackInfo {
    packaged: boolean;
    dimension: Dimension | null;
    unitFactor: number | null;
    packSizeBase: number | null;
    source: "api" | "name" | "none";
}

function parsePackSizeFromName(name: string): { value: number; info: UnitInfo } | null {
    const normalized = normalizeText(name);
    const match = normalized.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|mg|l|ml|cl)\b/);
    if (match) {
        const info = getUnitInfo(match[2]);
        if (info) {
            const quantity = Number(match[1].replace(",", "."));
            if (Number.isFinite(quantity) && quantity > 0) {
                return { value: quantity * info.factor, info };
            }
        }
    }

    const countMatch = normalized.match(/(\d+)\s*(oeuf|unite|piece|tranche)\b/);
    if (countMatch) {
        return { value: Number(countMatch[1]), info: COUNT };
    }

    const xMatch = normalized.match(/\bx\s*(\d+)\b/);
    if (xMatch) {
        return { value: Number(xMatch[1]), info: COUNT };
    }

    return null;
}

export function inferPackInfo(
    productName: string,
    price: number,
    unitPrice?: number,
    unitLabel?: string,
    unitShort?: string,
): PackInfo {
    const packaged = isPackagedProduct(productName);
    const unitInfo =
        unitInfoFromPriceLabel(unitShort) ??
        unitInfoFromPriceLabel(unitLabel) ??
        parsePackSizeFromName(productName)?.info ??
        null;

    if (unitInfo && price > 0 && unitPrice && unitPrice > 0) {
        const packSizeBase = (price / unitPrice) * unitInfo.factor;
        if (Number.isFinite(packSizeBase) && packSizeBase > 0.001) {
            return {
                packaged,
                dimension: unitInfo.dimension,
                unitFactor: unitInfo.factor,
                packSizeBase,
                source: "api",
            };
        }
    }

    const fromName = parsePackSizeFromName(productName);
    if (fromName) {
        return {
            packaged,
            dimension: fromName.info.dimension,
            unitFactor: fromName.info.factor,
            packSizeBase: fromName.value,
            source: "name",
        };
    }

    return {
        packaged,
        dimension: unitInfo?.dimension ?? null,
        unitFactor: unitInfo?.factor ?? null,
        packSizeBase: null,
        source: "none",
    };
}

export function formatBaseQuantity(value: number, dimension: Dimension): string {
    if (dimension === "mass") {
        return value >= 1_000 ? `${(value / 1_000).toFixed(1)} kg` : `${Math.round(value)} g`;
    }
    if (dimension === "volume") {
        return value >= 1_000 ? `${(value / 1_000).toFixed(1)} L` : `${Math.round(value)} ml`;
    }
    return `${Math.round(value)} unité${value > 1 ? "s" : ""}`;
}
