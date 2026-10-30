import type { Metadata } from "next";
import { RecipeEditor } from "@/components/RecipeEditor";

export const metadata: Metadata = {
    title: "Nouvelle recette",
    description: "Créez une recette et calculez son coût à Nouméa.",
};

export default function NewRecipePage() {
    return (
        <div className="page-shell max-w-4xl pb-10 pt-8 sm:pt-12">
            <RecipeEditor />
        </div>
    );
}
