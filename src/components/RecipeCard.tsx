import Link from "next/link";
import type { RecipeSummary } from "@/lib/db/repository";

export function RecipeCard({ recipe }: { recipe: RecipeSummary }) {
    return (
        <Link
            href={`/recipes/${recipe.id}`}
            className="card group flex h-full flex-col justify-between p-5 transition duration-200 hover:-translate-y-0.5 hover:border-lagoon/30 hover:shadow-[0_28px_60px_-42px_rgba(15,118,110,0.55)]"
        >
            <div>
                <div className="flex items-center justify-between gap-3">
                    <span className="badge badge-sand">{recipe.baseServings} portions</span>
                    <span className="text-xs font-semibold text-ink/40">
                        {recipe.ingredientCount} ingrédient{recipe.ingredientCount > 1 ? "s" : ""}
                    </span>
                </div>
                <h3 className="mt-4 text-xl font-extrabold tracking-tight group-hover:text-lagoon-dark">
                    {recipe.name}
                </h3>
                <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink/60">
                    {recipe.description || "Une recette à comparer entre les magasins de Nouméa."}
                </p>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-ink/8 pt-4">
                <span className="text-xs font-bold text-lagoon-dark">Calculer le coût</span>
                <span
                    aria-hidden="true"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-lagoon/10 text-lagoon-dark transition group-hover:bg-lagoon group-hover:text-white"
                >
                    →
                </span>
            </div>
        </Link>
    );
}
