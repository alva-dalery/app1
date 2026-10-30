"use client";

import { useEffect } from "react";

export default function AppError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("[app] erreur de rendu", error);
    }, [error]);

    return (
        <div className="page-shell pb-10 pt-10 sm:pt-16">
            <div className="card-strong mx-auto max-w-xl p-6 sm:p-8">
                <p className="eyebrow">Erreur inattendue</p>
                <h1 className="section-title mt-2">Cette page n'a pas pu être chargée.</h1>
                <p className="mt-3 text-sm leading-relaxed text-ink/65">
                    Le calcul n'a pas abouti côté serveur. Vos données restent intactes : réessayez, puis
                    revenez à l'accueil si le problème persiste.
                </p>

                {error.digest ? (
                    <p className="mt-4 rounded-xl border border-ink/10 bg-white/60 px-3 py-2 font-mono text-[0.7rem] text-ink/45">
                        référence : {error.digest}
                    </p>
                ) : null}

                <div className="mt-6 flex flex-wrap gap-3">
                    <button type="button" onClick={reset} className="btn-primary">
                        Réessayer
                    </button>
                    <a href="/" className="btn-secondary">
                        Retour à l'accueil
                    </a>
                </div>
            </div>
        </div>
    );
}
