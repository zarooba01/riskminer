import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components są celowo wyłączone: na hackatonie strony czytające sesję
  // mają działać bez owijania wszystkiego w <Suspense>.
  turbopack: {
    // Repo leży w katalogu z innym package-lock.json — wskazujemy właściwy root.
    root: path.join(__dirname),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async redirects() {
    return [{ source: "/storybook", destination: "/storybook/index.html", permanent: false }];
  },
  // Plik XLSX organizatora dołączamy do funkcji serwerowych (import „zestawu startowego”).
  outputFileTracingIncludes: { "/*": ["./data/**"] },
  experimental: {
    // Import pliku z projektami idzie przez server action (domyślnie maks. 1 MB). 4 MB = poniżej limitu żądania na Vercel (4,5 MB).
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
