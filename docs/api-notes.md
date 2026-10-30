# Notes d'intégration — API prix.nc

Spécification récupérée depuis `https://prix.nc/api/v1/v3/api-docs` et conservée dans `docs/openapi.json`.

## Informations générales

| Élément | Valeur |
|---|---|
| URL de base | `https://prix.nc/api/v1` |
| OpenAPI | 3.0.1 |
| Serveur | Spring Boot / springdoc-openapi |
| Authentification | Aucun `securityScheme` déclaré au moment de l'intégration |
| Format | JSON HAL (`application/hal+json`) pour la plupart des collections |
| Commune de Nouméa | `idCommune=1` |
| Devise | XPF, entiers sans décimales |

Le client [`src/lib/prixnc/client.ts`](../src/lib/prixnc/client.ts) prévoit tout de même une clé optionnelle (`PRIXNC_API_KEY` et `PRIXNC_AUTH_HEADER`) afin de pouvoir s'adapter si prix.nc active une authentification.

## Endpoints utilisés

### Magasins de Nouméa

```http
GET /magasins/search/findByIdCommuneIgnoreCaseOrderByLabelAsc?idCommune=1
```

Réponse : collection HAL `_embedded.magasins`.

Champs utiles :

- `label`
- `commune`
- `province`
- `typeCommerce`
- `latitude`, `longitude`
- identifiant dans `_links.self.href` (dernier segment UUID)

Particularités :

- L'endpoint renvoie environ 131 commerces pour Nouméa.
- Certains commerces ont `typeCommerce` à `null`.
- Les types alimentaires retenus sont `Grande surface`, `Moyenne surface`, `Petite surface` et `Grande surface spécialisée`. Les types `null` sont conservés car des enseignes comme Discount Trianon ou Magenta Discount n'ont pas de type renseigné.
- Les boucheries, stations-service, garages et autres commerces spécialisés sont exclus de la liste principale.

### Recherche de produits

```http
GET /produitsprix/search?nom=riz&communeIds=1&page=0&size=20
```

Réponse : `_embedded.produitsprix`.

Champs utiles :

- `idProduit` : UUID du produit
- `nom`
- `marque`
- `gencod`
- `secteurConso`, `sousSecteurConso`
- `meilleurPrix` : meilleur prix connu à Nouméa
- `meilleurPrixParUnite`
- `uniteLabel`, `uniteLabelCourt`
- `promotion`
- `score`, `rank`

Particularités :

- La recherche est fuzzy et peut renvoyer des produits non alimentaires.
- Le champ `alimentaire` vaut souvent `false`, même pour des produits alimentaires : il ne faut pas l'utiliser comme filtre.
- Les recherches sont paginées avec `page` et `size`.
- Le client filtre les rayons non alimentaires à partir de `secteurConso` et `sousSecteurConso`.

### Prix par produit et par magasin

```http
GET /relevesprix/search/findByIdProduitInAndIdMagasinIn?produitIds=ID1,ID2&magasinIds=STORE1,STORE2
```

Réponse : collection HAL `_embedded.produitComparaisons` (lue de façon générique côté client).

Champs utiles :

- `idProduit`
- `nom`
- `prix` : prix du conditionnement
- `prixParUnite` : prix au kilogramme, litre ou unité
- `uniteLabel`, `uniteLabelCourt`
- `promotion`
- `dateReleve` : timestamp epoch en millisecondes
- `idMagasin`, `magasin`

Les listes `produitIds` et `magasinIds` acceptent des valeurs séparées par des virgules. Les paramètres répétés fonctionnent également.

### Tous les prix d'un produit à Nouméa

```http
GET /relevesprix/search/findByIdProduitAndIdCommuneInOrderByPrixParUniteAsc?idProduit=ID&idCommune=1
```

Utile pour afficher la comparaison d'un produit dans tous les magasins de Nouméa.

### Comparaison de panier

```http
GET /paniers/comparaison?produitIds=ID1,ID2&quantites=1,2&magasinIds=STORE1,STORE2
```

Réponse : `_embedded.panierCompares[0]`.

Structure :

```json
{
  "magasins": [{ "id": "...", "label": "...", "idCommune": "1" }],
  "produitsCompares": [
    {
      "idProduit": "...",
      "nomProduit": "...",
      "quantite": 1,
      "montantsMagasins": [
        { "idMagasin": "...", "labelMagasin": "...", "dateReleve": 1793019600000, "montant": 102, "meilleurMontant": true }
      ]
    }
  ],
  "totauxMagasins": [
    { "idMagasin": "...", "montantTotal": 102, "nbRelevesManquants": 0, "meilleurMontantTotal": true }
  ]
}
```

Particularités :

- L'endpoint exige au moins deux magasins.
- `quantites` correspond à un nombre de conditionnements, pas à un poids en grammes.
- L'application calcule elle-même les quantités en packs à partir des prix unitaires et des noms de produits, puis peut utiliser cet endpoint comme contrôle.
- Un magasin sans relevé est compté dans `nbRelevesManquants`.

## Interprétation des prix

- `prix` est le prix du pack tel que relevé.
- `prixParUnite` est le prix au kilogramme, litre ou unité.
- La taille du pack peut être déduite par `prix / prixParUnite`, puis convertie dans l'unité de base.
- Quand `prixParUnite` est absent, le client tente de lire le format dans le nom du produit (`1 kg`, `500 g`, `2 l`, `400 ml`, `6 œufs`, etc.).
- Les produits dont le nom contient `paquet`, `sachet`, `boîte`, `conserve`, `bouteille`, etc. sont traités comme conditionnés.
- Les produits frais vendus au poids sont calculés au prorata, sans arrondi au pack.

## Cache et limites

- Les appels passent par le serveur Next.js avec un cache de 6 heures par défaut (`PRIXNC_CACHE_TTL_SECONDS`).
- Les magasins sont mis en cache 12 heures.
- Une clé API optionnelle est supportée mais non nécessaire actuellement.
- Il convient de respecter les conditions d'utilisation de prix.nc et de limiter les appels massifs.

## Exemples de vérification

```bash
curl "https://prix.nc/api/v1/magasins/search/findByIdCommuneIgnoreCaseOrderByLabelAsc?idCommune=1" | head
curl "https://prix.nc/api/v1/produitsprix/search?nom=riz&communeIds=1&page=0&size=5"
curl "https://prix.nc/api/v1/relevesprix/search/findByIdProduitInAndIdMagasinIn?produitIds=51854363-b869-4ba2-a5f9-3a35cdb955e1&magasinIds=7658e4aa-bdaa-48bd-805b-c492fa4530a5,425abb91-e832-44d7-9592-75a903879983"
```
