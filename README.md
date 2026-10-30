# Prix Nouméa

Application web de comparaison de prix entre les supermarchés de Nouméa, basée sur les données publiques de [prix.nc](https://prix.nc).

L'utilisateur choisit une recette, sélectionne un ou deux magasins, puis obtient :

- le coût du panier complet dans chaque magasin ;
- le coût réellement consommé par la recette ;
- la répartition optimisée des ingrédients entre deux magasins ;
- les produits manquants et les économies réalisées ;
- le détail ingrédient par ingrédient, en francs pacifique (XPF).

## Fonctionnalités

- Sélection de 1 ou 2 magasins parmi les commerces alimentaires de Nouméa.
- Recherche de produits avec prix best-effort et prix unitaire.
- Recettes pré-remplies et création de recettes personnalisées.
- Correspondance automatique ingrédient → produit, avec possibilité de la modifier manuellement.
- Calcul des packs entiers et du coût consommé au prorata.
- Gestion des promotions, des produits indisponibles et des unités (g, kg, ml, cl, L, unité).
- Interface responsive en français, installable en PWA.
- Données mises en cache côté serveur, sans exposer la clé API au navigateur.

## Stack

- Next.js 16 (App Router), React 19, TypeScript
- Tailwind CSS 4
- SQLite via le module natif `node:sqlite`
- Tests avec le test runner Node et `tsx`
- API prix.nc (OpenAPI 3, sans authentification au moment de l'implémentation)

## Démarrage

Prérequis : Node.js 24 ou supérieur (pour le module stable `node:sqlite`) et npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000).

Sur cette machine, Node.js n'est pas installé globalement. Le binaire local se trouve dans `.tools/node` (ignoré par Git) :

```bash
export PATH="$PWD/.tools/node/bin:$PATH"
npm run dev
```

## Scripts

| Commande | Description |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build de production |
| `npm run start` | Serveur de production |
| `npm run typecheck` | Vérification TypeScript |
| `npm test` | Tests unitaires |
| `npm run db:seed` | Initialise la base et les recettes de démonstration |
| `npm run db:reset` | Supprime la base locale puis la recrée |

## Configuration

Copier `.env.example` vers `.env.local` :

```bash
PRIXNC_BASE_URL=https://prix.nc/api/v1
PRIXNC_API_KEY=
PRIXNC_AUTH_HEADER=Authorization
DATABASE_PATH=./data/app.db
PRIXNC_CACHE_TTL_SECONDS=21600
```

- `PRIXNC_API_KEY` est optionnelle : l'API publique ne demande pas de clé actuellement. Le client sait l'envoyer si prix.nc active une authentification.
- `PRIXNC_AUTH_HEADER` permet d'ajuster le header si nécessaire (`Authorization` ou `X-API-Key`).
- `DATABASE_PATH` accepte un chemin relatif, absolu ou `:memory:` pour les tests.
- La clé n'est jamais préfixée par `NEXT_PUBLIC_` et reste côté serveur.

## Fonctionnement du calcul

Pour chaque ingrédient :

1. L'ingrédient est associé à un produit réel. Les correspondances manuelles sont conservées ; les correspondances automatiques peuvent être réévaluées quand les magasins changent.
2. Les prix sont récupérés pour les magasins sélectionnés.
3. La quantité de recette est convertie en grammes, millilitres ou unités.
4. La taille du conditionnement est déduite du prix, du prix unitaire ou du nom du produit.
5. Le coût d'achat est calculé sur les packs entiers. Le coût consommé est calculé au prorata.
6. Les produits vendus au poids sont calculés sans arrondi au pack.

Deux synthèses sont affichées :

- **Meilleur magasin unique** : uniquement si un magasin couvre tous les ingrédients obligatoires. Sinon, le meilleur total partiel est signalé comme tel.
- **Panier optimisé** : chaque ingrédient est acheté dans le magasin où il coûte le moins cher. L'économie est comparée au meilleur magasin complet.

## Correspondance ingrédient → produit

Les recettes utilisent des ingrédients génériques (« tomate », « riz », « lait de coco »). prix.nc référence des produits précis avec leur marque, leur format et leur prix.

Le moteur :

- recherche les produits correspondant au libellé ;
- écarte les rayons non alimentaires ;
- privilégie les produits disponibles dans les magasins sélectionnés ;
- choisit le produit le plus pertinent et le moins coûteux à acheter pour la quantité nécessaire ;
- enregistre la correspondance ;
- permet de la remplacer manuellement depuis la page recette.

## Base de données

SQLite est initialisé automatiquement dans `data/app.db` au premier accès.

Tables principales :

- `recipes`
- `recipe_ingredients`
- `ingredient_mappings`
- `canonical_ingredients`
- `app_meta`

La base contient trois recettes de démonstration : poulet curry coco, salade de tomates et riz sauté aux légumes.

## Tests

```bash
npm test
```

Les tests couvrent :

- les conversions d'unités et les arrondis de packs ;
- le calcul par magasin et la répartition optimisée ;
- les magasins incomplets et les ingrédients optionnels ;
- les produits vendus au poids ;
- le filtrage des produits non alimentaires et le classement des correspondances.

## Documentation API

Les endpoints utilisés, les formats de réponse et les particularités de prix.nc sont documentés dans [`docs/api-notes.md`](docs/api-notes.md). La spécification OpenAPI est conservée dans [`docs/openapi.json`](docs/openapi.json).

## Déploiement

Le projet est prévu pour un déploiement Node.js avec un système de fichiers persistant pour SQLite.

Pour un hébergement sans disque persistant (Vercel, par exemple), remplacer SQLite par Turso/libSQL ou PostgreSQL. La couche d'accès aux données est isolée dans `src/lib/db`, ce qui limite les changements.

## Limites connues

- Les prix sont indicatifs et peuvent avoir changé depuis le dernier relevé prix.nc.
- La couverture produits dépend des magasins sélectionnés.
- Certaines tailles de packs sont déduites du nom du produit lorsque l'API ne fournit pas de champ structuré.
- Les conversions entre unités et poids sont approximatives et signalées dans l'interface.
- L'application ne gère pas encore les comptes utilisateurs, l'historique des prix ni plus de deux magasins.

## Sources et attribution

Les données de produits, de magasins et de prix proviennent de [prix.nc](https://prix.nc). Vérifiez toujours le prix en magasin avant achat.
