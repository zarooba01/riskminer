import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Link from "@mui/material/Link";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { Logo } from "../logo";

export function LoginScreen() {
  return (
    <Box
      sx={{
        minHeight: "100svh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        p: 2,
        bgcolor: "action.hover",
      }}
    >
      <Logo color="primary" />
      <Card sx={{ width: "100%", maxWidth: 400 }}>
        <CardContent sx={{ p: 3 }}>
          <Stack component="form" spacing={2.5} onSubmit={(event) => event.preventDefault()}>
            <Box sx={{ textAlign: "center" }}>
              <Typography variant="h5" component="h1">
                Zaloguj się
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Podaj e-mail i hasło do swojego konta.
              </Typography>
            </Box>
            <TextField label="E-mail" type="email" autoComplete="email" placeholder="jan@example.com" fullWidth />
            <TextField label="Hasło" type="password" autoComplete="current-password" fullWidth />
            <Link href="#" variant="body2" sx={{ alignSelf: "flex-end" }}>
              Nie pamiętasz hasła?
            </Link>
            <Button type="submit" variant="contained" size="large" fullWidth>
              Zaloguj się
            </Button>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
              Nie masz konta? <Link href="#">Zarejestruj się</Link>
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
