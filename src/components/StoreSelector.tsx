"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Store } from "@/lib/prixnc/types";
import { normalizeText } from "@/lib/text";
import { useStores } from "./StoreProvider";

function SearchIcon() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none">
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
            <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
    );
}

function CheckIcon() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none">
            <path
                d="m5 12.5 4.2 4L19 6.8"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function StoreIcon() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none">
            <path
                d="M4 10v9h16v-9M3 10l2-6h14l2 6c0 1.2-1 2.2-2.2 2.2S16.6 11.2 16.6 10c0 1.2-1 2.2-2.2 2.2S12.2 11.2 12.2 10c0 1.2-1 2.2-2.2 2.2S7.8 11.2 7.8 10c0 1.2-1 2.2-2.2 2.2S3.4 11.2 3.4 10Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
            />
            <path d="M9 19v-5h6v5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
    );
}

export function StoreSelector({
    stores,
    compact = false,
    limit,
}: {
    stores: Store[];
    compact?: boolean;
    limit?: number;
}) {
    const { selectedStores, toggleStore, hydrated } = useStores();
    const [query, setQuery] = useState("");

    const selectedIds = useMemo(
        () => new Set(selectedStores.map((store) => store.id)),
        [selectedStores],
    );

    const filtered = useMemo(() => {
        const q = normalizeText(query);
        const base = q
            ? stores.filter((store) => {
                const haystack = normalizeText(`${store.label} ${store.type ?? ""} ${store.commune}`);
                return haystack.includes(q);
            })
            : stores;

        const sorted = [...base].sort((a, b) => {
            const selectedDiff = Number(selectedIds.has(b.id)) - Number(selectedIds.has(a.id));
            if (selectedDiff !== 0) return selectedDiff;
            return a.label.localeCompare(b.label, "fr");
        });

        return sorted.slice(0, limit ?? (compact ? 8 : 30));
    }, [stores, query, compact, limit, selectedIds]);

    return (
        <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="eyebrow">Vos magasins</p>
                    <p className="mt-1 text-sm text-ink/60">
                        Sélectionnez un ou deux magasins pour comparer.
                    </p>
                </div>
                <span className="badge badge-lagoon shrink-0">{selectedStores.length}/2</span>
            </div>

            {hydrated && selectedStores.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                    {selectedStores.map((store) => (
                        <button
                            key={store.id}
                            type="button"
                            onClick={() => toggleStore(store)}
                            className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-lagoon px-3 py-1.5 text-xs font-bold text-white transition hover:bg-lagoon-dark"
                            title="Retirer ce magasin"
                        >
                            <StoreIcon />
                            <span className="truncate">{store.label}</span>
                            <span aria-hidden="true" className="text-white/70">
                                ×
                            </span>
                        </button>
                    ))}
                </div>
            ) : null}

            <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/40">
                    <SearchIcon />
                </span>
                <input
                    type="search"
                    className="input pl-9"
                    placeholder="Rechercher un magasin…"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    aria-label="Rechercher un magasin"
                />
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
                {filtered.map((store) => {
                    const selected = selectedIds.has(store.id);
                    return (
                        <button
                            key={store.id}
                            type="button"
                            className="store-option"
                            aria-pressed={selected}
                            onClick={() => toggleStore(store)}
                        >
                            <span className="min-w-0">
                                <span className="block truncate text-sm font-bold">{store.label}</span>
                                <span className="mt-0.5 block truncate text-[0.7rem] text-ink/50">
                                    {store.type ?? "Magasin"} · {store.commune}
                                </span>
                            </span>
                            <span
                                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${selected
                                        ? "border-lagoon bg-lagoon text-white"
                                        : "border-ink/15 bg-white text-transparent"
                                    }`}
                            >
                                <CheckIcon />
                            </span>
                        </button>
                    );
                })}
            </div>

            {filtered.length === 0 ? (
                <p className="rounded-2xl bg-ink/5 px-4 py-3 text-sm text-ink/60">
                    Aucun magasin ne correspond à cette recherche.
                </p>
            ) : null}

            {compact ? (
                <Link
                    href="/stores"
                    className="inline-flex items-center gap-1 text-xs font-bold text-lagoon-dark hover:underline"
                >
                    Voir tous les magasins
                    <span aria-hidden="true">→</span>
                </Link>
            ) : null}
        </div>
    );
}
