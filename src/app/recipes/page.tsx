import type { Metadata } from "next";
import Link from "next/link";
import { RecipeCard } from "@/components/RecipeCard";
import { listRecipes } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Recettes",
    description: "Choisissez une recette et comparez son coût entre les supermarchés de Nouméa.",
};

export default function RecipesPage() {
    const recipes = listRecipes();

    return (
        <div className="page-shell pb-10 pt-8 sm:pt-12">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div className="max-w-3xl">
                    <p className="eyebrow">À cuisiner</p>
                    <h1 className="section-title mt-2">Vos recettes, au prix de Nouméa.</h1>
                    <p className="mt-3 text-sm leading-relaxed text-ink/60 sm:text-base">
                        Chaque recette peut être calculée pour un ou deux magasins. Les ingrédients sont associés
                        aux produits réels de prix.nc, puis comparés avec les promotions et les formats
                        disponibles.
                    </p>
                </div>
                <Link href="/recipes/new" className="btn-primary shrink-0">
                    <span aria-hidden="true">+</span>
                    Nouvelle recette
                </Link>
            </div>

            {recipes.length > 0 ? (
                <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {recipes.map((recipe) => (
                        <RecipeCard key={recipe.id} recipe={recipe} />
                    ))}
                </div>
            ) : (
                <div className="card mt-8 p-8 text-center">
                    <p className="text-lg font-extrabold">Aucune recette pour le moment.</p>
                    <p className="mt-2 text-sm text-ink/60">
                        Créez une recette avec vos ingrédients et lancez votre première comparaison.
                    </p>
                    <Link href="/recipes/new" className="btn-primary mt-5">
                        Créer ma première recette
                    </Link>
                </div>
            )}
        </div>
    );
}
