-- Stały klucz zdarzeń proponowanych przez reguły (np. "delay", "change:<id>"): ponowne wzbogacenie
-- aktualizuje istniejące propozycje w miejscu, zamiast usuwać i tworzyć je z nowymi identyfikatorami.
alter table public.rm_risk_events add column if not exists rule_key text;
create unique index if not exists rm_risk_events_rule_key on public.rm_risk_events (contract_id, rule_key) where rule_key is not null;
