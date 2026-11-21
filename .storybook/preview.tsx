import type { Preview } from "@storybook/nextjs-vite";
import { withThemeByClassName } from "@storybook/addon-themes";
import { useEffect } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";
import { fontVariables } from "@/lib/fonts";
import { activeTheme, themes } from "@/lib/themes";
import "../src/app/globals.css";

const preview: Preview = {
  // Przełącznik wariantu design systemu na pasku narzędzi (obok motywu jasny/ciemny).
  globalTypes: {
    wariant: {
      description: "Wariant design systemu",
      toolbar: {
        title: "Wariant",
        icon: "paintbrush",
        items: themes.map((theme) => ({ value: theme.id, title: theme.label })),
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { wariant: activeTheme },
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    nextjs: { appDirectory: true },
    viewport: {
      options: {
        telefon: { name: "Telefon", styles: { width: "390px", height: "844px" }, type: "mobile" },
        tablet: { name: "Tablet", styles: { width: "820px", height: "1180px" }, type: "tablet" },
        desktop: { name: "Desktop", styles: { width: "1440px", height: "900px" }, type: "desktop" },
      },
    },
    options: {
      storySort: {
        order: ["Start", "Fundamenty", "design", "ui", "Komponenty", "Wzorce", "Makiety"],
      },
    },
    a11y: { test: "todo" },
  },
  decorators: [
    withThemeByClassName({
      themes: { Jasny: "", Ciemny: "dark" },
      defaultTheme: "Jasny",
    }),
    (Story, context) => {
      const variant = context.globals.wariant as string;
      useEffect(() => {
        document.documentElement.classList.add(...fontVariables.split(" "), "antialiased");
      }, []);
      useEffect(() => {
        document.documentElement.dataset.theme = variant;
      }, [variant]);
      return (
        <TooltipProvider>
          <Story />
        </TooltipProvider>
      );
    },
  ],
};

export default preview;
