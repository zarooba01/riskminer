import { FluentProvider, webDarkTheme, webLightTheme } from "@fluentui/react-components";
import { withThemeFromJSXProvider } from "@storybook/addon-themes";
import type { Preview } from "@storybook/react-vite";

import { DARK, LIGHT, viewportOptions } from "@shared/storybook";

import "../src/reset.css";

const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    viewport: { options: viewportOptions },
    // Storybook analizuje storySort statycznie — musi być wpisany dosłownie w tym pliku.
    options: { storySort: { order: ["Przegląd", "Makiety"] } },
    a11y: { test: "todo" },
  },
  decorators: [
    // Motyw zmienia się tutaj: webLightTheme/webDarkTheme albo własny z createLightTheme(brand).
    withThemeFromJSXProvider({
      themes: { [LIGHT]: webLightTheme, [DARK]: webDarkTheme },
      defaultTheme: LIGHT,
      Provider: FluentProvider,
    }),
  ],
};

export default preview;
