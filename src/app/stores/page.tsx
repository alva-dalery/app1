import type { Metadata } from "next";
import { StoreDirectory } from "@/components/StoreDirectory";
import { getNoumeaStores } from "@/lib/prixnc/client";
import type { Store } from "@/lib/prixnc/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Magasins",
    description: "Comparez tous les supermarchés de Nouméa, puis filtrez ceux qui vous intéressent.",
};

export default async function StoresPage() {
    let stores: Store[] = [];
    let error: string | null = null;

    try {
        stores = await getNoumeaStores();
    } catch (caught) {
        error = caught instanceof Error ? caught.message : "Impossible de charger les magasins.";
    }

    return (
        <div className="page-shell pb-10 pt-8 sm:pt-12">
            <div className="max-w-3xl">
                <p className="eyebrow">Votre panier</p>
                <h1 className="section-title mt-2">Choisissez vos magasins.</h1>
                <p className="mt-3 text-sm leading-relaxed text-ink/60 sm:text-base">
                    Sans sélection, tous les magasins sont comparés. Cochez-en autant que vous voulez pour filtrer
                    votre panier et répartir vos achats au meilleur prix. Les commerces spécialisés sont inclus
                    lorsqu'ils proposent des produits alimentaires.
                </p>
            </div>

            {error ? (
                <div className="card mt-6 border-coral/20 bg-coral/10 p-5 text-sm text-ink/70">
                    <p className="font-bold text-ink">La liste des magasins est indisponible.</p>
                    <p className="mt-1">{error}</p>
                    <p className="mt-2 text-xs">
                        Vérifiez votre connexion ou réessayez dans quelques instants. L'API prix.nc reste la
                        source de référence.
                    </p>
                </div>
            ) : null}

            <div className="mt-7">
                <StoreDirectory stores={stores} />
            </div>
        </div>
    );
}
