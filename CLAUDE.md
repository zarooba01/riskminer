@AGENTS.md

# Risk Miner (HackNation 2026, wyzwanie MFiPR)

Opis projektu, architektura, konfiguracja i polecenia: `README.md`.

## Zasady

- Interfejs i komunikaty po polsku; identyfikatory w kodzie po angielsku.
- UI składamy z `src/components/ui` (shadcn). Brakujący komponent dodajemy przez
  `npx shadcn@latest add <nazwa>` razem z historią `@storybook/<nazwa>-story` — nie piszemy własnych odpowiedników.
- Plików w `src/components/ui` nie edytujemy ręcznie (są nadpisywane przez CLI). Wygląd zmieniamy w `src/styles/tokens.css`.
- Ekran = komponent w `src/components/screens` przyjmujący dane przez propsy + cienka strona w `src/app/(app)`
  + historia w `src/stories` (desktop i telefon).
- Każda chroniona strona i server action zaczyna się od `await requireUser()` (`src/lib/auth/session.ts`).
  Konta są na razie wyłączone (`requireUser` zwraca „Ekspert”), dostęp chroni hasło witryny w `src/proxy.ts`.
- Każda nowa tabela: migracja SQL w `supabase/migrations`, RLS włączone. Dopóki nie ma kont: bez polityk
  dla anon/authenticated, dostęp wyłącznie serwerowy przez `db()` (`src/lib/supabase/admin.ts`).
  Po włączeniu kont — polityki na `auth.uid()`.
- Model LLM tylko przez `runTask()` (`src/lib/llm/run.ts`): zapis przebiegu, koszt, cache. Model z env, nie z kodu.
- Każdy wniosek/rekord ma źródło (`rm_sources`) i — jeśli pochodzi z AI lub reguły — status do decyzji eksperta.
- Układ mobile-first: sprawdzaj na szerokości 390 px. Dolny pasek na telefonie pokazuje pierwsze 5 pozycji `navItems`
  (`MOBILE_NAV_LIMIT`); dalsze pozycje są tylko w pasku bocznym na desktopie — najważniejsze umieszczaj na początku listy.
- `design-systems/*` to odseparowane piaskownice innych design systemów (opis: `design-systems/README.md`).
  Kod w `src/` nigdy z nich nie importuje; one mogą importować tylko `src/lib/sample-data.ts`.
- Przed zakończeniem pracy: `npm run lint && npm run typecheck && npm run build && npm run test:e2e`.
