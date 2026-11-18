import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nikki",
    short_name: "Nikki",
    description: "Personal productivity, knowledge, and organization platform.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#18181b",
  };
}
