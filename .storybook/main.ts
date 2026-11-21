import type { StorybookConfig } from "@storybook/nextjs-vite";
import tailwindcss from "@tailwindcss/vite";

// Piaskownice innych design systemów (design-systems/*) — osobne Storybooki widoczne w tym samym menu.
const designSystems = [
  { id: "heroui", title: "HeroUI", port: 6007 },
  { id: "mui", title: "MUI (Material)", port: 6008 },
  { id: "fluent", title: "Fluent UI", port: 6009 },
];

const config: StorybookConfig = {
  refs: (_config, { configType }) =>
    Object.fromEntries(
      designSystems.map((system) => [
        system.id,
        {
          title: system.title,
          // Dev: każdy Storybook na własnym porcie (npm run storybook:all). Build: ten sam deploy.
          url: configType === "DEVELOPMENT" ? `http://localhost:${system.port}` : `/storybook/ds/${system.id}`,
        },
      ]),
    ),
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-a11y", "@storybook/addon-docs", "@storybook/addon-themes"],
  framework: "@storybook/nextjs-vite",
  staticDirs: [{ from: "../public/icons", to: "/icons" }],
  // Aplikacja kompiluje Tailwind przez Turbopack; Storybook (Vite) potrzebuje własnej wtyczki.
  viteFinal: async (viteConfig) => {
    viteConfig.plugins = [...(viteConfig.plugins ?? []), tailwindcss()];
    return viteConfig;
  },
};

export default config;
