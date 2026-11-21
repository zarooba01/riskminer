-- Risk Miner — model danych: projekt → postępowania → ogłoszenia → umowy → zmiany → zdarzenia ryzyka.
-- Każdy rekord prowadzi do źródła (rm_sources). Decyzje eksperta trafiają do rm_decisions.
--
-- Dostęp: na razie bez kont użytkowników. Aplikacja czyta i zapisuje wyłącznie po stronie serwera
-- kluczem sekretnym (omija RLS). RLS jest włączone bez polityk dla anon/authenticated, więc
-- z przeglądarki (klucz publiczny) tabele są niedostępne. Polityki na auth.uid() dojdą razem z kontami.

create table if not exists public.rm_sources (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('xlsx', 'bzp', 'upload', 'manual')),
  title text not null,
  url text,
  external_id text,
  fetched_at timestamptz not null default now(),
  content_hash text,
  raw jsonb,
  text_content text,
  created_at timestamptz not null default now(),
  unique (kind, external_id)
);

create table if not exists public.rm_projects (
  id text primary key, -- identyfikator rekordu z pliku, np. RM-2026-001
  beneficiary_name text not null,
  beneficiary_nip text,
  province_code text, -- TERYT, np. 02
  province text,
  city text,
  title text not null,
  record_scope text, -- „całe postępowanie” / „część 2”
  public_id_type text, -- „Ogłoszenie BZP” / „Projekt KPO”
  public_id text,
  status text,
  annotation text,
  project_value numeric, -- wartość przedsięwzięcia z adnotacji (PLN)
  co_financing numeric,
  subsector_main text,
  subsectors_extra text[] not null default '{}',
  works_type text, -- budowa/rozbudowa vs przebudowa/modernizacja
  source_id uuid references public.rm_sources (id),
  enriched_at timestamptz,
  enrichment_log jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rm_procurements (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.rm_projects (id) on delete cascade,
  ocid text not null, -- identyfikator postępowania (tenderId), np. ocds-148610-…
  bzp_number text,
  title text,
  buyer_name text,
  buyer_nip text,
  cpv text,
  match_method text not null, -- notice_number | kpo_search | manual
  match_confidence numeric not null check (match_confidence between 0 and 1),
  match_basis jsonb not null default '[]', -- lista cech, które przesądziły o dopasowaniu
  status text not null default 'proposed' check (status in ('proposed', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  unique (project_id, ocid)
);

create table if not exists public.rm_notices (
  id uuid primary key default gen_random_uuid(),
  procurement_id uuid not null references public.rm_procurements (id) on delete cascade,
  notice_type text not null, -- ContractNotice | TenderResultNotice | AgreementUpdateNotice | ContractPerformingNotice
  notice_number text not null unique,
  published_at timestamptz,
  title text,
  parsed jsonb not null default '{}',
  source_id uuid not null references public.rm_sources (id),
  created_at timestamptz not null default now()
);

create table if not exists public.rm_contracts (
  id uuid primary key default gen_random_uuid(),
  procurement_id uuid not null references public.rm_procurements (id) on delete cascade,
  contractor_name text,
  contractor_nip text,
  signed_at date,
  initial_value numeric, -- brutto PLN (wartość umowy)
  initial_months numeric,
  planned_end date, -- obliczone: data zawarcia + okres realizacji
  actual_end date,
  on_time boolean,
  paid_total numeric, -- brutto PLN, z ogłoszenia o wykonaniu umowy
  performed_properly boolean,
  offers_count integer,
  lowest_offer numeric,
  highest_offer numeric,
  cost_deviation_pct numeric, -- obliczone
  delay_days integer, -- obliczone
  source_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (procurement_id)
);

create table if not exists public.rm_contract_changes (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.rm_contracts (id) on delete cascade,
  change_no integer,
  changed_at date,
  legal_basis text, -- np. art. 455 ust. 1 pkt 4
  reason text,
  description text,
  value_change numeric,
  price_increase boolean,
  source_id uuid not null references public.rm_sources (id),
  created_at timestamptz not null default now(),
  unique (contract_id, source_id, change_no)
);

create table if not exists public.rm_risk_catalog (
  code text primary key, -- R01…R15 albo propozycja, np. P-001
  name text not null,
  effects text,
  keywords text[] not null default '{}',
  approved boolean not null default false,
  proposed_by text not null default 'expert', -- expert | llm
  sector text not null default 'wod-kan',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rm_llm_runs (
  id uuid primary key default gen_random_uuid(),
  task text not null,
  model text not null,
  prompt_version text not null,
  input_hash text not null,
  project_id text references public.rm_projects (id) on delete set null,
  output jsonb,
  valid_schema boolean not null default false,
  latency_ms integer,
  tokens_in integer,
  tokens_out integer,
  tokens_cached integer,
  cost_usd numeric,
  cost_source text, -- gateway | pricing
  error text,
  created_at timestamptz not null default now()
);

create index if not exists rm_llm_runs_cache on public.rm_llm_runs (task, model, prompt_version, input_hash);

create table if not exists public.rm_risk_events (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.rm_projects (id) on delete cascade,
  contract_id uuid references public.rm_contracts (id) on delete cascade,
  change_id uuid references public.rm_contract_changes (id) on delete set null,
  risk_code text not null,
  title text not null,
  signal text, -- warunek lub sygnał w dokumentach
  event text, -- co się wydarzyło
  impact text, -- wpływ
  cause text, -- możliwa przyczyna
  mitigation text, -- działania zaradcze / zapisy umowne
  delay_days integer,
  cost_pln numeric,
  quote text, -- fragment źródła uzasadniający wniosek
  source_id uuid references public.rm_sources (id),
  confidence numeric check (confidence between 0 and 1),
  origin text not null check (origin in ('rule', 'llm', 'expert')),
  llm_run_id uuid references public.rm_llm_runs (id) on delete set null,
  quote_verified boolean, -- cytat znaleziony dosłownie w źródle
  status text not null default 'proposed' check (status in ('proposed', 'accepted', 'rejected')),
  exemplary boolean not null default false, -- wzorcowy przykład do few-shot
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rm_decisions (
  id uuid primary key default gen_random_uuid(),
  entity text not null, -- risk_event | procurement | catalog
  entity_id text not null,
  action text not null, -- accept | reject | edit | exemplary
  before jsonb,
  after jsonb,
  comment text,
  actor text not null default 'Ekspert',
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['rm_sources','rm_projects','rm_procurements','rm_notices','rm_contracts',
    'rm_contract_changes','rm_risk_catalog','rm_llm_runs','rm_risk_events','rm_decisions']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Katalog ekspercki R01–R15 (materiał MFiPR), zatwierdzony.
insert into public.rm_risk_catalog (code, name, effects, keywords, approved) values
('R01','Niepełny lub niespójny zakres','Błędna wycena, pominięcie lub dublowanie robót, zmiana zakresu, roboty dodatkowe, roszczenie albo spór o wynagrodzenie.','{zakres,dodatkow,zamienn,pominię,nieujęt,przedmiar,rozbieżn}',true),
('R02','Niedostateczne rozpoznanie stanu istniejącego','Przeprojektowanie, nieprzewidziane roboty, przestoje, wzrost kosztu albo wydłużenie terminu.','{geotechn,grunt,wody gruntowe,inwentaryzac,stan istniejący,niezinwentaryzowan,mur,gruz,kurzawk}',true),
('R03','Kolizje, dostęp do terenu i prawa do nieruchomości','Brak możliwości rozpoczęcia części robót, zmiana trasy lub technologii, wstrzymanie prac albo roszczenia.','{kolizj,właściciel,działk,służebno,przejęci terenu,dostęp do terenu,zgod}',true),
('R04','Decyzje, pozwolenia i uzgodnienia zależne od podmiotów trzecich','Opóźnienie rozpoczęcia lub kontynuacji prac, zmiana warunków realizacji albo brak możliwości użytkowania obiektu.','{pozwoleni,decyzj,uzgodnie,konserwator,archeolog,zarządc,wodnoprawn,zgłoszeni}',true),
('R05','Niejasny lub nieadekwatny podział odpowiedzialności','Luka odpowiedzialności, dublowanie prac, odmowa wykonania, roszczenie i spór o koszt lub termin.','{odpowiedzialno,po stronie zamawiającego,po stronie wykonawcy,spór}',true),
('R06','Nierealistyczny harmonogram i nieuwzględnione zależności','Opóźnienie, kary, kumulacja prac, presja na skrócenie prób i badań albo pogorszenie jakości.','{harmonogram,termin,przedłuż,wydłuż,opóźni,m-cy,miesięc}',true),
('R07','Nieprzewidziane zmiany i roboty dodatkowe','Wstrzymanie robót, negocjacje, aneks, roszczenie, przekroczenie budżetu albo spór o odpowiedzialność.','{roboty dodatkowe,roboty uzupełniające,protokół konieczności,nieprzewidzian,455 ust. 1 pkt 3,455 ust. 1 pkt 4}',true),
('R08','Model wynagrodzenia niedopasowany do niepewności zakresu','Zawyżona rezerwa w cenie albo niedoszacowanie, problemy płynnościowe i spory o zakres objęty wynagrodzeniem.','{ryczałt,kosztorysow,waloryzac,wynagrodzeni}',true),
('R09','Niejednoznaczne lub niemierzalne wymagania techniczne','Niewłaściwy dobór rozwiązania, przeprojektowanie, trudność w potwierdzeniu zgodności, problem z odbiorem.','{równoważn,parametr,wymagani techniczn,zamiana materiał,zmiana technologii}',true),
('R10','Niedookreślone próby, rozruch i odbiór','Wykonane roboty nie mogą zostać odebrane; opóźnia się użytkowanie i rozliczenie; powstaje spór o osiągnięcie parametrów.','{odbiór,rozruch,próby,usterk,wad}',true),
('R11','Postępowanie podatne na odwołanie lub ograniczenie konkurencji','Przedłużenie albo unieważnienie postępowania, słabsza konkurencja, wyższa cena lub wybór rozwiązania nieadekwatnego do potrzeb.','{odwołani,KIO,unieważni,jedna oferta}',true),
('R12','Niewystarczająca zdolność wykonawcy lub łańcucha dostaw','Opóźnienie, zamiana materiałów lub urządzeń, problemy jakościowe i finansowe albo przerwanie realizacji.','{dostaw,materiał,upadło,zmiana wykonawcy,odstąpi,podwykonawc}',true),
('R13','Ryzyko finansowania, budżetu i płatności','Ograniczenie zakresu, opóźnione płatności, utrata dofinansowania, brak środków na niezbędne zmiany albo problemy płynnościowe.','{dofinansowa,środki,budżet,płatno,finansowa}',true),
('R14','Nadmierne koszty eksploatacji i utrzymania','Obiekt spełnia wymagania inwestycyjne, ale jest drogi, trudny lub niestabilny w eksploatacji.','{eksploatac,utrzymani,energochłon}',true),
('R15','Nieosiągnięcie efektu technologicznego, użytkowego lub środowiskowego','Brak wymaganej jakości lub wydajności, ograniczenie użytkowania, konieczność dodatkowych prac, ryzyko sankcji albo utraty efektu projektu.','{efekt,wydajno,parametry oczyszczania,przyłącz,RLM}',true)
on conflict (code) do nothing;
