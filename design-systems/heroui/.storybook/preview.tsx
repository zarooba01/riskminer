import { withThemeByClassName } from "@storybook/addon-themes";
import type { Preview } from "@storybook/react-vite";

import { DARK, LIGHT, viewportOptions } from "@shared/storybook";

import "../src/styles.css";

const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    viewport: { options: viewportOptions },
    // Storybook analizuje storySort statycznie — musi być wpisany dosłownie w tym pliku.
    options: { storySort: { order: ["Przegląd", "Makiety"] } },
    a11y: { test: "todo" },
  },
  decorators: [
    // HeroUI nie wymaga providera; tryb ciemny włącza klasa .dark na <html>.
    withThemeByClassName({ themes: { [LIGHT]: "", [DARK]: "dark" }, defaultTheme: LIGHT }),
    (Story) => (
      <div className="min-h-svh bg-background text-foreground">
        <Story />
      </div>
    ),
  ],
};

export default preview;
