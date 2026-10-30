export interface HalLink {
    href?: string;
}

export interface HalLinks {
    self?: HalLink;
    [key: string]: HalLink | undefined;
}

export interface HalCollection<T> {
    _embedded?: Record<string, T[]>;
    _links?: HalLinks;
    page?: {
        size?: number;
        totalElements?: number;
        totalPages?: number;
        number?: number;
    };
}

export interface PrixNcStoreRaw {
    id?: string;
    label?: string;
    idCommune?: string;
    commune?: string;
    province?: string;
    zoneGeo?: string;
    longitude?: number;
    latitude?: number;
    idTypeCommerce?: string;
    typeCommerce?: string;
    _links?: HalLinks;
}

export interface PrixNcProductPriceRaw {
    id?: string;
    idProduit?: string;
    nom?: string;
    gencod?: string;
    idMarque?: string;
    marque?: string;
    origine?: string;
    variete?: string;
    idCommune?: string;
    meilleurPrix?: number;
    meilleurPrixParUnite?: number;
    uniteLabel?: string;
    uniteLabelCourt?: string;
    alimentaire?: boolean;
    promotion?: boolean;
    score?: number;
    rank?: number;
    idSecteurConso?: string;
    secteurConso?: string;
    idSsSecteurConso?: string;
    sousSecteurConso?: string;
}

export interface PrixNcPriceRaw {
    idNeolan?: number;
    idProduit?: string;
    nom?: string;
    origine?: string;
    prix?: number;
    prixParUnite?: number;
    uniteLabel?: string;
    uniteLabelCourt?: string;
    promotion?: boolean;
    dateReleve?: number | string;
    idMagasin?: string;
    magasin?: string;
    idCommune?: string;
}

export interface PrixNcBasketRaw {
    magasins?: Array<{
        id?: string;
        label?: string;
        idCommune?: string;
        longitude?: number;
        latitude?: number;
    }>;
    produitsCompares?: Array<{
        idProduit?: string;
        nomProduit?: string;
        quantite?: number;
        montantsMagasins?: Array<{
            idMagasin?: string;
            labelMagasin?: string;
            dateReleve?: number | string;
            montant?: number;
            meilleurMontant?: boolean;
        }>;
    }>;
    totauxMagasins?: Array<{
        idMagasin?: string;
        montantTotal?: number;
        nbRelevesManquants?: number;
        meilleurMontantTotal?: boolean;
    }>;
}

export interface Store {
    id: string;
    label: string;
    commune: string;
    province?: string;
    type: string | null;
    latitude?: number;
    longitude?: number;
}

export interface Product {
    id: string;
    name: string;
    brand?: string;
    gencode?: string;
    category?: string;
    subCategory?: string;
    bestPrice?: number;
    bestUnitPrice?: number;
    unitLabel?: string;
    unitShort?: string;
    promotion?: boolean;
    score?: number;
    rank?: number;
}

export interface PriceOffer {
    productId: string;
    productName: string;
    storeId: string;
    storeLabel: string;
    price: number;
    unitPrice?: number;
    unitLabel?: string;
    unitShort?: string;
    promotion: boolean;
    observedAt?: string;
}

export interface ProductSearchResponse {
    products: Product[];
    page: number;
    size: number;
    total: number;
}
