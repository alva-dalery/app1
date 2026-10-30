import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RecipeEditor } from "@/components/RecipeEditor";
import { getRecipe } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

interface PageProps {
    params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { id } = await params;
    const recipe = getRecipe(id);
    return {
        title: recipe ? `Modifier ${recipe.name}` : "Modifier la recette",
    };
}

export default async function EditRecipePage({ params }: PageProps) {
    const { id } = await params;
    const recipe = getRecipe(id);
    if (!recipe) notFound();

    return (
        <div className="page-shell max-w-4xl pb-10 pt-8 sm:pt-12">
            <RecipeEditor initialRecipe={recipe} />
        </div>
    );
}
