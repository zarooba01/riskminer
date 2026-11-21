/**
 * Warianty design systemu. Każdy (poza domyślnym) to plik w src/styles/themes
 * wygenerowany przez `npm run theme:add -- <nazwa>` z motywu tweakcn.com.
 */
export const themes = [
  { id: "default", label: "Domyślny" },
  { id: "northern-lights", label: "Northern Lights" },
  { id: "nature", label: "Nature" },
] as const;

export type ThemeId = (typeof themes)[number]["id"];

const requested = process.env.NEXT_PUBLIC_THEME;

/** Wariant aktywny w aplikacji: NEXT_PUBLIC_THEME albo domyślny. */
export const activeTheme: ThemeId = themes.some((theme) => theme.id === requested)
  ? (requested as ThemeId)
  : "default";
