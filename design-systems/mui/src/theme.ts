import { createTheme } from "@mui/material/styles";

// Domyślny motyw Material Design — celowo bez dostosowań, żeby pokazać charakter systemu.
// Kolor przewodni i kształt zmienia się tutaj (palette.primary, shape.borderRadius).
export const lightTheme = createTheme({ palette: { mode: "light" } });
export const darkTheme = createTheme({ palette: { mode: "dark" } });
