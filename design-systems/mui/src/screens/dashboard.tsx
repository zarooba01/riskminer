import AddIcon from "@mui/icons-material/Add";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Typography from "@mui/material/Typography";

import type { RecordStatus, SampleRecord } from "@sample-data";

export const statusColor: Record<RecordStatus, "primary" | "warning" | "default"> = {
  nowe: "primary",
  "w toku": "warning",
  zamknięte: "default",
};

function Stat({ label, value, change, down }: { label: string; value: string; change?: string; down?: boolean }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h4" component="p">
          {value}
        </Typography>
        {change && (
          <Typography
            variant="caption"
            sx={{ display: "flex", alignItems: "center", gap: 0.5, color: down ? "error.main" : "success.main" }}
          >
            {down ? <TrendingDownIcon fontSize="inherit" /> : <TrendingUpIcon fontSize="inherit" />}
            {change} m/m
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardScreen({ userName, records }: { userName: string; records: SampleRecord[] }) {
  const open = records.filter((record) => record.status !== "zamknięte").length;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
        <Box>
          <Typography variant="h4" component="h1">
            Dzień dobry, {userName}
          </Typography>
          <Typography color="text.secondary">Podsumowanie tego, co dzieje się w aplikacji.</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />}>
          Nowy rekord
        </Button>
      </Box>
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "repeat(2, 1fr)", lg: "repeat(4, 1fr)" } }}>
        <Stat label="Wszystkie" value={String(records.length)} change="+12%" />
        <Stat label="Otwarte" value={String(open)} />
        <Stat label="Zamknięte" value={String(records.length - open)} />
        <Stat label="Użytkownicy" value="128" change="-3%" down />
      </Box>
      <Card>
        <CardHeader title="Ostatnia aktywność" subheader="Najnowsze rekordy w systemie." />
        <Divider />
        <List disablePadding>
          {records.slice(0, 5).map((record, index) => (
            <ListItem
              key={record.id}
              divider={index < 4}
              secondaryAction={<Chip label={record.status} size="small" color={statusColor[record.status]} />}
            >
              <ListItemText primary={record.title} secondary={`${record.id} · ${record.owner}`} sx={{ pr: 8 }} />
            </ListItem>
          ))}
        </List>
      </Card>
    </Box>
  );
}
