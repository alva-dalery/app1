"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteRecipeButton({ recipeId }: { recipeId: string }) {
    const router = useRouter();
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleDelete() {
        const confirmed = window.confirm(
            "Supprimer cette recette ? Les ingrédients et les correspondances produits associées seront également supprimés.",
        );
        if (!confirmed) return;

        setDeleting(true);
        setError(null);

        try {
            const response = await fetch(`/api/recipes/${recipeId}`, { method: "DELETE" });
            if (!response.ok) {
                const payload = (await response.json().catch(() => ({}))) as { error?: string };
                throw new Error(payload.error ?? "Impossible de supprimer la recette.");
            }
            router.push("/recipes");
            router.refresh();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Impossible de supprimer la recette.");
            setDeleting(false);
        }
    }

    return (
        <div className="flex flex-col items-end gap-1">
            <button
                type="button"
                className="btn-danger text-xs"
                onClick={handleDelete}
                disabled={deleting}
            >
                {deleting ? "Suppression…" : "Supprimer"}
            </button>
            {error ? <span className="max-w-48 text-right text-[0.65rem] text-coral">{error}</span> : null}
        </div>
    );
}
