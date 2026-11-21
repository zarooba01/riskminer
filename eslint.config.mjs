import storybook from "eslint-plugin-storybook";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...storybook.configs["flat/recommended"],
  {
    // Kod pobrany z shadcn/ui i rejestru historii: nie poprawiamy go ręcznie,
    // żeby `shadcn add --overwrite` nie tworzył konfliktów.
    files: ["src/components/ui/**", "src/hooks/use-mobile.ts"],
    rules: {
      "react/no-unescaped-entities": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "public/storybook/**", "storybook-static/**"]),
]);

export default eslintConfig;
