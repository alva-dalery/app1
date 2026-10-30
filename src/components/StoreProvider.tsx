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
const DEFAULT_STORE_LABELS = ["AUCHAN QUAI FERRY", "GEANT SAINTE-MARIE"];

interface StoreContextValue {
    selectedStores: Store[];
    hydrated: boolean;
    canAdd: boolean;
    isSelected: (storeId: string) => boolean;
    toggleStore: (store: Store) => void;
    setStores: (stores: Store[]) => void;
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
        .slice(0, 2)
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

export function StoreProvider({ children }: { children: ReactNode }) {
    const [selectedStores, setSelectedStores] = useState<Store[]>([]);
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        let cancelled = false;

        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            if (raw) {
                setSelectedStores(sanitizeStores(JSON.parse(raw)));
                setHydrated(true);
                return () => {
                    cancelled = true;
                };
            }
        } catch {
            // Le stockage local peut être indisponible en navigation privée.
        }

        fetch("/api/stores")
            .then((response) => (response.ok ? response.json() : null))
            .then((payload: { stores?: Store[] } | null) => {
                if (cancelled) return;
                const stores = sanitizeStores(payload?.stores ?? []);
                if (stores.length === 0) return;

                const preferred = DEFAULT_STORE_LABELS.map((label) =>
                    stores.find((store) => store.label.toUpperCase() === label),
                ).filter((store): store is Store => Boolean(store));

                const defaults = preferred.length > 0 ? preferred : stores;
                setSelectedStores(defaults.slice(0, 2));
            })
            .catch(() => {
                // L'utilisateur pourra sélectionner ses magasins manuellement.
            })
            .finally(() => {
                if (!cancelled) setHydrated(true);
            });

        return () => {
            cancelled = true;
        };
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
        setSelectedStores((current) => {
            if (current.some((item) => item.id === store.id)) {
                return current.filter((item) => item.id !== store.id);
            }
            if (current.length >= 2) {
                return [current[1], store];
            }
            return [...current, store];
        });
    }, []);

    const setStores = useCallback((stores: Store[]) => {
        setSelectedStores(sanitizeStores(stores));
    }, []);

    const clearStores = useCallback(() => setSelectedStores([]), []);

    const value = useMemo<StoreContextValue>(
        () => ({
            selectedStores,
            hydrated,
            canAdd: selectedStores.length < 2,
            isSelected: (storeId: string) => selectedStores.some((store) => store.id === storeId),
            toggleStore,
            setStores,
            clearStores,
        }),
        [selectedStores, hydrated, toggleStore, setStores, clearStores],
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
