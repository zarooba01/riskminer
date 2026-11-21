// Pobiera motyw z tweakcn.com i zapisuje go jako wariant design systemu.
// Użycie: npm run theme:add -- <nazwa>   (np. northern-lights, nature; nazwy jak w adresie tweakcn)
// Potem: dopisz wariant w src/lib/themes.ts, import w src/app/globals.css i font w src/lib/fonts.ts.
import { writeFile } from "node:fs/promises";

const name = process.argv[2];
if (!name) {
  console.error("Podaj nazwę motywu, np.: npm run theme:add -- nature");
  process.exit(1);
}

const response = await fetch(`https://tweakcn.com/r/themes/${name}.json`);
if (!response.ok) {
  console.error(`Nie znaleziono motywu "${name}" (HTTP ${response.status}).`);
  process.exit(1);
}
const { cssVars } = await response.json();

const shadows = ["2xs", "xs", "sm", "md", "lg", "xl", "2xl"];
const fontVariable = (stack) => {
  const family = stack.split(",")[0].trim().replace(/["']/g, "");
  return `--font-${family.toLowerCase().replace(/\s+/g, "-")}`;
};

function block(vars) {
  const lines = [];
  for (const [key, value] of Object.entries(vars)) {
    // Kolory i promień przechodzą bez zmian; resztę mapujemy na tokeny --app-*.
    if (/^(font|shadow|tracking|spacing|letter)/.test(key)) continue;
    lines.push(`  --${key}: ${value};`);
  }
  for (const kind of ["sans", "mono"]) {
    const stack = vars[`font-${kind}`];
    if (stack) lines.push(`  --app-font-${kind}: var(${fontVariable(stack)}), ${stack};`);
  }
  if (vars.shadow) lines.push(`  --app-shadow-sm: ${vars["shadow-sm"] ?? vars.shadow};`);
  for (const size of shadows.filter((item) => item !== "sm")) {
    if (vars[`shadow-${size}`]) lines.push(`  --app-shadow-${size}: ${vars[`shadow-${size}`]};`);
  }
  return lines.join("\n");
}

const css = `/* Wariant "${name}" — wygenerowany z https://tweakcn.com/r/themes/${name}.json (npm run theme:add -- ${name}). */
[data-theme="${name}"] {
${block(cssVars.light)}
}

[data-theme="${name}"].dark,
.dark [data-theme="${name}"] {
${block(cssVars.dark)}
}
`;

await writeFile(`src/styles/themes/${name}.css`, css);

const fonts = ["sans", "mono"].map((kind) => cssVars.light[`font-${kind}`]).filter(Boolean);
console.log(`Zapisano src/styles/themes/${name}.css`);
console.log(`Fonty do zarejestrowania w src/lib/fonts.ts: ${fonts.map((stack) => `${stack.split(",")[0]} → ${fontVariable(stack)}`).join("; ")}`);
