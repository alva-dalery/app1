"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Recipe, RecipeIngredient } from "@/lib/db/repository";
import type { Store } from "@/lib/prixnc/types";
import type { RecipeCostResponse } from "@/lib/pricing/cost-service";
import { formatNumber, formatXpf } from "@/lib/pricing/currency";
import { IngredientMappingDialog } from "./IngredientMappingDialog";
import { useStores } from "./StoreProvider";
import { StoreSelector } from "./StoreSelector";

export function RecipeCostPanel({
    recipe,
    stores,
}: {
    recipe: Recipe;
    stores: Store[];
}) {
    const { selectedStores, hydrated } = useStores();
    const [servings, setServings] = useState(recipe.baseServings);
    const [showStores, setShowStores] = useState(false);
    const [result, setResult] = useState<RecipeCostResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mappingIngredient, setMappingIngredient] = useState<RecipeIngredient | null>(null);
    const requestRef = useRef(0);

    const storeKey = selectedStores.map((store) => store.id).join(",");

    const calculate = useCallback(async () => {
        const storeIds = storeKey ? storeKey.split(",") : [];
        if (storeIds.length === 0) {
            setResult(null);
            setError(null);
            return;
        }

        const requestId = ++requestRef.current;
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/recipes/${recipe.id}/cost`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ storeIds, servings }),
            });
            const payload = (await response.json()) as RecipeCostResponse & { error?: string };
            if (!response.ok) throw new Error(payload.error ?? "Le calcul du coût a échoué.");
            if (requestRef.current === requestId) setResult(payload);
        } catch (caught) {
            if (requestRef.current === requestId) {
                setResult(null);
                setError(caught instanceof Error ? caught.message : "Le calcul du coût a échoué.");
            }
        } finally {
            if (requestRef.current === requestId) setLoading(false);
        }
    }, [recipe.id, storeKey, servings]);

    useEffect(() => {
        if (!hydrated) return;

        if (!storeKey) {
            setResult(null);
            return;
        }

        setResult(null);
        const timer = window.setTimeout(() => {
            void calculate();
        }, 250);

        return () => window.clearTimeout(timer);
    }, [hydrated, storeKey, servings, calculate]);

    const bestSingle = useMemo(() => {
        if (!result) return null;
        return result.stores.find((store) => store.storeId === result.bestSingleStoreId) ?? null;
    }, [result]);

    const bestPartial = useMemo(() => {
        if (!result?.bestPartialStoreId) return null;
        return result.stores.find((store) => store.storeId === result.bestPartialStoreId) ?? null;
    }, [result]);

    const splitGroups = useMemo(() => {
        if (!result?.optimizedSplit) return [];
        return result.selectedStores
            .map((store) => {
                const items = result.optimizedSplit!.assignments.filter(
                    (assignment) => assignment.storeId === store.id,
                );
                return {
                    store,
                    items,
                    total: items.reduce((sum, item) => sum + item.purchaseCost, 0),
                };
            })
            .filter((group) => group.items.length > 0);
    }, [result]);

    function changeServings(next: number) {
        setServings(Math.max(1, Math.min(100, Number.isFinite(next) ? Math.round(next) : 1)));
    }

    return (
        <div className="space-y-4">
            <section className="card-strong p-5 sm:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                        <p className="eyebrow">Calcul du panier</p>
                        <h2 className="mt-1 text-xl font-extrabold tracking-tight sm:text-2xl">
                            Combien coûte cette recette ?
                        </h2>
                        <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink/55">
                            Le calcul compare les produits associés dans vos magasins, avec les prix relevés par
                            prix.nc. Le coût d'achat inclut les packs entiers ; le coût consommé correspond à
                            la quantité réellement utilisée.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center rounded-full border border-ink/12 bg-white p-1">
                            <button
                                type="button"
                                className="flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold text-ink/60 transition hover:bg-lagoon/10 hover:text-lagoon-dark"
                                onClick={() => changeServings(servings - 1)}
                                aria-label="Diminuer le nombre de portions"
                            >
                                −
                            </button>
                            <input
                                className="w-14 border-0 bg-transparent text-center text-sm font-extrabold outline-none"
                                type="number"
                                min={1}
                                max={100}
                                value={servings}
                                onChange={(event) => changeServings(Number(event.target.value))}
                                aria-label="Nombre de portions"
                            />
                            <button
                                type="button"
                                className="flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold text-ink/60 transition hover:bg-lagoon/10 hover:text-lagoon-dark"
                                onClick={() => changeServings(servings + 1)}
                                aria-label="Augmenter le nombre de portions"
                            >
                                +
                            </button>
                        </div>
                        <span className="text-xs font-semibold text-ink/50">portions</span>
                        <button
                            type="button"
                            className="btn-primary"
                            onClick={() => void calculate()}
                            disabled={loading || !storeKey || !hydrated}
                        >
                            {loading ? "Calcul…" : "Recalculer"}
                        </button>
                    </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-ink/8 pt-4">
                    {hydrated && selectedStores.length > 0 ? (
                        selectedStores.map((store) => (
                            <span key={store.id} className="badge badge-lagoon">
                                {store.label}
                            </span>
                        ))
                    ) : (
                        <span className="text-xs font-semibold text-ink/50">Aucun magasin sélectionné</span>
                    )}
                    <button
                        type="button"
                        className="btn-ghost text-xs"
                        onClick={() => setShowStores((current) => !current)}
                    >
                        {showStores ? "Masquer la sélection" : "Modifier les magasins"}
                    </button>
                    <Link href="/stores" className="text-xs font-bold text-lagoon-dark hover:underline">
                        Tous les magasins →
                    </Link>
                </div>

                {showStores ? (
                    <div className="mt-4 rounded-2xl border border-ink/8 bg-white/55 p-4">
                        <StoreSelector stores={stores} limit={12} />
                    </div>
                ) : null}

                {!hydrated ? (
                    <p className="mt-4 text-xs text-ink/50">Chargement de votre sélection de magasins…</p>
                ) : null}

                {hydrated && selectedStores.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-sun/30 bg-sun/10 px-4 py-3 text-sm text-ink/70">
                        Sélectionnez au moins un magasin pour lancer le calcul.{" "}
                        <button
                            type="button"
                            className="font-bold text-lagoon-dark underline"
                            onClick={() => setShowStores(true)}
                        >
                            Choisir un magasin
                        </button>
                    </div>
                ) : null}
            </section>

            {error ? (
                <div className="rounded-2xl border border-coral/20 bg-coral/10 px-4 py-3 text-sm font-semibold text-ink/75">
                    {error}
                </div>
            ) : null}

            {loading && !result ? (
                <div className="grid gap-3 md:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className="skeleton h-32" />
                    ))}
                </div>
            ) : null}

            {result ? (
                <>
                    <div className="grid gap-3 md:grid-cols-3">
                        <div className="card p-5">
                            <p className="eyebrow">
                                {bestSingle ? "Meilleur magasin unique" : "Meilleur total partiel"}
                            </p>
                            <p className="mt-2 text-lg font-extrabold">
                                {bestSingle?.storeLabel ?? bestPartial?.storeLabel ?? "Aucun magasin complet"}
                            </p>
                            <p className="price-value mt-1 text-3xl">
                                {formatXpf(bestSingle?.totalPurchase ?? bestPartial?.totalPurchase)}
                            </p>
                            <p className="mt-1 text-xs text-ink/50">
                                Achat des packs ·{" "}
                                {formatXpf(bestSingle?.totalConsumed ?? bestPartial?.totalConsumed)} consommés
                            </p>
                            {bestSingle ? (
                                <span className="badge badge-lagoon mt-3">Panier complet</span>
                            ) : bestPartial ? (
                                <span className="badge badge-coral mt-3">
                                    Total partiel · {bestPartial.missingRequired} manquant(s)
                                </span>
                            ) : null}
                            {!bestSingle ? (
                                <p className="mt-2 text-[0.7rem] leading-relaxed text-ink/45">
                                    Aucun magasin ne couvre tous les ingrédients avec cette sélection.
                                </p>
                            ) : null}
                        </div>

                        <div className="card p-5">
                            <p className="eyebrow">
                                {result.stores.length > 1 ? "Panier optimisé sur 2 magasins" : "Panier calculé"}
                            </p>
                            <p className="mt-2 text-lg font-extrabold">
                                {result.optimizedSplit?.complete ? "Répartition optimale" : "Répartition partielle"}
                            </p>
                            <p className="price-value mt-1 text-3xl">
                                {formatXpf(result.optimizedSplit?.totalPurchase)}
                            </p>
                            {result.optimizedSplit?.complete &&
                                result.optimizedSplit.savingsVsBestSingle > 0 ? (
                                <span className="badge badge-sand mt-3">
                                    Économie {formatXpf(result.optimizedSplit.savingsVsBestSingle)}
                                </span>
                            ) : result.optimizedSplit?.complete ? (
                                <span className="badge badge-neutral mt-3">Pas d'économie supplémentaire</span>
                            ) : (
                                <span className="badge badge-coral mt-3">Comparaison incomplète</span>
                            )}
                        </div>

                        <div className="card p-5">
                            <p className="eyebrow">Couverture</p>
                            <p className="mt-2 text-lg font-extrabold">
                                {result.coverage.mapped}/{result.coverage.total} ingrédients associés
                            </p>
                            <p className="mt-1 text-xs text-ink/50">
                                Calcul pour {result.servings} portion{result.servings > 1 ? "s" : ""}
                            </p>
                            {result.unresolved.length > 0 ? (
                                <p className="mt-3 text-xs font-semibold text-coral">
                                    {result.unresolved.length} ingrédient(s) sans produit associé
                                </p>
                            ) : (
                                <span className="badge badge-lagoon mt-3">Tous les ingrédients sont associés</span>
                            )}
                        </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                        {result.stores.map((store) => {
                            const isBest = store.storeId === result.bestSingleStoreId;
                            const isBestPartial = store.storeId === result.bestPartialStoreId;
                            return (
                                <div
                                    key={store.storeId}
                                    className={`card p-5 ${isBest ? "border-lagoon/35 bg-lagoon/5" : ""
                                        }`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-extrabold">{store.storeLabel}</p>
                                            <p className="mt-1 text-xs text-ink/50">
                                                {store.missingRequired === 0
                                                    ? "Tous les produits sont disponibles"
                                                    : `${store.missingRequired} ingrédient(s) manquant(s)`}
                                            </p>
                                        </div>
                                        {isBest ? (
                                            <span className="badge badge-lagoon">Moins cher</span>
                                        ) : isBestPartial ? (
                                            <span className="badge badge-coral">Meilleur partiel</span>
                                        ) : null}
                                    </div>
                                    <div className="mt-4 flex items-end justify-between gap-3">
                                        <div>
                                            <p className="price-value text-2xl">{formatXpf(store.totalPurchase)}</p>
                                            <p className="mt-1 text-[0.7rem] text-ink/45">
                                                Consommé : {formatXpf(store.totalConsumed)}
                                            </p>
                                        </div>
                                        <span
                                            className={`badge ${store.complete ? "badge-lagoon" : "badge-coral"
                                                }`}
                                        >
                                            {store.complete ? "Complet" : "Incomplet"}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {result.stores.length > 1 && result.optimizedSplit ? (
                        <section className="card p-5 sm:p-6">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                                <div>
                                    <p className="eyebrow">Répartition optimisée</p>
                                    <h3 className="mt-1 text-xl font-extrabold tracking-tight">
                                        Achetez chaque ingrédient au meilleur prix.
                                    </h3>
                                    <p className="mt-1 text-sm text-ink/55">
                                        Cette répartition minimise le total, mais implique deux déplacements.
                                    </p>
                                </div>
                                <span
                                    className={`badge shrink-0 ${!result.optimizedSplit.complete
                                            ? "badge-coral"
                                            : result.optimizedSplit.savingsVsBestSingle > 0
                                                ? "badge-sand"
                                                : "badge-lagoon"
                                        }`}
                                >
                                    {!result.optimizedSplit.complete
                                        ? "Comparaison partielle"
                                        : result.optimizedSplit.savingsVsBestSingle > 0
                                            ? `Économie ${formatXpf(result.optimizedSplit.savingsVsBestSingle)}`
                                            : bestSingle
                                                ? "Pas d'économie supplémentaire"
                                                : "Panier complet sur 2 magasins"}
                                </span>
                            </div>

                            <div className="mt-4 grid gap-3 md:grid-cols-2">
                                {splitGroups.map(({ store, items, total }) => (
                                    <div key={store.id} className="rounded-2xl border border-ink/8 bg-white/70 p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-sm font-extrabold">{store.label}</p>
                                            <p className="price-value text-sm">{formatXpf(total)}</p>
                                        </div>
                                        <ul className="mt-3 space-y-2">
                                            {items.map((item) => (
                                                <li
                                                    key={item.ingredientId}
                                                    className="flex items-start justify-between gap-3 text-sm"
                                                >
                                                    <span className="text-ink/70">{item.label}</span>
                                                    <span className="price-value shrink-0 text-xs">
                                                        {formatXpf(item.purchaseCost)}
                                                    </span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                ))}
                            </div>

                            <p className="mt-3 text-xs leading-relaxed text-ink/45">
                                Les produits indisponibles ne sont pas comptés dans la répartition. Vérifiez la
                                liste des manquants avant de vous déplacer.
                            </p>
                        </section>
                    ) : null}

                    <section className="card overflow-hidden">
                        <div className="border-b border-ink/8 p-5">
                            <p className="eyebrow">Détail du calcul</p>
                            <h3 className="mt-1 text-xl font-extrabold tracking-tight">Ingrédient par ingrédient</h3>
                            <p className="mt-1 text-sm text-ink/55">
                                Le prix affiché est le coût d'achat du ou des packs nécessaires.
                            </p>
                        </div>

                        <div className="scroll-x">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Ingrédient</th>
                                        <th>Produit associé</th>
                                        <th>Quantité</th>
                                        {result.selectedStores.map((store) => (
                                            <th key={store.id}>{store.label}</th>
                                        ))}
                                        <th>Meilleur</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.ingredients.map((ingredient) => {
                                        const recipeIngredient =
                                            recipe.ingredients.find((item) => item.id === ingredient.id) ?? null;
                                        return (
                                            <tr key={ingredient.id}>
                                                <td>
                                                    <p className="font-semibold">{ingredient.label}</p>
                                                    <div className="mt-1 flex flex-wrap gap-1">
                                                        {ingredient.optional ? (
                                                            <span className="badge badge-neutral">Optionnel</span>
                                                        ) : null}
                                                    </div>
                                                    {ingredient.warning ? (
                                                        <p className="mt-1 max-w-48 text-[0.65rem] leading-snug text-ink/45">
                                                            {ingredient.warning}
                                                        </p>
                                                    ) : null}
                                                </td>
                                                <td>
                                                    <p className="max-w-56 text-xs leading-snug">
                                                        {ingredient.productName ?? (
                                                            <span className="font-semibold text-coral">Non associé</span>
                                                        )}
                                                    </p>
                                                    <button
                                                        type="button"
                                                        className="mt-1 text-[0.65rem] font-bold text-lagoon-dark hover:underline"
                                                        onClick={() => setMappingIngredient(recipeIngredient)}
                                                    >
                                                        Changer
                                                    </button>
                                                </td>
                                                <td className="whitespace-nowrap">
                                                    {formatNumber(ingredient.quantity, 2)} {ingredient.unit}
                                                </td>
                                                {result.selectedStores.map((store) => {
                                                    const offer = ingredient.offers[store.id];
                                                    const isBest = ingredient.bestStoreId === store.id;
                                                    return (
                                                        <td key={store.id} className={isBest ? "bg-lagoon/5" : ""}>
                                                            {offer?.available ? (
                                                                <>
                                                                    <span
                                                                        className={`price-value ${isBest ? "text-lagoon-dark" : ""
                                                                            }`}
                                                                    >
                                                                        {formatXpf(offer.purchaseCost)}
                                                                    </span>
                                                                    <span className="mt-0.5 block text-[0.65rem] text-ink/40">
                                                                        {offer.packaged
                                                                            ? `${formatNumber(offer.packs, 0)} pack(s)`
                                                                            : "au poids"}
                                                                    </span>
                                                                    <span className="mt-0.5 block text-[0.65rem] text-ink/35">
                                                                        consommé {formatXpf(offer.consumedCost)}
                                                                    </span>
                                                                </>
                                                            ) : (
                                                                <span className="text-ink/35">Non dispo.</span>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                                <td>
                                                    <span className="badge badge-lagoon">
                                                        {result.selectedStores.find(
                                                            (store) => store.id === ingredient.bestStoreId,
                                                        )?.label ?? "—"}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    {result.warnings.length > 0 ? (
                        <section className="rounded-2xl border border-sun/30 bg-sun/10 p-5">
                            <h3 className="text-sm font-extrabold">Points à vérifier</h3>
                            <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-ink/65">
                                {result.warnings.slice(0, 12).map((warning) => (
                                    <li key={warning} className="flex gap-2">
                                        <span aria-hidden="true" className="text-sun">
                                            •
                                        </span>
                                        <span>{warning}</span>
                                    </li>
                                ))}
                            </ul>
                            {result.warnings.length > 12 ? (
                                <p className="mt-2 text-[0.7rem] text-ink/45">
                                    {result.warnings.length - 12} autre(s) avertissement(s).
                                </p>
                            ) : null}
                        </section>
                    ) : null}

                    {result.autoMapped.length > 0 ? (
                        <p className="rounded-2xl bg-ink/5 px-4 py-3 text-xs leading-relaxed text-ink/55">
                            {result.autoMapped.length} ingrédient(s) ont été associés automatiquement à un produit.
                            Utilisez « Changer » dans le tableau pour corriger une correspondance approximative.
                        </p>
                    ) : null}
                </>
            ) : null}

            {mappingIngredient ? (
                <IngredientMappingDialog
                    recipeId={recipe.id}
                    ingredient={mappingIngredient}
                    onClose={() => setMappingIngredient(null)}
                    onMapped={() => {
                        setMappingIngredient(null);
                        void calculate();
                    }}
                />
            ) : null}
        </div>
    );
}
