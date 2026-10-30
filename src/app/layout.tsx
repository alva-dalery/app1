import type { Metadata, Viewport } from "next";
import { AppHeader } from "@/components/AppHeader";
import { StoreProvider } from "@/components/StoreProvider";
import "./globals.css";

export const viewport: Viewport = {
    themeColor: "#0f766e",
    width: "device-width",
    initialScale: 1,
};

export const metadata: Metadata = {
    title: {
        default: "Prix Nouméa — comparateur de courses",
        template: "%s · Prix Nouméa",
    },
    manifest: "/manifest.webmanifest",
    description:
        "Comparez les prix des supermarchés de Nouméa et calculez le coût réel de vos recettes avec les données prix.nc.",
    applicationName: "Prix Nouméa",
    keywords: ["Nouméa", "prix", "supermarché", "recette", "comparateur", "Nouvelle-Calédonie"],
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="fr">
            <body>
                <StoreProvider>
                    <AppHeader />
                    <main className="min-h-[calc(100vh-4rem)]">{children}</main>
                    <footer className="mt-16 border-t border-ink/8 py-8">
                        <div className="page-shell flex flex-col gap-3 text-xs text-ink/55 sm:flex-row sm:items-center sm:justify-between">
                            <p>
                                Prix indicatifs issus de la source publique{" "}
                                <a
                                    className="font-semibold text-lagoon-dark underline decoration-lagoon/30 underline-offset-4"
                                    href="https://prix.nc"
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    prix.nc
                                </a>
                                . Vérifiez le prix en magasin avant achat.
                            </p>
                            <p>Application locale · Franc pacifique (XPF) · Données non contractuelles.</p>
                        </div>
                    </footer>
                </StoreProvider>
            </body>
        </html>
    );
}
