import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteRecipeButton } from "@/components/DeleteRecipeButton";
import { RecipeCostPanel } from "@/components/RecipeCostPanel";
import { getRecipe } from "@/lib/db/repository";
import { getNoumeaStores } from "@/lib/prixnc/client";
import type { Store } from "@/lib/prixnc/types";

export const dynamic = "force-dynamic";

interface PageProps {
    params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { id } = await params;
    const recipe = getRecipe(id);
    return {
        title: recipe?.name ?? "Recette",
        description: recipe?.description ?? "Calculez le coût d'une recette à Nouméa.",
    };
}

export default async function RecipePage({ params }: PageProps) {
    const { id } = await params;
    const recipe = getRecipe(id);
    if (!recipe) notFound();

    let stores: Store[] = [];
    try {
        stores = await getNoumeaStores();
    } catch {
        // Le calcul affichera un message explicite si les magasins sont indisponibles.
    }

    const optionalCount = recipe.ingredients.filter((ingredient) => ingredient.optional).length;

    return (
        <div className="page-shell pb-10 pt-8 sm:pt-12">
            <Link
                href="/recipes"
                className="inline-flex items-center gap-1 text-xs font-bold text-ink/50 transition hover:text-lagoon-dark"
            >
                <span aria-hidden="true">←</span>
                Toutes les recettes
            </Link>

            <header className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="badge badge-sand">{recipe.baseServings} portions de base</span>
                        <span className="badge badge-neutral">
                            {recipe.ingredients.length} ingrédient{recipe.ingredients.length > 1 ? "s" : ""}
                        </span>
                        {optionalCount > 0 ? (
                            <span className="badge badge-neutral">{optionalCount} optionnel(s)</span>
                        ) : null}
                    </div>
                    <h1 className="section-title mt-3 text-3xl sm:text-4xl">{recipe.name}</h1>
                    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink/60 sm:text-base">
                        {recipe.description || "Une recette à comparer entre les magasins de Nouméa."}
                    </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-start gap-2">
                    <Link href={`/recipes/${recipe.id}/edit`} className="btn-secondary">
                        Modifier
                    </Link>
                    <DeleteRecipeButton recipeId={recipe.id} />
                </div>
            </header>

            <div className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
                <RecipeCostPanel recipe={recipe} stores={stores} />

                <aside className="space-y-3 lg:sticky lg:top-24">
                    <div className="card p-5">
                        <p className="eyebrow">La recette</p>
                        <dl className="mt-3 space-y-3 text-sm">
                            <div className="flex items-center justify-between gap-3">
                                <dt className="text-ink/55">Portions de base</dt>
                                <dd className="font-extrabold">{recipe.baseServings}</dd>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                                <dt className="text-ink/55">Ingrédients</dt>
                                <dd className="font-extrabold">{recipe.ingredients.length}</dd>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                                <dt className="text-ink/55">Optionnels</dt>
                                <dd className="font-extrabold">{optionalCount}</dd>
                            </div>
                        </dl>
                    </div>

                    <div className="card p-5">
                        <p className="eyebrow">Ingrédients de base</p>
                        <ul className="mt-3 space-y-2">
                            {recipe.ingredients.map((ingredient) => (
                                <li
                                    key={ingredient.id}
                                    className="flex items-start justify-between gap-3 border-b border-ink/6 pb-2 text-sm last:border-0 last:pb-0"
                                >
                                    <span className="text-ink/70">
                                        {ingredient.label}
                                        {ingredient.optional ? (
                                            <span className="ml-1 text-[0.65rem] text-ink/40">(optionnel)</span>
                                        ) : null}
                                    </span>
                                    <span className="shrink-0 font-semibold text-ink/55">
                                        {ingredient.quantity} {ingredient.unit}
                                    </span>
                                </li>
                            ))}
                        </ul>
                        <p className="mt-3 text-[0.7rem] leading-relaxed text-ink/45">
                            Les quantités seront recalculées proportionnellement au nombre de portions choisi.
                        </p>
                    </div>

                    <div className="rounded-2xl border border-ink/8 bg-white/55 p-4 text-xs leading-relaxed text-ink/55">
                        Les prix proviennent de prix.nc et peuvent varier. Le calcul privilégie les produits
                        réellement disponibles dans les magasins sélectionnés.
                    </div>
                </aside>
            </div>
        </div>
    );
}
