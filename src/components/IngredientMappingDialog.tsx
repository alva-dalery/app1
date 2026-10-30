"use client";

import { FormEvent, useEffect, useState } from "react";
import type { RecipeIngredient } from "@/lib/db/repository";
import { formatXpf, formatXpfPerUnit } from "@/lib/pricing/currency";
import type { Product } from "@/lib/prixnc/types";

interface ProductsPayload {
    products?: Product[];
    error?: string;
}

export function IngredientMappingDialog({
    recipeId,
    ingredient,
    onClose,
    onMapped,
}: {
    recipeId: string;
    ingredient: RecipeIngredient;
    onClose: () => void;
    onMapped: () => void;
}) {
    const [query, setQuery] = useState(ingredient.label);
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function search(value: string) {
        const trimmed = value.trim();
        if (trimmed.length < 2) {
            setError("Saisissez au moins deux caractères.");
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/products?q=${encodeURIComponent(trimmed)}&size=20`);
            const payload = (await response.json()) as ProductsPayload;
            if (!response.ok) throw new Error(payload.error ?? "La recherche a échoué.");
            setProducts(payload.products ?? []);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "La recherche a échoué.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void search(ingredient.label);
        // La recherche initiale ne doit se relancer que si l'ingrédient change.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ingredient.id]);

    useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") onClose();
        }
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [onClose]);

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        void search(query);
    }

    async function chooseProduct(product: Product) {
        setSavingId(product.id);
        setError(null);
        try {
            const response = await fetch(
                `/api/recipes/${recipeId}/ingredients/${ingredient.id}/mapping`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        productId: product.id,
                        productName: product.name,
                        productUnit: product.unitShort ?? null,
                    }),
                },
            );
            const payload = (await response.json()) as { error?: string };
            if (!response.ok) throw new Error(payload.error ?? "Impossible d'enregistrer le produit.");
            onMapped();
            onClose();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Impossible d'enregistrer le produit.");
        } finally {
            setSavingId(null);
        }
    }

    return (
        <div className="modal-backdrop" onClick={onClose} role="presentation">
            <div
                className="modal-panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby="mapping-title"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="sticky top-0 z-10 border-b border-ink/8 bg-[#fdfaf4]/95 px-5 py-4 backdrop-blur">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="eyebrow">Correspondance produit</p>
                            <h2 id="mapping-title" className="mt-1 text-xl font-extrabold tracking-tight">
                                {ingredient.label}
                            </h2>
                            <p className="mt-1 text-xs text-ink/50">
                                Choisissez le produit réel utilisé pour calculer le coût de cet ingrédient.
                            </p>
                        </div>
                        <button type="button" className="btn-ghost shrink-0" onClick={onClose} aria-label="Fermer">
                            ✕
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
                        <input
                            className="input"
                            type="search"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Rechercher un produit…"
                            aria-label="Rechercher un produit"
                        />
                        <button type="submit" className="btn-primary shrink-0" disabled={loading}>
                            {loading ? "…" : "Chercher"}
                        </button>
                    </form>
                </div>

                <div className="space-y-2 p-5">
                    {error ? (
                        <p className="rounded-2xl border border-coral/20 bg-coral/10 px-4 py-3 text-sm text-ink/70">
                            {error}
                        </p>
                    ) : null}

                    {loading
                        ? Array.from({ length: 4 }).map((_, index) => (
                            <div key={index} className="skeleton h-16" />
                        ))
                        : null}

                    {!loading && products.length === 0 && !error ? (
                        <p className="rounded-2xl bg-ink/5 px-4 py-3 text-sm text-ink/60">
                            Aucun produit trouvé. Essayez un nom plus court ou un synonyme.
                        </p>
                    ) : null}

                    {products.map((product) => {
                        const isCurrent = ingredient.productId === product.id;
                        return (
                            <button
                                key={product.id}
                                type="button"
                                className={`w-full rounded-2xl border p-4 text-left transition ${isCurrent
                                        ? "border-lagoon/40 bg-lagoon/8"
                                        : "border-ink/8 bg-white/70 hover:border-lagoon/25 hover:bg-white"
                                    }`}
                                onClick={() => void chooseProduct(product)}
                                disabled={Boolean(savingId)}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold leading-snug">{product.name}</p>
                                        <p className="mt-1 text-xs text-ink/50">
                                            {[product.brand, product.category].filter(Boolean).join(" · ")}
                                        </p>
                                        <div className="mt-2 flex flex-wrap gap-1.5">
                                            {isCurrent ? <span className="badge badge-lagoon">Produit actuel</span> : null}
                                            {product.promotion ? <span className="badge badge-coral">Promo</span> : null}
                                        </div>
                                    </div>
                                    <div className="shrink-0 text-right">
                                        <p className="price-value text-sm text-lagoon-dark">
                                            {formatXpf(product.bestPrice)}
                                        </p>
                                        <p className="mt-0.5 text-[0.68rem] text-ink/45">
                                            {formatXpfPerUnit(product.bestUnitPrice, product.unitShort)}
                                        </p>
                                        {savingId === product.id ? (
                                            <p className="mt-1 text-[0.65rem] font-bold text-lagoon">Sélection…</p>
                                        ) : null}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
