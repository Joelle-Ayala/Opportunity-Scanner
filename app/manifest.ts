import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Opportunity Scanner",
    short_name: "Opp Scanner",
    description:
      "Public-sector revenue intelligence from your company website.",
    start_url: "/",
    display: "standalone",
    background_color: "#F6F7F9",
    theme_color: "#14213D",
    icons: [
      {
        src: "/opportunity-scanner-logo.svg",
        sizes: "512x512",
        type: "image/svg+xml"
      }
    ]
  };
}
