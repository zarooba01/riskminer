/** Ustawienia Storybooka wspólne dla wszystkich piaskownic — identyczne z głównym Storybookiem. */
export const appName = "Hacknation App";

export const viewportOptions = {
  telefon: { name: "Telefon", styles: { width: "390px", height: "844px" }, type: "mobile" },
  tablet: { name: "Tablet", styles: { width: "820px", height: "1180px" }, type: "tablet" },
  desktop: { name: "Desktop", styles: { width: "1440px", height: "900px" }, type: "desktop" },
} as const;

/** Wariant historii na telefonie: `export const Telefon = { ...phone }`. */
export const phone = { globals: { viewport: { value: "telefon", isRotated: false } } } as const;

/** Nazwy motywów — takie same jak w głównym Storybooku. */
export const LIGHT = "Jasny";
export const DARK = "Ciemny";
