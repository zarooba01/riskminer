#!/usr/bin/env bash
# Usuwa WYŁĄCZNIE rekordy demo (RM-TEST-DEMO-*) — projekty użytkownika zostają nietknięte.
# Wspólne źródła BZP (unikalne kind+external_id, współdzielone z oryginałem) zostają.
set -euo pipefail
cd "$(dirname "$0")/.."
URL=$(node -e 'process.loadEnvFile(".env.local");process.stdout.write(process.env.POSTGRES_URL_NON_POOLING)')
psql "$URL" -v ON_ERROR_STOP=1 -q <<'SQL'
begin;
create temp table demo_ids on commit drop as
  select id::text as id from rm_projects where id like 'RM-TEST-DEMO%'
  union select id::text from rm_procurements where project_id like 'RM-TEST-DEMO%'
  union select id::text from rm_risk_events where project_id like 'RM-TEST-DEMO%'
  union select id::text from rm_documents where project_id like 'RM-TEST-DEMO%'
  union select f.id::text from rm_document_findings f where f.project_id like 'RM-TEST-DEMO%'
  union select id::text from rm_assessments where title like 'RM-TEST-DEMO%'
  union select i.id::text from rm_assessment_items i join rm_assessments a on a.id = i.assessment_id where a.title like 'RM-TEST-DEMO%';
create temp table demo_sources on commit drop as
  select source_id from rm_documents where project_id like 'RM-TEST-DEMO%' and source_id is not null;
delete from rm_decisions where entity_id in (select id from demo_ids);
delete from rm_assessments where title like 'RM-TEST-DEMO%';
delete from rm_projects where id like 'RM-TEST-DEMO%';
delete from rm_sources s where s.kind = 'upload' and s.id in (select source_id from demo_sources)
  and not exists (select 1 from rm_documents d where d.source_id = s.id);
delete from rm_sources where kind = 'xlsx' and external_id like 'RM-TEST-demo.xlsx#%';
commit;
select (select count(*) from rm_projects) as projekty_w_bazie,
       (select count(*) from rm_projects where id like 'RM-TEST%') as rekordy_testowe;
SQL
