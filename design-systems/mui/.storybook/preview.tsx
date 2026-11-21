import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { withThemeFromJSXProvider } from "@storybook/addon-themes";
import type { Preview } from "@storybook/react-vite";

import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";

import { DARK, LIGHT, viewportOptions } from "@shared/storybook";

import { darkTheme, lightTheme } from "../src/theme";

const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    viewport: { options: viewportOptions },
    // Storybook analizuje storySort statycznie — musi być wpisany dosłownie w tym pliku.
    options: { storySort: { order: ["Przegląd", "Makiety"] } },
    a11y: { test: "todo" },
  },
  decorators: [
    withThemeFromJSXProvider({
      themes: { [LIGHT]: lightTheme, [DARK]: darkTheme },
      defaultTheme: LIGHT,
      Provider: ThemeProvider,
      GlobalStyles: CssBaseline,
    }),
  ],
};

export default preview;
