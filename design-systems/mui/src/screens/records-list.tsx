import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useMemo, useState } from "react";

import type { SampleRecord } from "@sample-data";

import { statusColor } from "./dashboard";

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
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
        <Box>
          <Typography variant="h4" component="h1">
            Rekordy
          </Typography>
          <Typography color="text.secondary">Przykładowa lista — podmień na dane z wyzwania.</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />}>
          Dodaj
        </Button>
      </Box>
      <TextField
        size="small"
        placeholder="Szukaj…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        sx={{ maxWidth: 360 }}
        slotProps={{
          htmlInput: { "aria-label": "Szukaj rekordów" },
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          },
        }}
      />

      <TableContainer component={Paper} sx={{ display: { xs: "none", md: "block" } }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Numer</TableCell>
              <TableCell>Tytuł</TableCell>
              <TableCell>Właściciel</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Aktualizacja</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((record) => (
              <TableRow key={record.id} hover>
                <TableCell sx={{ fontFamily: "monospace" }}>{record.id}</TableCell>
                <TableCell sx={{ fontWeight: 500 }}>{record.title}</TableCell>
                <TableCell>{record.owner}</TableCell>
                <TableCell>
                  <Chip label={record.status} size="small" color={statusColor[record.status]} />
                </TableCell>
                <TableCell align="right">{record.updatedAt}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ display: { xs: "flex", md: "none" }, flexDirection: "column", gap: 1.5 }}>
        {filtered.map((record) => (
          <Card key={record.id} variant="outlined">
            <CardContent>
              <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1.5 }}>
                <Typography sx={{ fontWeight: 500 }}>{record.title}</Typography>
                <Chip label={record.status} size="small" color={statusColor[record.status]} />
              </Box>
              <Typography variant="caption" color="text.secondary">
                {record.id} · {record.owner} · {record.updatedAt}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Box>
  );
}
