-- Zamówienia w częściach: jedna umowa na każdą część postępowania (część 0 = zamówienie bez podziału).
alter table public.rm_contracts add column if not exists part_no integer not null default 0;
alter table public.rm_contracts add column if not exists part_title text;
alter table public.rm_contracts drop constraint if exists rm_contracts_procurement_id_key;
create unique index if not exists rm_contracts_procurement_part on public.rm_contracts (procurement_id, part_no);
