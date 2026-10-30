"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import type { Recipe } from "@/lib/db/repository";

const UNIT_OPTIONS = ["g", "kg", "ml", "cl", "l", "unité", "c. à soupe", "c. à café"];

interface EditorIngredient {
    key: string;
    id?: string;
    label: string;
    quantity: string;
    unit: string;
    optional: boolean;
}

function newRow(): EditorIngredient {
    return {
        key: Math.random().toString(36).slice(2),
        label: "",
        quantity: "",
        unit: "g",
        optional: false,
    };
}

function initialRows(recipe?: Recipe): EditorIngredient[] {
    if (!recipe) return [newRow()];
    return recipe.ingredients.map((ingredient) => ({
        key: ingredient.id,
        id: ingredient.id,
        label: ingredient.label,
        quantity: String(ingredient.quantity),
        unit: ingredient.unit,
        optional: ingredient.optional,
    }));
}

export function RecipeEditor({ initialRecipe }: { initialRecipe?: Recipe }) {
    const router = useRouter();
    const [name, setName] = useState(initialRecipe?.name ?? "");
    const [description, setDescription] = useState(initialRecipe?.description ?? "");
    const [baseServings, setBaseServings] = useState(String(initialRecipe?.baseServings ?? 4));
    const [ingredients, setIngredients] = useState<EditorIngredient[]>(() =>
        initialRows(initialRecipe),
    );
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const editing = Boolean(initialRecipe);

    function updateIngredient(key: string, patch: Partial<EditorIngredient>) {
        setIngredients((current) =>
            current.map((ingredient) =>
                ingredient.key === key ? { ...ingredient, ...patch } : ingredient,
            ),
        );
    }

    function removeIngredient(key: string) {
        setIngredients((current) => {
            if (current.length === 1) return current;
            return current.filter((ingredient) => ingredient.key !== key);
        });
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);

        const servings = Number(baseServings);
        if (!name.trim()) {
            setError("Donnez un nom à la recette.");
            return;
        }
        if (!Number.isInteger(servings) || servings < 1 || servings > 100) {
            setError("Le nombre de portions doit être compris entre 1 et 100.");
            return;
        }

        const cleaned = ingredients
            .map((ingredient) => ({
                id: ingredient.id,
                label: ingredient.label.trim(),
                quantity: Number(ingredient.quantity.replace(",", ".")),
                unit: ingredient.unit,
                optional: ingredient.optional,
            }))
            .filter((ingredient) => ingredient.label.length > 0 || Number.isFinite(ingredient.quantity));

        if (cleaned.length === 0) {
            setError("Ajoutez au moins un ingrédient.");
            return;
        }

        for (const ingredient of cleaned) {
            if (!ingredient.label) {
                setError("Chaque ligne doit avoir un nom d'ingrédient.");
                return;
            }
            if (!Number.isFinite(ingredient.quantity) || ingredient.quantity <= 0) {
                setError(`La quantité de « ${ingredient.label} » est invalide.`);
                return;
            }
        }

        setSaving(true);
        try {
            const response = await fetch(
                editing ? `/api/recipes/${initialRecipe?.id}` : "/api/recipes",
                {
                    method: editing ? "PUT" : "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: name.trim(),
                        description: description.trim(),
                        baseServings: servings,
                        ingredients: cleaned,
                    }),
                },
            );

            const payload = (await response.json()) as { recipe?: Recipe; error?: string };
            if (!response.ok || !payload.recipe) {
                throw new Error(payload.error ?? "Impossible d'enregistrer la recette.");
            }

            router.push(`/recipes/${payload.recipe.id}`);
            router.refresh();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Impossible d'enregistrer la recette.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <div className="card p-5 sm:p-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <p className="eyebrow">{editing ? "Modification" : "Nouvelle recette"}</p>
                        <h1 className="section-title mt-2">
                            {editing ? "Ajustez votre recette." : "Composez votre recette."}
                        </h1>
                    </div>
                    <span className="badge badge-lagoon shrink-0">Prix en XPF</span>
                </div>

                <div className="mt-6 grid gap-4">
                    <div>
                        <label className="label" htmlFor="recipe-name">
                            Nom de la recette
                        </label>
                        <input
                            id="recipe-name"
                            className="input"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            placeholder="Ex. Curry de poulet au lait de coco"
                            maxLength={120}
                        />
                    </div>

                    <div>
                        <label className="label" htmlFor="recipe-description">
                            Description
                        </label>
                        <textarea
                            id="recipe-description"
                            className="textarea min-h-24"
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            placeholder="Une phrase pour présenter la recette, son origine ou vos astuces."
                            maxLength={500}
                        />
                    </div>

                    <div className="max-w-52">
                        <label className="label" htmlFor="recipe-servings">
                            Portions de base
                        </label>
                        <input
                            id="recipe-servings"
                            className="input"
                            type="number"
                            min={1}
                            max={100}
                            value={baseServings}
                            onChange={(event) => setBaseServings(event.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="card p-5 sm:p-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="eyebrow">Ingrédients</p>
                        <h2 className="mt-1 text-xl font-extrabold tracking-tight">Les quantités de la recette</h2>
                        <p className="mt-1 text-sm text-ink/55">
                            Utilisez g, kg, ml, cl, l ou unité. Les produits seront associés automatiquement lors
                            du premier calcul.
                        </p>
                    </div>
                    <button
                        type="button"
                        className="btn-secondary shrink-0 text-sm"
                        onClick={() => setIngredients((current) => [...current, newRow()])}
                    >
                        + Ajouter un ingrédient
                    </button>
                </div>

                <div className="mt-5 space-y-3">
                    {ingredients.map((ingredient, index) => (
                        <div
                            key={ingredient.key}
                            className="rounded-2xl border border-ink/8 bg-white/55 p-3 sm:p-4"
                        >
                            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem_8rem_auto_auto] sm:items-end">
                                <div>
                                    <label className="label" htmlFor={`ingredient-label-${ingredient.key}`}>
                                        Ingrédient {index + 1}
                                    </label>
                                    <input
                                        id={`ingredient-label-${ingredient.key}`}
                                        className="input"
                                        value={ingredient.label}
                                        onChange={(event) =>
                                            updateIngredient(ingredient.key, { label: event.target.value })
                                        }
                                        placeholder="Ex. tomate, riz, lait de coco…"
                                    />
                                </div>

                                <div>
                                    <label className="label" htmlFor={`ingredient-quantity-${ingredient.key}`}>
                                        Quantité
                                    </label>
                                    <input
                                        id={`ingredient-quantity-${ingredient.key}`}
                                        className="input"
                                        inputMode="decimal"
                                        value={ingredient.quantity}
                                        onChange={(event) =>
                                            updateIngredient(ingredient.key, { quantity: event.target.value })
                                        }
                                        placeholder="400"
                                    />
                                </div>

                                <div>
                                    <label className="label" htmlFor={`ingredient-unit-${ingredient.key}`}>
                                        Unité
                                    </label>
                                    <select
                                        id={`ingredient-unit-${ingredient.key}`}
                                        className="select"
                                        value={ingredient.unit}
                                        onChange={(event) =>
                                            updateIngredient(ingredient.key, { unit: event.target.value })
                                        }
                                    >
                                        {UNIT_OPTIONS.map((unit) => (
                                            <option key={unit} value={unit}>
                                                {unit}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <label className="flex items-center gap-2 pb-2 text-xs font-semibold text-ink/60 sm:pb-3">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-ink/20 accent-lagoon"
                                        checked={ingredient.optional}
                                        onChange={(event) =>
                                            updateIngredient(ingredient.key, { optional: event.target.checked })
                                        }
                                    />
                                    Optionnel
                                </label>

                                <button
                                    type="button"
                                    className="btn-ghost text-xs text-coral hover:bg-coral/10"
                                    onClick={() => removeIngredient(ingredient.key)}
                                    disabled={ingredients.length === 1}
                                    aria-label={`Supprimer ${ingredient.label || `l'ingrédient ${index + 1}`}`}
                                >
                                    Supprimer
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {error ? (
                <div className="rounded-2xl border border-coral/20 bg-coral/10 px-4 py-3 text-sm font-semibold text-ink/75">
                    {error}
                </div>
            ) : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Link href={editing && initialRecipe ? `/recipes/${initialRecipe.id}` : "/recipes"} className="btn-ghost">
                    Annuler
                </Link>
                <button type="submit" className="btn-primary" disabled={saving}>
                    {saving ? "Enregistrement…" : editing ? "Enregistrer les modifications" : "Créer la recette"}
                </button>
            </div>
        </form>
    );
}
