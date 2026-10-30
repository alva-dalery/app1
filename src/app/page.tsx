import Link from "next/link";
import { RecipeCard } from "@/components/RecipeCard";
import { StoreSelector } from "@/components/StoreSelector";
import { listRecipes } from "@/lib/db/repository";
import { getNoumeaStores } from "@/lib/prixnc/client";
import type { Store } from "@/lib/prixnc/types";

export const dynamic = "force-dynamic";

const STEPS = [
    {
        number: "01",
        title: "Choisissez une recette",
        description:
            "Partez d'une recette prête ou créez la vôtre avec les ingrédients et les quantités exactes.",
    },
    {
        number: "02",
        title: "Sélectionnez 1 ou 2 magasins",
        description:
            "Comparez le panier complet dans un magasin, ou répartissez les achats entre deux enseignes.",
    },
    {
        number: "03",
        title: "Obtenez le coût réel",
        description:
            "Prix des packs, coût consommé, ingrédients manquants et économies réalisées, en francs pacifique.",
    },
];

export default async function HomePage() {
    const recipes = listRecipes();

    let stores: Store[] = [];
    let apiError = false;

    try {
        stores = await getNoumeaStores();
    } catch {
        apiError = true;
    }

    const groceryCount = stores.length;

    return (
        <div className="page-shell pb-10 pt-8 sm:pt-12">
            <section className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
                <div className="pt-2">
                    <div className="inline-flex items-center gap-2 rounded-full border border-lagoon/15 bg-white/65 px-3 py-1.5 text-xs font-bold text-lagoon-dark">
                        <span className="h-1.5 w-1.5 rounded-full bg-lagoon" />
                        Nouméa · données prix.nc
                    </div>

                    <h1 className="hero-title mt-5 max-w-2xl text-ink">
                        Faites vos courses
                        <span className="block text-lagoon">au juste prix.</span>
                    </h1>

                    <p className="mt-5 max-w-xl text-base leading-relaxed text-ink/65 sm:text-lg">
                        Comparez les supermarchés de Nouméa, calculez le coût réel de vos recettes et découvrez
                        où chaque ingrédient vous coûte le moins cher. Un ou deux magasins, zéro mauvaise
                        surprise.
                    </p>

                    <div className="mt-7 flex flex-wrap gap-3">
                        <Link href="/recipes" className="btn-primary">
                            Calculer une recette
                            <span aria-hidden="true">→</span>
                        </Link>
                        <Link href="/products" className="btn-secondary">
                            Comparer un produit
                        </Link>
                    </div>

                    <dl className="mt-9 grid max-w-xl grid-cols-3 gap-3">
                        <div className="card p-4">
                            <dt className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-ink/45">
                                Recettes
                            </dt>
                            <dd className="mt-1 text-2xl font-extrabold">{recipes.length}</dd>
                        </div>
                        <div className="card p-4">
                            <dt className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-ink/45">
                                Magasins
                            </dt>
                            <dd className="mt-1 text-2xl font-extrabold">{apiError ? "—" : groceryCount}</dd>
                        </div>
                        <div className="card p-4">
                            <dt className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-ink/45">
                                Devise
                            </dt>
                            <dd className="mt-1 text-2xl font-extrabold">XPF</dd>
                        </div>
                    </dl>
                </div>

                <div className="card-strong p-5 sm:p-6">
                    <StoreSelector stores={stores} compact limit={8} />
                    {apiError ? (
                        <p className="mt-4 rounded-2xl border border-coral/20 bg-coral/10 px-4 py-3 text-xs leading-relaxed text-ink/65">
                            La liste des magasins n'a pas pu être chargée pour le moment. Réessayez dans
                            quelques instants ou ouvrez la page Magasins.
                        </p>
                    ) : null}
                </div>
            </section>

            <section className="mt-16">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="eyebrow">Mode d'emploi</p>
                        <h2 className="section-title mt-2">Trois étapes, un panier malin.</h2>
                    </div>
                    <p className="max-w-md text-sm leading-relaxed text-ink/55">
                        Le calcul tient compte des tailles de packs, des promotions et des produits réellement
                        disponibles dans chaque magasin.
                    </p>
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-3">
                    {STEPS.map((step) => (
                        <article key={step.number} className="card p-5">
                            <span className="text-xs font-black tracking-[0.16em] text-coral">{step.number}</span>
                            <h3 className="mt-3 text-lg font-extrabold tracking-tight">{step.title}</h3>
                            <p className="mt-2 text-sm leading-relaxed text-ink/60">{step.description}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section className="mt-16">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="eyebrow">À table</p>
                        <h2 className="section-title mt-2">Recettes à comparer maintenant.</h2>
                    </div>
                    <Link href="/recipes" className="text-sm font-bold text-lagoon-dark hover:underline">
                        Toutes les recettes →
                    </Link>
                </div>

                {recipes.length > 0 ? (
                    <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {recipes.slice(0, 6).map((recipe) => (
                            <RecipeCard key={recipe.id} recipe={recipe} />
                        ))}
                    </div>
                ) : (
                    <div className="card mt-6 p-6">
                        <p className="text-sm text-ink/60">
                            Aucune recette pour le moment. Créez votre première recette pour comparer les prix.
                        </p>
                        <Link href="/recipes/new" className="btn-primary mt-4">
                            Créer une recette
                        </Link>
                    </div>
                )}
            </section>

            <section className="mt-16 overflow-hidden rounded-[2rem] bg-ink px-6 py-8 text-white sm:px-10 sm:py-10">
                <div className="grid items-center gap-6 lg:grid-cols-[1fr_auto]">
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/55">
                            Le bon réflexe
                        </p>
                        <h2 className="mt-2 max-w-2xl text-2xl font-extrabold tracking-tight sm:text-3xl">
                            Le prix affiché n'est pas toujours le prix du panier.
                        </h2>
                        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/65">
                            Un pack de 5 kg peut être moins cher au kilo mais plus cher à l'achat. Prix Nouméa
                            affiche les deux : le coût d'achat des packs entiers et la valeur réellement
                            consommée par la recette.
                        </p>
                    </div>
                    <Link
                        href="/stores"
                        className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-extrabold text-ink transition hover:bg-sand"
                    >
                        Choisir mes magasins
                        <span aria-hidden="true">→</span>
                    </Link>
                </div>
            </section>
        </div>
    );
}
