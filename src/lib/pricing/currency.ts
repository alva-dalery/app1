const integerFormatter = new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
});

export function roundXpf(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.round(value);
}

export function formatXpf(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return "—";
    return `${integerFormatter.format(Math.round(value))} F`;
}

export function formatXpfPerUnit(value: number | null | undefined, unit?: string): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return "—";
    return `${formatXpf(value)}${unit ? `/${unit}` : ""}`;
}

export function formatDateFr(isoDate: string | undefined): string {
    if (!isoDate) return "date inconnue";
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return "date inconnue";
    return new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(date);
}

export function formatNumber(value: number | null | undefined, digits = 1): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return "—";
    return new Intl.NumberFormat("fr-FR", {
        maximumFractionDigits: digits,
    }).format(value);
}
