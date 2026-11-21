-- 1) Zmiany umowy: jedna zmiana = jeden rekord, choć występuje w kilku ogłoszeniach (o zmianie i o wykonaniu umowy).
--    Główne źródło w source_id, pozostałe ogłoszenia z tą samą zmianą w related_source_ids.
--    new_end_date — nowy termin wykonania odczytany z opisu zmiany (np. „wydłużony do dnia 26.05.2026 r.”).
alter table public.rm_contract_changes add column if not exists related_source_ids uuid[] not null default '{}';
alter table public.rm_contract_changes add column if not exists new_end_date date;

-- 2) Dodatkowe źródła poza BZP: strona postępowania zamawiającego (platforma zakupowa / BIP) i TED.
alter table public.rm_sources drop constraint if exists rm_sources_kind_check;
alter table public.rm_sources add constraint rm_sources_kind_check
  check (kind in ('xlsx', 'bzp', 'upload', 'manual', 'platform', 'ted'));

-- Publiczny podgląd ogłoszenia w e-Zamówieniach zamiast adresu API kopii BZP.
update public.rm_sources
set url = 'https://ezamowienia.gov.pl/mo-client-board/bzp/notice-details/id/' || (raw ->> 'objectId')
where kind = 'bzp' and raw ? 'objectId' and (url is null or url not like 'https://ezamowienia.gov.pl/%');

-- Wynik sprawdzenia każdego źródła dodatkowego dla projektu (znaleziono / brak / błąd) z podstawą dopasowania.
create table if not exists public.rm_external_checks (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.rm_projects (id) on delete cascade,
  source text not null check (source in ('platform', 'ted')),
  status text not null check (status in ('found', 'not_found', 'error', 'skipped')),
  url text,
  title text,
  confidence numeric,
  basis text[] not null default '{}',
  details jsonb not null default '{}',
  source_id uuid references public.rm_sources (id) on delete set null,
  checked_at timestamptz not null default now(),
  unique (project_id, source)
);

-- 3) Raport „co się zmieniło” po każdym ponownym wzbogaceniu / analizie / dodaniu dokumentu.
create table if not exists public.rm_change_reports (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.rm_projects (id) on delete cascade,
  trigger text not null,
  summary jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists rm_change_reports_project on public.rm_change_reports (project_id, created_at desc);

-- Dostęp wyłącznie po stronie serwera (jak pozostałe tabele rm_*): RLS bez polityk dla anon/authenticated.
alter table public.rm_external_checks enable row level security;
alter table public.rm_change_reports enable row level security;
