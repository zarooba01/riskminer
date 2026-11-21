import path from "node:path";

import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/vite";

const root = path.resolve(import.meta.dirname, "../../..");

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.tsx"],
  addons: ["@storybook/addon-a11y", "@storybook/addon-themes"],
  framework: "@storybook/react-vite",
  viteFinal: async (viteConfig) => {
    // HeroUI 3 to klasy Tailwind 4 — własna kompilacja, niezależna od stylów aplikacji.
    viteConfig.plugins = [...(viteConfig.plugins ?? []), tailwindcss()];
    viteConfig.resolve ??= {};
    viteConfig.resolve.alias = {
      ...viteConfig.resolve.alias,
      // Te same dane przykładowe co w aplikacji — bez kopiowania.
      "@sample-data": path.join(root, "src/lib/sample-data.ts"),
      "@shared": path.join(root, "design-systems/shared"),
    };
    return viteConfig;
  },
};

export default config;
