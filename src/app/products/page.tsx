import type { Metadata } from "next";
import { ProductSearch } from "@/components/ProductSearch";

export const metadata: Metadata = {
    title: "Produits",
    description: "Comparez le prix d'un produit entre les supermarchés de Nouméa.",
};

export default function ProductsPage() {
    return (
        <div className="page-shell pb-10 pt-8 sm:pt-12">
            <div className="max-w-3xl">
                <p className="eyebrow">Comparaison directe</p>
                <h1 className="section-title mt-2">Un produit, plusieurs magasins.</h1>
                <p className="mt-3 text-sm leading-relaxed text-ink/60 sm:text-base">
                    Recherchez un produit alimentaire et comparez son prix dans les magasins de Nouméa. Le prix
                    unitaire vous aide à comparer les formats, même lorsque les packs sont différents.
                </p>
            </div>

            <div className="mt-7">
                <ProductSearch />
            </div>
        </div>
    );
}
