import { Button, Card, Chip, SearchField, Table } from "@heroui/react";
import { PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";

import type { SampleRecord } from "@sample-data";

import { statusChip } from "./dashboard";

export function RecordsListScreen({ records }: { records: SampleRecord[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return records;
    return records.filter((record) =>
      [record.id, record.title, record.owner, record.status].some((value) => value.toLowerCase().includes(needle)),
    );
  }, [query, records]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Rekordy</h1>
          <p className="mt-1 text-sm text-muted">Przykładowa lista — podmień na dane z wyzwania.</p>
        </div>
        <Button variant="primary">
          <PlusIcon className="size-4" /> Dodaj
        </Button>
      </div>
      <SearchField name="records-search" aria-label="Szukaj rekordów" value={query} onChange={setQuery} className="max-w-sm">
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input placeholder="Szukaj…" />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>

      <div className="hidden md:block">
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Rekordy">
              <Table.Header>
                <Table.Column>Numer</Table.Column>
                <Table.Column isRowHeader>Tytuł</Table.Column>
                <Table.Column>Właściciel</Table.Column>
                <Table.Column>Status</Table.Column>
                <Table.Column>Aktualizacja</Table.Column>
              </Table.Header>
              <Table.Body>
                {filtered.map((record) => (
                  <Table.Row key={record.id} id={record.id}>
                    <Table.Cell className="font-mono text-xs">{record.id}</Table.Cell>
                    <Table.Cell className="font-medium">{record.title}</Table.Cell>
                    <Table.Cell>{record.owner}</Table.Cell>
                    <Table.Cell>
                      <Chip size="sm" {...statusChip[record.status]}>
                        {record.status}
                      </Chip>
                    </Table.Cell>
                    <Table.Cell className="tabular-nums">{record.updatedAt}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {filtered.map((record) => (
          <li key={record.id}>
            <Card>
              <Card.Content className="gap-2">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-medium">{record.title}</span>
                  <Chip size="sm" {...statusChip[record.status]}>
                    {record.status}
                  </Chip>
                </div>
                <p className="text-xs text-muted">
                  {record.id} · {record.owner} · {record.updatedAt}
                </p>
              </Card.Content>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
