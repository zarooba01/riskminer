# Risk Miner — inteligentna baza doświadczeń inwestycji publicznych

Prototyp na wyzwanie MFiPR (HackNation 2026), pilotaż: sektor wodno-kanalizacyjny.

**Wersja online:** https://riskminer-hacknation.vercel.app (chroniona hasłem — hasło przekazuje zespół).
System z pliku XLSX i publicznych ogłoszeń BZP buduje bazę przypadków:
**projekt → postępowanie → ogłoszenia → umowa (z podziałem na części) → zmiany umowy → zdarzenia ryzyka**.
Każdy rekord i każdy wniosek prowadzi do źródła, a każda propozycja (dopasowanie, zdarzenie, kategoria) czeka na decyzję eksperta.

## Co działa, a co jest zaprojektowane

| Obszar | Stan |
|---|---|
| Import XLSX organizatora (walidacja NIP, podsektory wg słownika eksperckiego, wartości z adnotacji KPO) | działa |
| Wzbogacenie z BZP: numer ogłoszenia → OCID → wynik, zmiany, wykonanie umowy; rekordy KPO wyszukiwane po NIP z oceną pewności; zapasowe wyszukiwanie przy błędnym numerze | działa |
| Odtworzenie umowy z ogłoszeń (wartość, termin, wypłata, zmiany art. 455), zamówienia w częściach, korekty ogłoszeń | działa |
| Jedna zmiana umowy = jeden rekord: ta sama zmiana z ogłoszenia o zmianie i o wykonaniu umowy jest scalana (kwota / przyczyna + opis), nowy termin z opisu aneksu | działa |
| Źródła dodatkowe: strona postępowania zamawiającego (platforma zakupowa / BIP, adres z ogłoszenia) — lista dokumentów, odczyt kluczowych PDF i sprawdzenie krzyżowe numeru BZP i wartości umowy; TED (API) | działa |
| Karta „Plan i wykonanie”: wynagrodzenie vs wypłata, pierwotny termin vs zakończenie, stan po aneksach — osobno dla każdej części i każdego zamówienia inwestycji | działa |
| Podgląd źródła w aplikacji z zaznaczonym fragmentem (każde ustalenie, zmiana umowy, kwota i data) + link do oryginału w e-Zamówieniach | działa |
| Jawny „brak danych w źródle”, gdy źródło nie podaje przyczyny albo skutku | działa |
| Raport „co się zmieniło” po ponownym wzbogaceniu, analizie AI albo dodaniu dokumentu (nowe / zmienione: było → jest / usunięte, decyzje eksperta zachowane) | działa |
| Odchylenia kosztu i czasu (obliczenia deterministyczne, oznaczone jako „Obliczenie”) | działa |
| Zdarzenia ryzyka z reguł (koszt 0, cytat dosłowny ze źródła) | działa |
| Zdarzenia ryzyka z modelu AI (katalog R01–R15, cytat weryfikowany w źródle, propozycje nowych kategorii) | działa (wymaga AI Gateway) |
| Panel eksperta: zatwierdź / popraw / odrzuć / wzorcowy przykład, decyzje dopasowań, katalog, historia decyzji | działa |
| Porównanie modeli: koszt, czas, poprawność schematu, cytaty, precyzja i czułość względem decyzji eksperta | działa |
| Eksport CSV/JSON każdej encji | działa |
| Hasło witryny (`SITE_PASSWORD`) | działa |
| **Ocena nowej inwestycji**: opis językiem naturalnym lub dokument PDF/DOCX → podobne zakończone inwestycje z wyjaśnieniem podobieństwa, przedziały odchyleń kosztu i terminu z liczebnością próby i niepewnością, prognoza dla budżetu i terminu, czerwone flagi, ryzyka z cytatami ze źródeł, co sprawdzić przed przetargiem, działania i zapisy umowne (jedna zakładka „Ryzyka i zalecenia”); zapis jako rekordy, filtrowanie, aktualizacja, eksport JSON/CSV | działa (bez AI; opcjonalny krok AI) |
| Wiedza ekspercka do ocen (co sprawdzić / działania / zapisy umowne dla R01–R15) edytowana w katalogu | działa |
| KIO, NIK, monitoring trwających inwestycji (cron), odczyt platform-aplikacji JS (Marketplanet, Logintrade) | zaprojektowane |

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
5. **Kilka zamówień jednej inwestycji**: ekspert dodaje kolejny przetarg („Wskaż inny przetarg” → „Dodaj jako kolejne zamówienie”); karta projektu przełącza zamówienia (`?zamowienie=`).
6. **Zmiany umowy**: ogłoszenie o wykonaniu podaje ponumerowaną listę zmian, a każda mogła mieć wcześniej osobne ogłoszenie o zmianie (bez numeru). Łączymy je po kwocie (do 5% różnicy przy tej samej przyczynie) albo po przyczynie i opisie; głównym źródłem jest ogłoszenie o zmianie (data, pełny opis), pozostałe trafiają do `related_source_ids`.
7. **Źródła dodatkowe** (`src/lib/ingest/external.ts`, tabela `rm_external_checks`): adres strony postępowania z pkt 3.1 ogłoszenia o zamówieniu → lista dokumentów, odczyt PDF (informacja o kwocie, z otwarcia ofert, o wyborze oferty), sprawdzenie numeru BZP, tytułu i wartości umowy; TED — wyszukiwanie po nazwie zamawiającego i podobieństwie tytułu (próg 70%). Wynik „nie znaleziono” też jest zapisywany z podstawą (np. zamówienie poniżej progów UE). Potwierdzenie na stronie zamawiającego dopisujemy do podstawy niepewnego dopasowania.

## Ocena nowej inwestycji (`/assessments/new`, zapisane oceny: `/assessments`)

Urzędnik opisuje plan zwykłym językiem („Chcemy wybudować kanalizację sanitarną w Góraszce, woj. mazowieckie, ok. 3 km, 4 mln zł, 12 miesięcy; znane warunki: kolizje z uzbrojeniem”) i/lub wgrywa do 5 dokumentów PDF/DOCX. Formularz nie ma osobnych pól — parametry odczytujemy z tekstu, a w wyniku można je poprawić (zakładka „Założenia”). Pole „Użyj modelu AI do analizy” (domyślnie wyłączone) przełącza ocenę w tryb AI — wtedy analizy deterministycznej nie ma (pkt 6). Wynik to rekordy w bazie: `rm_assessments`, `rm_assessment_matches` i `rm_assessment_items` (migracja `0008_assessments.sql`).

1. **Parametry** (`src/lib/assess/params.ts`). Pola wpisane przez użytkownika mają pierwszeństwo. Brakujące odczytujemy regułami z opisu i dokumentu: podsektor i rodzaj robót według słownika eksperckiego, długość (km/m/mb/L=), budżet (zł/tys./mln), czas (miesiące, lata, „do końca 2027”), województwo. Każde pole ma pochodzenie: wpisane, odczytane z opisu lub zaproponowane przez model AI.
2. **Podobne przypadki** (`similarity.ts`, `cases.ts`). Korpus to **baza porównawcza** (`/reference`, tabele `rm_ref_cases` i `rm_ref_events`, migracja `0009_reference_base.sql`): sklonowane zakończone projekty z dopasowaniem do BZP, danymi o wykonaniu umowy i zaakceptowanymi zdarzeniami. Akceptacja w kopii jest automatyczna (oznaczenie „Automatyczna akceptacja (dane demo)”), a oryginały w Projektach i Weryfikacji zostają bez zmian, do decyzji eksperta. Budowa (`src/lib/assess/reference.ts`, `POST /api/reference/build`, przycisk „Odbuduj z bazy roboczej”): projektom z samą propozycją dopasowania tymczasowo zatwierdzamy najlepszą propozycję, odtwarzamy umowę i zdarzenia z zapisanych ogłoszeń, kopiujemy, a potem przywracamy oryginał. Projekt bez zdarzeń ryzyka nie wchodzi do bazy. Wynik 0–100 jest ważoną sumą cech: podsektor 35, rodzaj robót 15, zakres 25 (cosinus TF-IDF opisu planu względem tytułu, adnotacji i opisu przedmiotu zamówienia z ogłoszenia BZP; pokazujemy wspólne pojęcia), skala 15 (budżet vs wartość umowy, długość vs długość, w skali logarytmicznej), województwo 10. Cechy, których plan nie podaje, nie wpływają na wynik. Wagi i wielkość próby (3–15) użytkownik zmienia w zakładce „Założenia”. Do statystyki wchodzi top-k przypadków z zatwierdzonym dopasowaniem do BZP i danymi o wykonaniu umowy. Przypadki pominięte są widoczne z powodem.
3. **Statystyka** (`engine.ts`, oznaczenie „Obliczenie”): mediana, P25–P75 i min–maks. dla zmiany kosztu, opóźnienia (dni i % pierwotnego okresu), okresu realizacji, liczby ofert, kosztu 1 km, a także udział umów z aneksem. Każda wartość podaje liczebność (n). Niepewność zależy od n: <5 duża, 5–9 średnia, ≥10 umiarkowana. Prognoza to budżet × (1 + kwartyle odchyleń) i termin × (1 + kwartyle opóźnień). Przy n < 3 nie podajemy przedziałów.
4. **Ryzyka i zalecenia**: zdarzenia `rm_risk_events` z przypadków w próbie (bez odrzuconych) według kodu katalogu. Pokazujemy, w ilu z N umów wystąpiło dane ryzyko (osobno zatwierdzone i do weryfikacji), skutki, przyczyny ze źródeł i cytaty z linkiem do podglądu źródła. Warunki lokalne z opisu (np. „kolizje”, „włączenie”, „uzgodnienia”) wskazują ryzyka „do lokalnego potwierdzenia”. Do każdego ryzyka dochodzą pozycje z katalogu eksperckiego (`rm_risk_catalog.checks/actions/clauses`, edycja w Weryfikacja → Katalog) oraz działania zaradcze zapisane przy zdarzeniach. Flagi są liczone na próbie. Braki w opisie wynikają z poradnika eksperckiego: miejsce włączenia, prawa do terenu, decyzje, liczba przyłączy, warunki gruntowe.
5. **Ekspert** zatwierdza lub odrzuca wnioski modelu AI (`rm_decisions`, encja `assessment_item`); pozycje deterministyczne (obliczenia, katalog ekspercki, zdarzenia ze źródeł) nie wymagają osobnej decyzji. „Zaktualizuj ocenę” przelicza wynik na bieżącej bazie — decyzje zostają (stały klucz pozycji), a ekran pokazuje „co się zmieniło” (próba, mediany, przypadki, ryzyka).
6. **Ocena AI (pole „Użyj modelu AI”; tryb oceny `mode = ai`, migracja `0010_assessment_mode.sql`)** (`src/lib/llm/tasks/assessment-ai.ts`): zamiast analizy deterministycznej jedno wywołanie modelu. Model dostaje opis planu, fragment dokumentów i bazę porównawczą w skrócie (do 3 zdarzeń na przypadek, aliasy E1…En). Odczytuje parametry, wybiera 5–10 podobnych przypadków z powodami i formułuje do 6 ryzyk z rzeczami do sprawdzenia, działaniami i zapisami umownymi oraz kwestie do lokalnego potwierdzenia. Serwer odrzuca przypadki spoza bazy i ryzyka bez odwołania do istniejącego przypadku lub zdarzenia. Mediany, przedziały, n, prognozę i flagi liczymy z danych przypadków wybranych przez model (`summarizeSample` w `engine.ts`). Wnioski modelu czekają na decyzję eksperta. Wywołanie trafia do `rm_llm_runs` (koszt, cache po treści wejścia).

Skalowanie: TF-IDF liczymy w pamięci, co przy setkach przypadków wystarcza. Przy tysiącach wystarczy zamienić cechę „zakres” na embeddingi (pgvector), bez zmiany reszty modelu oceny.

| Metoda | Ścieżka | Działanie |
|---|---|---|
| POST | `/api/assessments` | nowa ocena (multipart: `description` i/lub `file` — do 5 plików; `mode=ai` — ocena AI; dla automatyzacji opcjonalnie `subsector_main`, `works_type`, `province`, `length_km`, `budget_pln`, `duration_months`, `local_conditions`) |
| POST | `/api/assessments/<id>/run` | przeliczenie oceny wg jej trybu (deterministycznie albo modelem AI) |
| GET | `/api/assessments/<id>/export?format=json\|csv[&part=items\|matches]` | cała ocena (JSON) albo pozycje lub przypadki (CSV) |

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
# … i kolejne migracje po kolei, do 0009_reference_base.sql
npm run dev                         # http://localhost:3000 → Pulpit → Importuj → Wzbogać wszystkie
```

API do automatyzacji (te same operacje co w interfejsie, powtarzalne):

| Metoda | Ścieżka | Działanie |
|---|---|---|
| POST | `/api/import` | import zestawu organizatora (lub pliku `file`, multipart) |
| POST | `/api/projects/<id>/enrich` | wzbogacenie z BZP |
| POST | `/api/projects/<id>/analyze?model=…` | analiza ryzyk modelem |
| GET | `/api/export/<encja>?format=csv\|json[&project=…][&assessment=…]` | eksport: projects, procurements, notices, contracts, changes, events, catalog, sources, llm_runs, decisions, documents, findings, external_checks, change_reports, assessments, assessment_matches, assessment_items |

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
src/lib/assess      ocena nowej inwestycji: parametry, przypadki, podobieństwo, statystyka, ryzyka, zapis
src/lib/rm          model danych (typy), parser ogłoszeń, reguły, zapytania, server actions, eksport
src/lib/llm         konfiguracja modeli, cennik, runTask (zapis + cache), zadanie risk-events
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
