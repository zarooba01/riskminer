-- Baza porównawcza do oceny nowych inwestycji: sklonowana, spójna lista ZAKOŃCZONYCH projektów z zaakceptowanymi
-- zdarzeniami ryzyka. Oryginalne rekordy (rm_projects, rm_procurements, rm_contracts, rm_risk_events) zostają bez zmian
-- (nadal „do weryfikacji” w panelu eksperta). Ocena nowej inwestycji korzysta wyłącznie z tych tabel.

create table if not exists public.rm_ref_cases (
  project_id text primary key references public.rm_projects (id) on delete cascade,
  title text not null,
  beneficiary_name text,
  city text,
  province text,
  subsector_main text,
  subsectors_extra text[] not null default '{}',
  works_type text,
  project_value numeric,
  status text,
  -- liczby z umów (brutto, z ogłoszeń BZP) i obliczenia
  value numeric,
  paid numeric,
  cost_deviation_pct numeric,
  months numeric,
  delay_days integer,
  offers integer,
  value_changes integer not null default 0,
  term_changes integer not null default 0,
  length_m numeric,
  text text not null default '',          -- tytuł + adnotacja + opis przedmiotu zamówienia (do podobieństwa treści)
  notice_source_id uuid references public.rm_sources (id) on delete set null,
  bzp_number text,
  match_confidence numeric,
  match_origin text not null check (match_origin in ('accepted', 'auto')), -- zatwierdzone wcześniej / zaakceptowane automatycznie przy klonowaniu
  accepted_by text not null default 'Automatyczna akceptacja (dane demo)',
  snapshot_at timestamptz not null default now()
);

create table if not exists public.rm_ref_events (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.rm_ref_cases (project_id) on delete cascade,
  source_event_id uuid, -- zdarzenie w oryginale (może już nie istnieć, jeśli powstało tylko na potrzeby klonu)
  risk_code text not null,
  title text not null,
  cause text,
  impact text,
  mitigation text,
  quote text,
  source_id uuid references public.rm_sources (id) on delete set null,
  cost_pln numeric,
  delay_days integer,
  quote_verified boolean,
  origin text not null,
  status text not null default 'accepted' check (status in ('accepted')),
  accepted_by text not null default 'Automatyczna akceptacja (dane demo)',
  created_at timestamptz not null default now()
);
create index if not exists rm_ref_events_project on public.rm_ref_events (project_id);

alter table public.rm_ref_cases enable row level security;
alter table public.rm_ref_events enable row level security;
