import { Geist, Geist_Mono, JetBrains_Mono, Montserrat, Plus_Jakarta_Sans, Source_Code_Pro } from "next/font/google";

// Fonty wszystkich wariantów motywu. Który jest używany, decydują tokeny --app-font-* (src/styles).
// Fonty wariantów mają preload: false — przeglądarka pobiera je dopiero, gdy wariant jest aktywny.
// next/font wymaga dosłownych wartości w każdym wywołaniu (bez wspólnej zmiennej).

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin", "latin-ext"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin", "latin-ext"] });
const plusJakartaSans = Plus_Jakarta_Sans({ variable: "--font-plus-jakarta-sans", subsets: ["latin", "latin-ext"], preload: false });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin", "latin-ext"], preload: false });
const montserrat = Montserrat({ variable: "--font-montserrat", subsets: ["latin", "latin-ext"], preload: false });
const sourceCodePro = Source_Code_Pro({ variable: "--font-source-code-pro", subsets: ["latin", "latin-ext"], preload: false });

/** Klasy do nałożenia na <html>: rejestrują zmienne CSS wszystkich fontów. */
export const fontVariables = [geistSans, geistMono, plusJakartaSans, jetbrainsMono, montserrat, sourceCodePro]
  .map((font) => font.variable)
  .join(" ");
