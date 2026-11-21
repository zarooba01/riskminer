# Piaskownice design systemów

Trzy alternatywy dla shadcn/ui, każda w osobnym pakiecie z własnym Storybookiem. Służą do **porównania**
przed wyborem kierunku — aplikacja (`src/`) z nich nie korzysta i nie może z nich importować.

| Katalog | System | Port (dev) | Adres po deployu |
|---|---|---|---|
| `heroui/` | HeroUI 3 (React Aria + Tailwind 4) | 6007 | `/storybook/ds/heroui` |
| `mui/` | MUI 9 (Material Design) | 6008 | `/storybook/ds/mui` |
| `fluent/` | Fluent UI 9 (Microsoft) | 6009 | `/storybook/ds/fluent` |

Każdy pakiet zawiera ten sam zestaw, na tych samych danych (`src/lib/sample-data.ts`):
**Przegląd** (podstawowe komponenty) oraz **Makiety**: Logowanie, Strona bazowa, Pulpit, Lista —
każda także na telefonie.

## Uruchamianie

```bash
npm run storybook:all                       # główny Storybook + trzy piaskownice, wspólne menu na :6006
npm run storybook -w @hacknation/ds-mui     # tylko jedna piaskownica
```

`npm run build` buduje je do `public/storybook/ds/<nazwa>`; główny Storybook pokazuje je w menu bocznym
(konfiguracja `refs` w `.storybook/main.ts`).

## Motyw ciemny

Przełącznik Jasny/Ciemny w głównym Storybooku **nie działa na piaskownice** — Storybook nie przekazuje
ustawień paska narzędzi do dołączonych Storybooków. We wspólnym menu piaskownice są więc zawsze w motywie jasnym.
Żeby zobaczyć tryb ciemny, otwórz piaskownicę bezpośrednio (ikona globusa przy jej nazwie w menu albo adres
z tabeli wyżej) i użyj jej własnego przełącznika.

## Struktura pakietu

```
<system>/
  .storybook/preview.tsx   provider i motyw jasny/ciemny danego systemu
  src/theme.ts | styles.css  miejsce na dostosowanie motywu
  src/overview.stories.tsx Przegląd
  src/screens/             login, base-layout, dashboard, records-list
  src/screens.stories.tsx  Makiety
shared/                    viewporty i stałe wspólne dla piaskownic
```

## Usunięcie odrzuconego systemu

1. `rm -rf design-systems/<nazwa>`
2. usuń wpis z `designSystems` w `.storybook/main.ts` i ze skryptu `storybook:all` w `package.json`
3. `npm install`

## Dodanie kolejnego

Skopiuj `mui/` jako wzorzec, zmień nazwę pakietu, port i katalog wyjściowy w `package.json`,
podmień zależności i provider w `.storybook/preview.tsx`, dopisz wpis w `.storybook/main.ts`.

## Po wyborze

Przeniesienie wybranego systemu do aplikacji to osobne zadanie: wymiana `src/components/ui`,
powłoki (`src/components/layout`) i ekranów (`src/components/screens`).
