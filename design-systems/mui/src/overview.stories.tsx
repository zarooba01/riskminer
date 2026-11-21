import AddIcon from "@mui/icons-material/Add";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = { title: "Przegląd" } satisfies Meta;
export default meta;

/** Ten sam zestaw elementów co w „Porównaniu wariantów" głównego Storybooka. */
export const Komponenty: StoryObj = {
  render: () => (
    <Stack spacing={3} sx={{ p: 3, maxWidth: 520 }}>
      <Box>
        <Typography variant="overline" color="text.secondary">
          Material UI
        </Typography>
        <Typography variant="h4" component="h1">
          MUI
        </Typography>
        <Typography color="text.secondary">Zażółć gęślą jaźń — 0123456789</Typography>
      </Box>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
        <Button variant="contained" startIcon={<AddIcon />}>
          Dodaj
        </Button>
        <Button variant="contained" color="secondary">
          Drugi
        </Button>
        <Button variant="outlined">Kontur</Button>
        <Button variant="text">Tekstowy</Button>
        <Button variant="contained" color="error">
          Usuń
        </Button>
      </Stack>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap", alignItems: "center" }}>
        <Chip label="nowe" color="primary" size="small" />
        <Chip label="w toku" color="warning" size="small" />
        <Chip label="zamknięte" variant="outlined" size="small" />
        <Chip label="błąd" color="error" size="small" />
        <Switch defaultChecked slotProps={{ input: { "aria-label": "Przykładowy przełącznik" } }} />
      </Stack>
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: "repeat(2, 1fr)" }}>
        {[
          { label: "Wszystkie", value: "1 284" },
          { label: "Użytkownicy", value: "128" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                {stat.label}
              </Typography>
              <Typography variant="h4" component="p">
                {stat.value}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>
      <Card>
        <CardHeader title="Karta z formularzem" subheader="Pole, opis i akcja w jednym miejscu." />
        <CardContent>
          <Stack spacing={2} sx={{ alignItems: "flex-start" }}>
            <TextField
              label="E-mail"
              type="email"
              placeholder="jan@example.com"
              helperText="Na ten adres wyślemy potwierdzenie."
              fullWidth
            />
            <Button variant="contained">Zapisz</Button>
          </Stack>
        </CardContent>
      </Card>
      <Alert severity="error">
        <AlertTitle>Nie udało się zapisać</AlertTitle>
        Sprawdź połączenie i spróbuj ponownie.
      </Alert>
    </Stack>
  ),
};
