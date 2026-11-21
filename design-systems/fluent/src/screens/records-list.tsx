import {
  Badge,
  Body1,
  Button,
  Caption1,
  Card,
  SearchBox,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  Title2,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { Add20Regular } from "@fluentui/react-icons";
import { useMemo, useState } from "react";

import type { SampleRecord } from "@sample-data";

import { statusBadge } from "./dashboard";

const useStyles = makeStyles({
  stack: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXL },
  head: { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: tokens.spacingHorizontalL },
  search: { maxWidth: "360px" },
  muted: { color: tokens.colorNeutralForeground3 },
  mono: { fontFamily: tokens.fontFamilyMonospace },
  table: { display: "none", "@media (min-width: 768px)": { display: "block" } },
  cards: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalM, "@media (min-width: 768px)": { display: "none" } },
  cardTop: { display: "flex", justifyContent: "space-between", gap: tokens.spacingHorizontalM },
});

export function RecordsListScreen({ records }: { records: SampleRecord[] }) {
  const styles = useStyles();
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return records;
    return records.filter((record) =>
      [record.id, record.title, record.owner, record.status].some((value) => value.toLowerCase().includes(needle)),
    );
  }, [query, records]);

  return (
    <div className={styles.stack}>
      <div className={styles.head}>
        <div>
          <Title2 as="h1" block>
            Rekordy
          </Title2>
          <Body1 className={styles.muted}>Przykładowa lista — podmień na dane z wyzwania.</Body1>
        </div>
        <Button appearance="primary" icon={<Add20Regular />}>
          Dodaj
        </Button>
      </div>
      <SearchBox
        className={styles.search}
        placeholder="Szukaj…"
        aria-label="Szukaj rekordów"
        value={query}
        onChange={(_, data) => setQuery(data.value)}
      />

      <Card className={styles.table}>
        <Table aria-label="Rekordy">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Numer</TableHeaderCell>
              <TableHeaderCell>Tytuł</TableHeaderCell>
              <TableHeaderCell>Właściciel</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Aktualizacja</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((record) => (
              <TableRow key={record.id}>
                <TableCell className={styles.mono}>{record.id}</TableCell>
                <TableCell>
                  <Text weight="semibold">{record.title}</Text>
                </TableCell>
                <TableCell>{record.owner}</TableCell>
                <TableCell>
                  <Badge {...statusBadge[record.status]}>{record.status}</Badge>
                </TableCell>
                <TableCell>{record.updatedAt}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className={styles.cards}>
        {filtered.map((record) => (
          <Card key={record.id}>
            <div className={styles.cardTop}>
              <Text weight="semibold">{record.title}</Text>
              <Badge {...statusBadge[record.status]}>{record.status}</Badge>
            </div>
            <Caption1 className={styles.muted}>
              {record.id} · {record.owner} · {record.updatedAt}
            </Caption1>
          </Card>
        ))}
      </div>
    </div>
  );
}
