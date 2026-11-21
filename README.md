# Risk Miner — inteligentna baza doświadczeń inwestycji publicznych

Prototyp na wyzwanie MFiPR (HackNation 2026), pilotaż: sektor wodno-kanalizacyjny.
System z pliku XLSX i publicznych ogłoszeń BZP buduje bazę przypadków:
**projekt → postępowanie → ogłoszenia → umowa (z podziałem na części) → zmiany umowy → zdarzenia ryzyka**.
Każdy rekord i każdy wniosek prowadzi do źródła, a każda propozycja (dopasowanie, zdarzenie, kategoria) czeka na decyzję eksperta.

## Co działa, a co jest zaprojektowane

| Obszar | Stan |
|---|---|
| Import XLSX organizatora (walidacja NIP, podsektory wg słownika eksperckiego, wartości z adnotacji KPO) | działa |
| Wzbogacenie z BZP: numer ogłoszenia → OCID → wynik, zmiany, wykonanie umowy; rekordy KPO wyszukiwane po NIP z oceną pewności; zapasowe wyszukiwanie przy błędnym numerze | działa |
| Odtworzenie umowy z ogłoszeń (wartość, termin, wypłata, zmiany art. 455), zamówienia w częściach, korekty ogłoszeń | działa |
| Odchylenia kosztu i czasu (obliczenia deterministyczne, oznaczone jako „Obliczenie”) | działa |
| Zdarzenia ryzyka z reguł (koszt 0, cytat dosłowny ze źródła) | działa |
| Zdarzenia ryzyka z modelu AI (katalog R01–R15, cytat weryfikowany w źródle, propozycje nowych kategorii) | działa (wymaga AI Gateway) |
| Panel eksperta: zatwierdź / popraw / odrzuć / wzorcowy przykład, decyzje dopasowań, katalog, historia decyzji | działa |
| Porównanie modeli: koszt, czas, poprawność schematu, cytaty, precyzja i czułość względem decyzji eksperta | działa |
| Eksport CSV/JSON każdej encji | działa |
| Hasło witryny (`SITE_PASSWORD`) | działa |
| Analiza nowej inwestycji (podobne projekty, przedziały odchyleń, flagi, zapisy umowne) | następny krok |
| Upload DOCX/PDF, TED, KIO, NIK, monitoring trwających inwestycji (cron) | zaprojektowane |

## Architektura

```
XLSX ──► import ──► rm_projects
                       │
BZP API (kopia bzp.cytr.us / ezamowienia.gov.pl)
   ContractNotice ──(numer BZP / NIP+nazwa)──► rm_procurements (pewność, podstawa dopasowania)
   TenderResult / AgreementUpdate / ContractPerforming ──(OCID)──► rm_notices + rm_sources (link, data pobrania, treść)
                       │ parser formularzy (bez AI)
                       ▼
               rm_contracts (część N) ── rm_contract_changes
                       │ reguły (słowa kluczowe katalogu)     │ model AI (AI Gateway, model z env)
                       ▼                                       ▼
                    rm_risk_events (status: do weryfikacji) ◄── rm_llm_runs (koszt, czas, wynik, cache)
                       │ panel eksperta
                       ▼
                    rm_decisions (historia) · wzorcowe przykłady → kolejne prompty
```

- Next.js 16 (App Router) + Tailwind 4 + shadcn/ui, Vercel.
- Supabase Postgres: tabele `rm_*` (migracje w `supabase/migrations`), RLS włączone, dostęp tylko po stronie serwera.
- Vercel AI SDK + AI Gateway: model jako `dostawca/model` w zmiennej `LLM_MODEL`. Żadnego SDK konkretnego dostawcy w kodzie.

### Łączenie rekordów
1. **Numer ogłoszenia BZP** z pliku (normalizacja zapisu) + weryfikacja NIP zamawiającego → pewność 100%, auto-akceptacja.
2. **Rekord KPO bez numeru**: ogłoszenia w województwie zamawiającego, filtr po NIP (API BZP nie filtruje po NIP), podobieństwo nazwy, CPV, wzmianka o KPO → pewność 55–95%, do decyzji eksperta. Alternatywy pokazywane tylko, gdy wynik jest niejednoznaczny.
3. **Ogłoszenia powiązane** po identyfikatorze postępowania (OCID `tenderId`) — wynik, zmiany, wykonanie umowy.
4. **Zamówienia w częściach**: osobna umowa na część; ogłoszenie o wykonaniu przypisane do części po wartości umowy. Rekord „część N” korzysta ze swojej części.

## Model językowy: konfiguracja, koszt, miejsce przetwarzania

| Zmienna | Znaczenie |
|---|---|
| `LLM_MODEL` | model produkcyjny, np. `anthropic/claude-haiku-5.5` |
| `LLM_COMPARE_MODELS` | lista modeli do porównania |
| `AI_GATEWAY_API_KEY` | tylko lokalnie / poza Vercel (na Vercel działa OIDC) |
| `LLM_MAX_INPUT_CHARS`, `LLM_MAX_COMPARE_USD` | kontrola kosztu |

Do modelu trafiają wyłącznie publiczne ogłoszenia BZP (tylko sekcje o przebiegu umowy). Region przetwarzania zależy od dostawcy (pokazany przy każdym modelu na ekranie „Modele”): Mistral — UE; Anthropic, OpenAI — USA; Google — USA/UE; DeepSeek, Alibaba — poza UE. Do pracy na dokumentach niepublicznych: wybrać model z UE albo lokalny (dostawca zgodny z OpenAI) — zmiana konfiguracji.

**Koszt jednego nowego przetargu** (paczka ~80 tys. tokenów; reguły i statystyka bez AI, LLM tylko na ~25% tekstu): 0,003 USD (qwen3.7-flash) – 0,011 USD (claude-haiku-5.5) – 0,22 USD (claude-sonnet-5.5). Wzbogacenie 22 projektów kosztuje 0 USD (bez AI), analiza AI 22 projektów ≈ 0,05 USD. Każde wywołanie jest zapisywane z kosztem w `rm_llm_runs` i cache'owane.

## Uruchomienie

```bash
npm install
cp .env.example .env.local          # uzupełnij Supabase i (lokalnie) AI_GATEWAY_API_KEY
psql "$POSTGRES_URL_NON_POOLING" -f supabase/migrations/0002_riskminer.sql
psql "$POSTGRES_URL_NON_POOLING" -f supabase/migrations/0003_contract_parts.sql
npm run dev                         # http://localhost:3000 → Pulpit → Importuj → Wzbogać wszystkie
```

API do automatyzacji (te same operacje co w interfejsie, powtarzalne):

| Metoda | Ścieżka | Działanie |
|---|---|---|
| POST | `/api/import` | import zestawu organizatora (lub pliku `file`, multipart) |
| POST | `/api/projects/<id>/enrich` | wzbogacenie z BZP |
| POST | `/api/projects/<id>/analyze?model=…` | analiza ryzyk modelem |
| GET | `/api/export/<encja>?format=csv\|json[&project=…]` | eksport: projects, procurements, notices, contracts, changes, events, catalog, sources, llm_runs, decisions |

## Deploy na Vercel

`vercel.json` buduje samą aplikację. Zmienne środowiskowe: jak w `.env.example` (bez `AI_GATEWAY_API_KEY` — OIDC), w tym `SITE_PASSWORD`.
Bez kont użytkowników witrynę chroni hasło: `src/proxy.ts` przekierowuje na `/haslo` i ustawia ciasteczko HttpOnly (skrót SHA-256 hasła).

## Polecenia

| Polecenie | Co robi |
|---|---|
| `npm run dev` / `npm run storybook` | praca lokalna |
| `npm run lint` / `npm run typecheck` | kontrola kodu |
| `npm run build` | Storybook + aplikacja |
| `npm run test:e2e` | testy Playwright na buildzie |

## Struktura

```
src/lib/ingest      import XLSX, klient BZP, wzbogacenie i łączenie
src/lib/rm          model danych (typy), parser ogłoszeń, reguły, zapytania, server actions, eksport
src/lib/llm         konfiguracja modeli, cennik, runTask (zapis + cache), porównanie, zadanie risk-events
src/components/rm   wspólne elementy: pochodzenie danych, źródło, karta zdarzenia
src/components/screens  ekrany (dane przez propsy) + historie w src/stories
src/app/(app)       pulpit, projekty, weryfikacja, modele, eksport
src/app/api         import, wzbogacenie, analiza, eksport
supabase/migrations model danych rm_*
design-systems/     piaskownice HeroUI, MUI, Fluent UI do wyboru kierunku wizualnego
```

## Licencje i usługi

Kod: własny. Biblioteki: Next.js (MIT), React (MIT), shadcn/ui + Radix (MIT), Tailwind (MIT), Vercel AI SDK (Apache-2.0), exceljs (MIT), zod (MIT), supabase-js (MIT), Playwright (Apache-2.0).
Usługi: Vercel (hosting, AI Gateway), Supabase (Postgres). Dane: BZP / e-Zamówienia (publiczne), plik organizatora.
