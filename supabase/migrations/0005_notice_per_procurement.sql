-- Ten sam przetarg (i jego ogłoszenia) może być powiązany z kilkoma projektami (np. różne części, korekta
-- dopasowania). Ogłoszenie jest więc unikalne w obrębie postępowania projektu, a nie w całej bazie.
alter table public.rm_notices drop constraint if exists rm_notices_notice_number_key;
create unique index if not exists rm_notices_procurement_notice on public.rm_notices (procurement_id, notice_number);
