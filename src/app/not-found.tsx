import Link from "next/link";

export default function NotFound() {
    return (
        <div className="page-shell flex min-h-[60vh] flex-col items-center justify-center py-16 text-center">
            <span className="badge badge-sand">404</span>
            <h1 className="section-title mt-4">Cette page n'existe pas.</h1>
            <p className="mt-2 max-w-md text-sm text-ink/60">
                La recette ou la page demandée est introuvable. Revenez à l'accueil pour continuer vos
                comparaisons.
            </p>
            <Link href="/" className="btn-primary mt-6">
                Retour à l'accueil
            </Link>
        </div>
    );
}
