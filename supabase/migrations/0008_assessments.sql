-- Ocena nowej inwestycji: opis planu → podobne zakończone inwestycje → statystyka odchyleń → ryzyka i zalecenia.
-- Wynik jest zapisywany jako rekordy (ocena, dopasowane przypadki, pozycje), które można filtrować, aktualizować i eksportować.

-- 1) Wiedza ekspercka w katalogu ryzyk: co sprawdzić przed przetargiem, jakie działania rozważyć, jakie zapisy umowne pomagają.
--    Edytowalna przez eksperta w aplikacji (Weryfikacja → Katalog), bez zmian w kodzie.
alter table public.rm_risk_catalog add column if not exists checks text[] not null default '{}';
alter table public.rm_risk_catalog add column if not exists actions text[] not null default '{}';
alter table public.rm_risk_catalog add column if not exists clauses text[] not null default '{}';

update public.rm_risk_catalog as c set checks = v.checks, actions = v.actions, clauses = v.clauses
from (values
('R01',
  array['Czy OPZ/PFU, dokumentacja projektowa, przedmiar i PPU opisują ten sam zakres (długości, liczba przyłączy, przepompownie, odtworzenie nawierzchni)?','Czy granice zakresu (przyłącza, odtworzenie dróg, włączenie do istniejącej sieci) są jednoznacznie przypisane do tego zadania?'],
  array['Przegląd spójności dokumentów przed publikacją (sprawdzenie krzyżowe OPZ–projekt–przedmiar–PPU).','Uzupełnienie inwentaryzacji przyłączy i lokalizacji odtworzeń nawierzchni przed wyceną.'],
  array['Hierarchia dokumentów w umowie (pierwszeństwo dokumentów w razie sprzeczności).','Procedura robót zamiennych i dodatkowych z wyceną według ustalonych składników cenotwórczych.']),
('R02',
  array['Czy jest aktualna dokumentacja geotechniczna (grunty, poziom wód gruntowych) dla całej trasy?','Czy zinwentaryzowano istniejące uzbrojenie i stan sieci, do których nastąpi włączenie?'],
  array['Odwierty / badania geotechniczne na odcinkach o niepewnych warunkach (tereny podmokłe, przejścia pod ciekami).','Przewidzenie w budżecie rezerwy na odwodnienie wykopów i wymianę gruntu.'],
  array['Zasady rozliczenia odwodnienia wykopów i wymiany gruntu (pozycje obmiarowe lub ryczałt z jasnym zakresem).','Obowiązek niezwłocznego zgłoszenia warunków odmiennych od dokumentacji wraz z procedurą zmiany.']),
('R03',
  array['Czy trasa przebiega po gruntach gminnych / w pasie drogowym, a dla działek prywatnych są zgody lub służebności przesyłu?','Czy rozpoznano kolizje z innymi sieciami (gaz, energetyka, telekomunikacja, drenaże) i są warunki usunięcia kolizji od gestorów?','Czy uzgodniono z zarządcą drogi zajęcie pasa drogowego i zakres odtworzenia nawierzchni?'],
  array['Uzyskanie zgód właścicieli przed ogłoszeniem przetargu albo wydzielenie odcinków bez zgód do późniejszego etapu.','Wystąpienie do gestorów sieci o warunki usunięcia kolizji na etapie projektu.'],
  array['Mechanizm zmiany terminu i trasy, gdy brak dostępu do terenu nie wynika z winy wykonawcy (art. 455 ust. 1 pkt 1 Pzp — zmiana przewidziana w dokumentach).','Termin protokolarnego przekazania terenu budowy z podziałem na odcinki.']),
('R04',
  array['Czy jest prawomocne pozwolenie na budowę / zgłoszenie dla całego zakresu?','Czy potrzebna jest decyzja środowiskowa, pozwolenie wodnoprawne (przekroczenia cieków) lub uzgodnienie konserwatorskie i czy zostały uzyskane?','Czy są warunki techniczne / zgoda operatora na włączenie do istniejącej sieci i przyjęcie ścieków przez oczyszczalnię?'],
  array['Harmonogram uzyskania decyzji przed ogłoszeniem przetargu; postępowanie dopiero po ich uzyskaniu lub z wyraźnym podziałem odpowiedzialności w formule „zaprojektuj i wybuduj”.','Potwierdzenie przepustowości oczyszczalni i punktu włączenia u operatora (pisemne stanowisko z datą).'],
  array['Przesunięcie terminu o czas oczekiwania na decyzje organów, jeżeli wniosek był kompletny i złożony w terminie.','Jasny podział obowiązków: kto występuje o decyzje i uzgodnienia (zamawiający czy wykonawca).']),
('R05',
  array['Czy PPU jednoznacznie rozdziela odpowiedzialność za projekt, uzgodnienia, przyłącza, odtworzenia i rozruch?','Kto jest przyszłym operatorem sieci i czy uczestniczy w odbiorach?'],
  array['Matryca odpowiedzialności (zamawiający / wykonawca / operator / projektant) dołączona do SWZ.','Udział operatora w uzgodnieniach projektowych i odbiorach.'],
  array['Matryca podziału ryzyk jako załącznik do umowy.','Procedura rozstrzygania sporów (np. komisja rozjemcza / mediacja) przed drogą sądową.']),
('R06',
  array['Czy termin realizacji uwzględnia okres zimowy, czas na decyzje i uzgodnienia oraz próby szczelności i odbiory?','Czy termin jest porównywalny z podobnymi zakończonymi umowami (patrz statystyka opóźnień)?'],
  array['Ustalenie terminu na podstawie mediany czasu realizacji i opóźnień w podobnych umowach.','Harmonogram rzeczowo-finansowy z kamieniami milowymi i buforem czasowym.'],
  array['Okoliczności uprawniające do zmiany terminu (warunki atmosferyczne, kolizje, decyzje organów) wskazane w PPU.','Kary umowne powiązane z kamieniami milowymi zamiast wyłącznie z terminem końcowym.']),
('R07',
  array['Jak często w podobnych umowach pojawiały się roboty dodatkowe i zamienne oraz z jakich przyczyn?','Czy budżet przewiduje rezerwę na nieprzewidziane roboty (np. równą górnemu kwartylowi odchyleń kosztu w podobnych umowach)?'],
  array['Rezerwa budżetowa na roboty nieprzewidziane ustalona na podstawie danych z podobnych umów.','Szybka ścieżka decyzyjna dla protokołów konieczności (kto zatwierdza, w jakim terminie).'],
  array['Klauzula zmian przewidzianych (art. 455 ust. 1 pkt 1 Pzp) z opisem rodzajów zmian, warunków i sposobu wyceny.','Zasady wyceny robót dodatkowych według stawek i narzutów z kosztorysu ofertowego.']),
('R08',
  array['Czy forma wynagrodzenia (ryczałt / kosztorys) pasuje do pewności zakresu (np. nieznana liczba przyłączy)?','Czy umowa zawiera klauzulę waloryzacyjną wymaganą przy dłuższych umowach (art. 439 Pzp)?'],
  array['Wynagrodzenie kosztorysowe lub mieszane dla elementów o niepewnej ilości (przyłącza, odtworzenia).','Szacunek wartości zamówienia oparty na aktualnych cenach z podobnych postępowań.'],
  array['Klauzula waloryzacyjna z indeksem (np. wskaźnik cen produkcji budowlano-montażowej GUS) i limitem.','Rozliczenie pozycji o niepewnej ilości według obmiaru i cen jednostkowych.']),
('R09',
  array['Czy wymagania techniczne (materiały rur, przepompownie, sterowanie) są mierzalne i dopuszczają rozwiązania równoważne z kryteriami równoważności?','Czy wymagania są zgodne ze standardami operatora sieci?'],
  array['Uzgodnienie standardów technicznych z operatorem przed publikacją.','Opis kryteriów równoważności dla wskazanych urządzeń i materiałów.'],
  array['Procedura zatwierdzania materiałów i urządzeń (wnioski materiałowe) z terminem odpowiedzi zamawiającego.']),
('R10',
  array['Czy SWZ/PPU opisuje próby szczelności, inspekcję TV kanałów, rozruch przepompowni i dokumentację powykonawczą jako warunek odbioru?','Kto przeprowadza rozruch i szkolenie obsługi?'],
  array['Lista dokumentów odbiorowych i badań (inspekcja TV, próby, geodezja powykonawcza) dołączona do SWZ.'],
  array['Warunki odbioru końcowego i częściowego z wykazem wymaganych badań i dokumentów.','Kary i terminy usuwania wad stwierdzonych przy odbiorze.']),
('R11',
  array['Czy warunki udziału i kryteria nie ograniczają nadmiernie konkurencji (patrz liczba ofert w podobnych postępowaniach)?','Czy dokumentacja odpowiada na typowe pytania wykonawców, by ograniczyć odwołania?'],
  array['Dialog techniczny lub analiza rynku przed publikacją.','Proporcjonalne warunki doświadczenia (np. długość wykonanej sieci zbliżona do zakresu zamówienia).'],
  array['Podział zamówienia na części, jeżeli zwiększy konkurencję i nie utrudni koordynacji.']),
('R12',
  array['Jakie są czasy dostaw kluczowych materiałów i urządzeń (rury, przepompownie, armatura)?','Czy warunki udziału weryfikują potencjał wykonawcy (sprzęt, kadra, sytuacja finansowa)?'],
  array['Weryfikacja potencjału wykonawcy i podwykonawców na etapie oceny ofert.','Monitoring harmonogramu dostaw w trakcie realizacji.'],
  array['Możliwość zmiany materiałów lub urządzeń na równoważne przy braku dostępności (bez zmiany ceny lub z jej obniżeniem).','Obowiązki dotyczące podwykonawców i zapłaty podwykonawcom.']),
('R13',
  array['Czy budżet zadania w WPF / uchwale budżetowej pokrywa wartość z rezerwą na wzrost kosztu (patrz przedział odchyleń w podobnych umowach)?','Czy terminy dofinansowania (KPO, FE) są zgodne z realnym terminem realizacji?'],
  array['Ustalenie kwoty na sfinansowanie z uwzględnieniem górnego kwartyla odchyleń kosztu w podobnych umowach.','Harmonogram płatności zgodny z harmonogramem rozliczeń dofinansowania.'],
  array['Płatności częściowe za odebrane etapy robót.','Zabezpieczenie należytego wykonania i zasady jego zwrotu.']),
('R14',
  array['Czy rozwiązania techniczne (liczba przepompowni, zużycie energii, dostęp serwisowy) zostały uzgodnione z przyszłym operatorem?'],
  array['Ocena kosztów eksploatacji wariantów (grawitacyjny vs ciśnieniowy) na etapie koncepcji.'],
  array['Wymagania dotyczące serwisu gwarancyjnego i dostępności części zamiennych.']),
('R15',
  array['Czy potwierdzono liczbę nieruchomości, które faktycznie przyłączą się do sieci (deklaracje mieszkańców)?','Czy oczyszczalnia przyjmie dodatkowy ładunek ścieków (RLM) i czy sieć zapewni wymagany efekt projektu?'],
  array['Zebranie deklaracji przyłączenia i plan przyłączy, by osiągnąć wskaźniki dofinansowania.','Potwierdzenie przepustowości oczyszczalni u operatora.'],
  array['Obowiązek wykonania przyłączy / studzienek przyłączeniowych w zakresie umowy, jeżeli to warunek efektu projektu.'])
) as v(code, checks, actions, clauses)
where c.code = v.code and c.checks = '{}' and c.actions = '{}' and c.clauses = '{}';

-- 2) Ocena nowej inwestycji.
create table if not exists public.rm_assessments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  params jsonb not null default '{}',        -- podsektor, rodzaj robót, województwo, długość, budżet, termin, warunki, wagi, top_k
  params_origin jsonb not null default '{}', -- pole → input | rule | llm
  document_source_ids uuid[] not null default '{}',
  summary jsonb not null default '{}',       -- statystyki, liczebności, niepewność, poprzednia wersja
  version integer not null default 0,
  llm_run_id uuid references public.rm_llm_runs (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rm_assessment_matches (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.rm_assessments (id) on delete cascade,
  project_id text not null references public.rm_projects (id) on delete cascade,
  rank integer not null,
  score numeric not null,
  components jsonb not null default '[]', -- [{feature, label, weight, value, points, detail}]
  reasons text[] not null default '{}',
  shared_terms text[] not null default '{}',
  comparability text not null check (comparability in ('wysoka', 'średnia', 'niska')),
  included boolean not null default true,  -- uwzględniony w statystyce odchyleń
  excluded_reason text,
  initial_value numeric,
  paid_total numeric,
  cost_deviation_pct numeric,
  initial_months numeric,
  delay_days integer,
  offers_count integer,
  created_at timestamptz not null default now(),
  unique (assessment_id, project_id)
);
create index if not exists rm_assessment_matches_assessment on public.rm_assessment_matches (assessment_id, rank);

create table if not exists public.rm_assessment_items (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.rm_assessments (id) on delete cascade,
  item_key text not null, -- stały klucz pozycji: decyzja eksperta przetrwa aktualizację oceny
  kind text not null check (kind in ('risk', 'check', 'action', 'clause', 'flag', 'gap')),
  risk_code text,
  title text not null,
  body text,
  basis text not null check (basis in ('calc', 'source', 'expert', 'input', 'llm')),
  support jsonb not null default '{}', -- {project_ids, event_ids, examples:[{project_id, event_id, source_id, quote}]}
  n_cases integer,
  n_total integer,
  status text not null default 'proposed' check (status in ('proposed', 'accepted', 'rejected')),
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_id, item_key)
);
create index if not exists rm_assessment_items_assessment on public.rm_assessment_items (assessment_id, sort);

-- Dokumenty do oceny nie należą do żadnego projektu z bazy — rodzaj źródła „assessment”.
alter table public.rm_sources drop constraint if exists rm_sources_kind_check;
alter table public.rm_sources add constraint rm_sources_kind_check
  check (kind in ('xlsx', 'bzp', 'upload', 'manual', 'platform', 'ted', 'assessment'));

-- Dostęp wyłącznie po stronie serwera (jak pozostałe tabele rm_*): RLS bez polityk dla anon/authenticated.
alter table public.rm_assessments enable row level security;
alter table public.rm_assessment_matches enable row level security;
alter table public.rm_assessment_items enable row level security;
