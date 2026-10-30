"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Store } from "@/lib/prixnc/types";
import { normalizeText } from "@/lib/text";
import { useStores } from "./StoreProvider";

const GROUP_ORDER = [
    "Grande surface",
    "Moyenne surface",
    "Grande surface spécialisée",
    "Petite surface",
    "Autre",
];

function groupFor(store: Store): string {
    return store.type && GROUP_ORDER.includes(store.type) ? store.type : "Autre";
}

export function StoreDirectory({ stores }: { stores: Store[] }) {
    const { selectedStores, toggleStore, clearStores, hydrated } = useStores();
    const [query, setQuery] = useState("");

    const selectedIds = useMemo(
        () => new Set(selectedStores.map((store) => store.id)),
        [selectedStores],
    );

    const filtered = useMemo(() => {
        const q = normalizeText(query);
        return stores.filter((store) => {
            if (!q) return true;
            return normalizeText(`${store.label} ${store.type ?? ""} ${store.commune}`).includes(q);
        });
    }, [stores, query]);

    const grouped = useMemo(() => {
        const map = new Map<string, Store[]>();
        for (const store of filtered) {
            const group = groupFor(store);
            const existing = map.get(group);
            if (existing) existing.push(store);
            else map.set(group, [store]);
        }
        return GROUP_ORDER.map((group) => ({ group, stores: map.get(group) ?? [] })).filter(
            (entry) => entry.stores.length > 0,
        );
    }, [filtered]);

    return (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="space-y-5">
                <div className="card p-4 sm:p-5">
                    <label className="label" htmlFor="store-search">
                        Rechercher un magasin
                    </label>
                    <input
                        id="store-search"
                        type="search"
                        className="input"
                        placeholder="Carrefour, Géant, discount, petite surface…"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                    />
                    <p className="mt-2 text-xs text-ink/50">
                        {filtered.length} magasin{filtered.length > 1 ? "s" : ""} disponible
                        {filtered.length > 1 ? "s" : ""} à Nouméa.
                    </p>
                </div>

                {grouped.map(({ group, stores: groupStores }) => (
                    <section key={group} className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                            <h2 className="text-sm font-extrabold uppercase tracking-[0.12em] text-ink/55">
                                {group}
                            </h2>
                            <span className="text-xs text-ink/40">{groupStores.length}</span>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                            {groupStores.map((store) => {
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
                                                {store.commune}
                                                {store.type ? ` · ${store.type}` : ""}
                                            </span>
                                        </span>
                                        <span
                                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[0.65rem] font-black ${selected
                                                ? "border-lagoon bg-lagoon text-white"
                                                : "border-ink/15 bg-white text-ink/25"
                                                }`}
                                        >
                                            {selected ? "✓" : "+"}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                ))}

                {grouped.length === 0 ? (
                    <div className="card p-6 text-sm text-ink/60">
                        Aucun magasin ne correspond à votre recherche.
                    </div>
                ) : null}
            </div>

            <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
                <div className="card-strong p-5">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="eyebrow">Filtre de comparaison</p>
                            <p className="mt-1 text-lg font-extrabold">
                                {!hydrated || selectedStores.length === 0
                                    ? "Tous les magasins"
                                    : `${selectedStores.length} magasin${selectedStores.length > 1 ? "s" : ""}`}
                            </p>
                        </div>
                        {hydrated && selectedStores.length > 0 ? (
                            <button type="button" className="btn-ghost text-xs" onClick={clearStores}>
                                Tout retirer
                            </button>
                        ) : null}
                    </div>

                    <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
                        {hydrated && selectedStores.length > 0 ? (
                            selectedStores.map((store) => (
                                <div
                                    key={store.id}
                                    className="flex items-center justify-between gap-2 rounded-2xl bg-white/80 px-3 py-2.5"
                                >
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-bold">{store.label}</p>
                                        <p className="truncate text-[0.7rem] text-ink/50">{store.type ?? "Magasin"}</p>
                                    </div>
                                    <button
                                        type="button"
                                        className="text-xs font-bold text-coral hover:underline"
                                        onClick={() => toggleStore(store)}
                                    >
                                        Retirer
                                    </button>
                                </div>
                            ))
                        ) : (
                            <p className="rounded-2xl bg-white/60 px-3 py-4 text-sm text-ink/55">
                                Aucun filtre : tous les magasins de Nouméa sont comparés. Cliquez sur un magasin pour
                                restreindre la comparaison à votre sélection.
                            </p>
                        )}
                    </div>

                    <div className="mt-5 grid gap-2">
                        <Link href="/recipes" className="btn-primary w-full">
                            Choisir une recette
                        </Link>
                        <Link href="/products" className="btn-secondary w-full">
                            Comparer un produit
                        </Link>
                    </div>
                </div>

                <div className="card p-4 text-xs leading-relaxed text-ink/55">
                    Les magasins et leurs prix proviennent de la base publique prix.nc. Certains commerces
                    spécialisés ne proposent pas tous les produits : les ingrédients manquants sont signalés
                    dans le calcul.
                </div>
            </aside>
        </div>
    );
}
