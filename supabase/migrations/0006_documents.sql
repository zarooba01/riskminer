-- Dokumenty dodawane przez eksperta do istniejącej inwestycji (PDF/DOCX) i ustalenia z ich analizy.
create table if not exists public.rm_documents (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.rm_projects (id) on delete cascade,
  contract_id uuid references public.rm_contracts (id) on delete set null,
  source_id uuid references public.rm_sources (id) on delete set null,
  doc_type text not null,
  file_name text not null,
  storage_path text,
  pages integer,
  chars integer,
  status text not null default 'processing' check (status in ('processing', 'analyzed', 'error')),
  summary text,
  error text,
  llm_run_id uuid references public.rm_llm_runs (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rm_document_findings (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.rm_documents (id) on delete cascade,
  project_id text not null references public.rm_projects (id) on delete cascade,
  kind text not null check (kind in ('confirms', 'adds', 'conflicts')),
  topic text not null,
  statement text not null,
  doc_value text,
  current_value text,
  quote text,
  page integer,
  quote_verified boolean,
  confidence numeric check (confidence between 0 and 1),
  status text not null default 'proposed' check (status in ('proposed', 'accepted', 'rejected')),
  risk_event_id uuid references public.rm_risk_events (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rm_documents enable row level security;
alter table public.rm_document_findings enable row level security;

-- Numer strony dokumentu dla zdarzeń wynikających z dokumentów eksperta.
alter table public.rm_risk_events add column if not exists page integer;

-- Prywatny bucket na oryginały plików (dostęp tylko serwerowo, linki podpisane).
insert into storage.buckets (id, name, public) values ('rm-documents', 'rm-documents', false) on conflict (id) do nothing;
