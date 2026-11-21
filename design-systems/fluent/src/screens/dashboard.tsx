import { Badge, Body1, Button, Caption1, Card, CardHeader, Subtitle1, Text, Title2, makeStyles, tokens } from "@fluentui/react-components";
import { Add20Regular, ArrowTrending16Regular, ArrowTrendingDown16Regular } from "@fluentui/react-icons";

import type { RecordStatus, SampleRecord } from "@sample-data";

export const statusBadge: Record<RecordStatus, { color: "brand" | "warning" | "informative"; appearance: "filled" | "tint" | "outline" }> = {
  nowe: { color: "brand", appearance: "filled" },
  "w toku": { color: "warning", appearance: "tint" },
  zamknięte: { color: "informative", appearance: "outline" },
};

const useStyles = makeStyles({
  stack: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXL },
  head: { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: tokens.spacingHorizontalL },
  stats: {
    display: "grid",
    gap: tokens.spacingHorizontalL,
    gridTemplateColumns: "repeat(2, 1fr)",
    "@media (min-width: 1024px)": { gridTemplateColumns: "repeat(4, 1fr)" },
  },
  value: { fontSize: tokens.fontSizeHero800, lineHeight: tokens.lineHeightHero800, fontWeight: tokens.fontWeightSemibold },
  trend: { display: "flex", alignItems: "center", gap: tokens.spacingHorizontalXS },
  up: { color: tokens.colorPaletteGreenForeground1 },
  down: { color: tokens.colorPaletteRedForeground1 },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalM,
    padding: `${tokens.spacingVerticalM} 0`,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  rowText: { display: "flex", flexDirection: "column", minWidth: 0 },
  muted: { color: tokens.colorNeutralForeground3 },
});

function Stat({ label, value, change, down }: { label: string; value: string; change?: string; down?: boolean }) {
  const styles = useStyles();
  return (
    <Card>
      <Caption1 className={styles.muted}>{label}</Caption1>
      <Text className={styles.value}>{value}</Text>
      {change && (
        <Caption1 className={`${styles.trend} ${down ? styles.down : styles.up}`}>
          {down ? <ArrowTrendingDown16Regular /> : <ArrowTrending16Regular />}
          {change} m/m
        </Caption1>
      )}
    </Card>
  );
}

export function DashboardScreen({ userName, records }: { userName: string; records: SampleRecord[] }) {
  const styles = useStyles();
  const open = records.filter((record) => record.status !== "zamknięte").length;

  return (
    <div className={styles.stack}>
      <div className={styles.head}>
        <div>
          <Title2 as="h1" block>
            Dzień dobry, {userName}
          </Title2>
          <Body1 className={styles.muted}>Podsumowanie tego, co dzieje się w aplikacji.</Body1>
        </div>
        <Button appearance="primary" icon={<Add20Regular />}>
          Nowy rekord
        </Button>
      </div>
      <div className={styles.stats}>
        <Stat label="Wszystkie" value={String(records.length)} change="+12%" />
        <Stat label="Otwarte" value={String(open)} />
        <Stat label="Zamknięte" value={String(records.length - open)} />
        <Stat label="Użytkownicy" value="128" change="-3%" down />
      </div>
      <Card>
        <CardHeader
          header={<Subtitle1>Ostatnia aktywność</Subtitle1>}
          description={<Caption1 className={styles.muted}>Najnowsze rekordy w systemie.</Caption1>}
        />
        <div>
          {records.slice(0, 5).map((record) => (
            <div key={record.id} className={styles.row}>
              <span className={styles.rowText}>
                <Text weight="semibold" truncate wrap={false}>
                  {record.title}
                </Text>
                <Caption1 className={styles.muted}>
                  {record.id} · {record.owner}
                </Caption1>
              </span>
              <Badge {...statusBadge[record.status]}>{record.status}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
