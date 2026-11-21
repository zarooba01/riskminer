-- Tryb oceny nowej inwestycji: deterministyczna (reguły i obliczenia) albo AI (model dobiera przypadki z bazy porównawczej
-- i formułuje ryzyka oraz zalecenia; liczby — mediany, przedziały, n — liczone z danych wybranych przypadków).
alter table public.rm_assessments add column if not exists mode text not null default 'deterministic';
alter table public.rm_assessments drop constraint if exists rm_assessments_mode_check;
alter table public.rm_assessments add constraint rm_assessments_mode_check check (mode in ('deterministic', 'ai'));
-- Oceny, w których wcześniej użyto modelu (krok „Uzupełnij wnioski AI”), oznaczamy jako AI.
update public.rm_assessments set mode = 'ai' where llm_run_id is not null and mode = 'deterministic';
