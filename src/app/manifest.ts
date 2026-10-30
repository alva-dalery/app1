import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "Prix Nouméa",
        short_name: "Prix Nouméa",
        description:
            "Comparez les prix des supermarchés de Nouméa et calculez le coût de vos recettes.",
        start_url: "/",
        display: "standalone",
        background_color: "#fdfaf4",
        theme_color: "#0f766e",
        lang: "fr",
        orientation: "portrait",
        icons: [
            {
                src: "/icon.svg",
                sizes: "any",
                type: "image/svg+xml",
                purpose: "any",
            },
        ],
    };
}
