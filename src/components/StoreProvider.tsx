"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import type { Store } from "@/lib/prixnc/types";

const STORAGE_KEY = "prix-noumea:selected-stores";

interface StoreContextValue {
    selectedStores: Store[];
    hydrated: boolean;
    isSelected: (storeId: string) => boolean;
    toggleStore: (store: Store) => void;
    setStores: (stores: Store[]) => void;
    toggleAll: (stores: Store[]) => void;
    clearStores: () => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

function sanitizeStores(value: unknown): Store[] {
    if (!Array.isArray(value)) return [];
    return value
        .filter(
            (entry): entry is Store =>
                Boolean(entry) &&
                typeof entry === "object" &&
                typeof (entry as Store).id === "string" &&
                typeof (entry as Store).label === "string",
        )
        .map((entry) => ({
            id: entry.id,
            label: entry.label,
            commune: entry.commune ?? "Nouméa",
            type: entry.type ?? null,
            province: entry.province,
            latitude: entry.latitude,
            longitude: entry.longitude,
        }));
}

/**
 * Aucune limite sur le nombre de magasins : une sélection vide signifie
 * « tous les magasins », et la sélection sert uniquement de filtre.
 */
export function StoreProvider({ children }: { children: ReactNode }) {
    const [selectedStores, setSelectedStores] = useState<Store[]>([]);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            if (raw) {
                setSelectedStores(sanitizeStores(JSON.parse(raw)));
            }
        } catch {
            // Le stockage local peut être indisponible en navigation privée.
        } finally {
            setHydrated(true);
        }
    }, []);

    useEffect(() => {
        if (!hydrated) return;
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedStores));
        } catch {
            // Stockage indisponible : la sélection reste en mémoire.
        }
    }, [selectedStores, hydrated]);

    const toggleStore = useCallback((store: Store) => {
        setSelectedStores((current) =>
            current.some((item) => item.id === store.id)
                ? current.filter((item) => item.id !== store.id)
                : [...current, store],
        );
    }, []);

    const setStores = useCallback((stores: Store[]) => {
        setSelectedStores(sanitizeStores(stores));
    }, []);

    /** Sélectionne tous les magasins disponibles, ou vide la sélection si elle est déjà complète. */
    const toggleAll = useCallback((stores: Store[]) => {
        const all = sanitizeStores(stores);
        setSelectedStores((current) => (current.length > 0 ? [] : all));
    }, []);

    const clearStores = useCallback(() => setSelectedStores([]), []);

    const value = useMemo<StoreContextValue>(
        () => ({
            selectedStores,
            hydrated,
            isSelected: (storeId: string) => selectedStores.some((store) => store.id === storeId),
            toggleStore,
            setStores,
            toggleAll,
            clearStores,
        }),
        [selectedStores, hydrated, toggleStore, setStores, toggleAll, clearStores],
    );

    return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStores(): StoreContextValue {
    const context = useContext(StoreContext);
    if (!context) {
        throw new Error("useStores doit être utilisé dans StoreProvider.");
    }
    return context;
}
