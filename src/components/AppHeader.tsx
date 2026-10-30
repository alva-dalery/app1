"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStores } from "./StoreProvider";

const NAV_ITEMS = [
    { href: "/", label: "Accueil" },
    { href: "/recipes", label: "Recettes" },
    { href: "/products", label: "Produits" },
    { href: "/stores", label: "Magasins" },
];

function BasketIcon() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
            <path
                d="M4 9h16l-1.2 9.2a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8L4 9Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
            />
            <path
                d="M8 9a4 4 0 1 1 8 0"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
            />
        </svg>
    );
}

export function AppHeader() {
    const pathname = usePathname();
    const { selectedStores, hydrated } = useStores();

    return (
        <header className="site-header">
            <div className="page-shell flex h-16 items-center justify-between gap-3">
                <Link href="/" className="flex min-w-0 items-center gap-2.5 font-extrabold tracking-tight">
                    <span className="brand-mark">
                        <BasketIcon />
                    </span>
                    <span className="hidden text-[1.02rem] sm:inline">
                        Prix<span className="text-lagoon"> Nouméa</span>
                    </span>
                </Link>

                <nav aria-label="Navigation principale" className="scroll-x flex items-center gap-1">
                    {NAV_ITEMS.map((item) => {
                        const active =
                            item.href === "/"
                                ? pathname === "/"
                                : pathname === item.href || pathname.startsWith(`${item.href}/`);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className="nav-link"
                                aria-current={active ? "page" : undefined}
                            >
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <Link
                    href="/stores"
                    className="flex shrink-0 items-center gap-2 rounded-full border border-ink/10 bg-white/70 px-3 py-2 text-xs font-bold text-ink/70 transition hover:border-lagoon/30 hover:text-lagoon-dark"
                    title="Magasins sélectionnés"
                >
                    <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-lagoon/30" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-lagoon" />
                    </span>
                    <span className="hidden sm:inline">
                        {hydrated ? selectedStores.length : 0}/2 magasin
                        {(hydrated ? selectedStores.length : 0) > 1 ? "s" : ""}
                    </span>
                    <span className="sm:hidden">{hydrated ? selectedStores.length : 0}/2</span>
                </Link>
            </div>
        </header>
    );
}
