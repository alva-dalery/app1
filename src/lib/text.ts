const STOP_WORDS = new Set([
    "a",
    "au",
    "aux",
    "avec",
    "d",
    "de",
    "des",
    "du",
    "en",
    "et",
    "l",
    "la",
    "le",
    "les",
    "ou",
    "pour",
    "sans",
    "sur",
]);

export function normalizeText(value: string): string {
    return value
        .replace(/œ/gi, "oe")
        .replace(/æ/gi, "ae")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

export function singularize(token: string): string {
    if (token.length > 3 && token.endsWith("s")) return token.slice(0, -1);
    return token;
}

export function tokenize(value: string): string[] {
    return normalizeText(value)
        .split(/\s+/)
        .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
        .map(singularize);
}

export function ingredientKey(label: string): string {
    return tokenize(label).join(" ");
}

export function unique<T>(items: T[]): T[] {
    return Array.from(new Set(items));
}

export function titleCase(value: string): string {
    return value
        .split(/\s+/)
        .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word))
        .join(" ");
}
