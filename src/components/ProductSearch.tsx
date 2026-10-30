"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { formatDateFr, formatXpf, formatXpfPerUnit } from "@/lib/pricing/currency";
import type { PriceOffer, Product } from "@/lib/prixnc/types";
import { useStores } from "./StoreProvider";

const SUGGESTIONS = ["riz", "poulet", "tomate", "lait de coco", "huile", "pomme de terre"];

interface ProductSearchPayload {
    products?: Product[];
    error?: string;
}

interface PricesPayload {
    offers?: PriceOffer[];
    bestOffer?: PriceOffer | null;
    error?: string;
}

export function ProductSearch() {
    const { selectedStores, hydrated } = useStores();
    const [query, setQuery] = useState("");
    const [submittedQuery, setSubmittedQuery] = useState("");
    const [products, setProducts] = useState<Product[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);

    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [offers, setOffers] = useState<PriceOffer[]>([]);
    const [offersLoading, setOffersLoading] = useState(false);
    const [offersError, setOffersError] = useState<string | null>(null);


    async function runSearch(value: string) {
        const trimmed = value.trim();
        if (trimmed.length < 2) {
            setSearchError("Saisissez au moins deux caractères.");
            return;
        }

        setSubmittedQuery(trimmed);
        setSearchLoading(true);
        setSearchError(null);
        setProducts([]);
        setSelectedProduct(null);
        setOffers([]);

        try {
            const response = await fetch(`/api/products?q=${encodeURIComponent(trimmed)}&size=24`);
            const payload = (await response.json()) as ProductSearchPayload;
            if (!response.ok) throw new Error(payload.error ?? "La recherche a échoué.");
            setProducts(payload.products ?? []);
        } catch (error) {
            setSearchError(error instanceof Error ? error.message : "La recherche a échoué.");
        } finally {
            setSearchLoading(false);
        }
    }

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        void runSearch(query);
    }

    useEffect(() => {
        if (!selectedProduct) return;
        let cancelled = false;

        setOffersLoading(true);
        setOffersError(null);
        setOffers([]);

        // On charge tous les relevés de Nouméa : un produit peut être vendu
        // uniquement dans un magasin qui n'est pas dans la sélection.
        fetch(`/api/products/${encodeURIComponent(selectedProduct.id)}/prices`)
            .then(async (response) => {
                const payload = (await response.json()) as PricesPayload;
                if (!response.ok) throw new Error(payload.error ?? "Impossible de charger les prix.");
                if (!cancelled) setOffers(payload.offers ?? []);
            })
            .catch((error: unknown) => {
                if (!cancelled) {
                    setOffersError(error instanceof Error ? error.message : "Impossible de charger les prix.");
                }
            })
            .finally(() => {
                if (!cancelled) setOffersLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [selectedProduct]);

    const sortedOffers = useMemo(
        () =>
            [...offers].sort((a, b) => {
                const unitA = a.unitPrice ?? a.price;
                const unitB = b.unitPrice ?? b.price;
                if (unitA !== unitB) return unitA - unitB;
                return a.price - b.price;
            }),
        [offers],
    );

    const bestOffer = sortedOffers[0] ?? null;
    const bestOfferId = bestOffer?.storeId ?? null;

    const rows = useMemo(() => {
        const selectedIds = new Set(selectedStores.map((store) => store.id));

        // Les magasins sélectionnés restent affichés en tête, même sans relevé,
        // puis on ajoute les autres magasins de Nouméa qui vendent le produit :
        // sans cela un produit vendu ailleurs apparaissait sans aucun prix.
        const selectedRows = selectedStores.map((store) => ({
            storeId: store.id,
            label: store.label,
            offer: offers.find((offer) => offer.storeId === store.id) ?? null,
            isSelectedStore: true,
        }));

        const otherRows = sortedOffers
            .filter((offer) => !selectedIds.has(offer.storeId))
            .slice(0, 10)
            .map((offer) => ({
                storeId: offer.storeId,
                label: offer.storeLabel,
                offer,
                isSelectedStore: false,
            }));

        return [...selectedRows, ...otherRows];
    }, [selectedStores, offers, sortedOffers]);

    const hasOtherStoreRows = rows.some((row) => !row.isSelectedStore);

    return (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <section className="space-y-4">
                <form onSubmit={handleSubmit} className="card p-4 sm:p-5">
                    <label className="label" htmlFor="product-query">
                        Rechercher un produit
                    </label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                            id="product-query"
                            className="input"
                            type="search"
                            placeholder="Ex. riz jasmin, poulet, tomate…"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                        />
                        <button type="submit" className="btn-primary shrink-0" disabled={searchLoading}>
                            {searchLoading ? "Recherche…" : "Rechercher"}
                        </button>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                        {SUGGESTIONS.map((suggestion) => (
                            <button
                                key={suggestion}
                                type="button"
                                className="rounded-full border border-ink/10 bg-white/65 px-2.5 py-1 text-[0.7rem] font-semibold text-ink/60 transition hover:border-lagoon/30 hover:text-lagoon-dark"
                                onClick={() => {
                                    setQuery(suggestion);
                                    void runSearch(suggestion);
                                }}
                            >
                                {suggestion}
                            </button>
                        ))}
                    </div>

                    <p className="mt-3 text-xs text-ink/45">
                        Recherche dans les produits alimentaires référencés à Nouméa. Les prix affichés sont les
                        meilleurs prix connus par la source.
                    </p>
                </form>

                {searchError ? (
                    <p className="rounded-2xl border border-coral/20 bg-coral/10 px-4 py-3 text-sm text-ink/70">
                        {searchError}
                    </p>
                ) : null}

                <div className="space-y-2">
                    {searchLoading
                        ? Array.from({ length: 5 }).map((_, index) => (
                            <div key={index} className="skeleton h-20" />
                        ))
                        : null}

                    {!searchLoading && submittedQuery && products.length === 0 && !searchError ? (
                        <div className="card p-5 text-sm text-ink/60">
                            Aucun produit trouvé pour « {submittedQuery} ». Essayez un terme plus simple, par
                            exemple « riz » plutôt que « riz jasmin 1 kg ».
                        </div>
                    ) : null}

                    {products.map((product) => {
                        const selected = selectedProduct?.id === product.id;
                        return (
                            <button
                                key={product.id}
                                type="button"
                                onClick={() => setSelectedProduct(product)}
                                className={`w-full rounded-2xl border p-4 text-left transition ${selected
                                    ? "border-lagoon/40 bg-lagoon/8"
                                    : "border-ink/8 bg-white/70 hover:border-lagoon/25 hover:bg-white"
                                    }`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold leading-snug">{product.name}</p>
                                        <p className="mt-1 text-xs text-ink/50">
                                            {[product.brand, product.category, product.subCategory]
                                                .filter(Boolean)
                                                .join(" · ")}
                                        </p>
                                    </div>
                                    <div className="shrink-0 text-right">
                                        <p className="price-value text-sm text-lagoon-dark">
                                            {formatXpf(product.bestPrice)}
                                        </p>
                                        <p className="mt-0.5 text-[0.68rem] text-ink/45">
                                            {formatXpfPerUnit(product.bestUnitPrice, product.unitShort)}
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                    {product.promotion ? <span className="badge badge-coral">Promo</span> : null}
                                    {selected ? <span className="badge badge-lagoon">Sélectionné</span> : null}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </section>

            <section className="xl:sticky xl:top-24 xl:self-start">
                <div className="card-strong overflow-hidden">
                    <div className="border-b border-ink/8 p-5">
                        <p className="eyebrow">Comparaison de prix</p>
                        {selectedProduct ? (
                            <>
                                <h2 className="mt-2 text-xl font-extrabold leading-tight">{selectedProduct.name}</h2>
                                <p className="mt-1 text-xs text-ink/50">
                                    {selectedProduct.brand ? `${selectedProduct.brand} · ` : ""}
                                    {selectedProduct.category ?? "Produit"}
                                </p>
                            </>
                        ) : (
                            <>
                                <h2 className="mt-2 text-xl font-extrabold">Sélectionnez un produit.</h2>
                                <p className="mt-2 text-sm leading-relaxed text-ink/55">
                                    Lancez une recherche, puis cliquez sur un résultat pour comparer son prix dans vos
                                    magasins. Sans magasin sélectionné, les meilleurs prix de Nouméa sont affichés.
                                </p>
                            </>
                        )}
                    </div>

                    {selectedProduct ? (
                        <div className="p-5">
                            {hydrated && selectedStores.length > 0 ? (
                                <div className="mb-4 flex flex-wrap gap-1.5">
                                    {selectedStores.map((store) => (
                                        <span key={store.id} className="badge badge-lagoon">
                                            {store.label}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p className="mb-4 rounded-2xl bg-sand px-3 py-2 text-xs text-ink/60">
                                    Astuce : sélectionnez un ou deux magasins pour ne comparer que votre panier.
                                </p>
                            )}

                            {!offersLoading && !offersError && bestOffer ? (
                                <div className="mb-4 rounded-2xl border border-lagoon/20 bg-lagoon/8 px-4 py-3">
                                    <p className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-lagoon-dark">
                                        Meilleur prix à Nouméa
                                    </p>
                                    <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
                                        <span className="price-value text-lg text-lagoon-dark">
                                            {formatXpf(bestOffer.price)}
                                        </span>
                                        <span className="text-xs text-ink/60">{bestOffer.storeLabel}</span>
                                    </p>
                                    <p className="mt-0.5 text-[0.7rem] text-ink/50">
                                        {formatXpfPerUnit(bestOffer.unitPrice ?? bestOffer.price, bestOffer.unitShort)}
                                    </p>
                                </div>
                            ) : null}

                            {offersLoading ? (
                                <div className="space-y-2">
                                    {Array.from({ length: 3 }).map((_, index) => (
                                        <div key={index} className="skeleton h-12" />
                                    ))}
                                </div>
                            ) : null}

                            {offersError ? (
                                <p className="rounded-2xl border border-coral/20 bg-coral/10 px-4 py-3 text-sm text-ink/70">
                                    {offersError}
                                </p>
                            ) : null}

                            {!offersLoading && !offersError && offers.length === 0 ? (
                                <p className="rounded-2xl bg-ink/5 px-4 py-3 text-sm text-ink/60">
                                    Aucun relevé de prix n'est disponible pour ce produit à Nouméa.
                                </p>
                            ) : null}

                            {!offersLoading && !offersError && offers.length > 0 ? (
                                <div className="scroll-x -mx-2">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Magasin</th>
                                                <th>Prix</th>
                                                <th>Prix unitaire</th>
                                                <th>Relevé</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rows.map((row) => (
                                                <tr key={row.storeId}>
                                                    <td>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="font-semibold">{row.label}</span>
                                                            {row.offer && row.storeId === bestOfferId ? (
                                                                <span className="badge badge-lagoon">Le moins cher</span>
                                                            ) : null}
                                                            {row.isSelectedStore ? (
                                                                <span className="rounded-full border border-ink/10 bg-white/70 px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide text-ink/45">
                                                                    Votre magasin
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                        {row.offer?.promotion ? (
                                                            <span className="badge badge-coral mt-1">Promo</span>
                                                        ) : null}
                                                    </td>
                                                    <td>
                                                        {row.offer ? (
                                                            <span className="price-value text-lagoon-dark">
                                                                {formatXpf(row.offer.price)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-ink/40">Non référencé</span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        {row.offer ? (
                                                            <span className="text-ink/65">
                                                                {formatXpfPerUnit(
                                                                    row.offer.unitPrice ?? row.offer.price,
                                                                    row.offer.unitShort,
                                                                )}
                                                            </span>
                                                        ) : (
                                                            "—"
                                                        )}
                                                    </td>
                                                    <td className="text-ink/50">
                                                        {row.offer ? formatDateFr(row.offer.observedAt) : "—"}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : null}

                            {!offersLoading && !offersError && hasOtherStoreRows ? (
                                <p className="mt-3 rounded-2xl bg-sand px-3 py-2 text-xs leading-relaxed text-ink/60">
                                    D'autres magasins de Nouméa vendent ce produit : ils sont affichés à titre de
                                    comparaison, car il n'est pas référencé dans tous les magasins sélectionnés.
                                </p>
                            ) : null}

                            <p className="mt-4 text-[0.7rem] leading-relaxed text-ink/45">
                                Le prix unitaire permet de comparer des formats différents. Le prix affiché est celui
                                du conditionnement tel que relevé par prix.nc.
                            </p>
                        </div>
                    ) : null}
                </div>
            </section>
        </div>
    );
}
