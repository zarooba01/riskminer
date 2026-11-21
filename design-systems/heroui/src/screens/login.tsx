import { Button, Card, Input, Label, Link, TextField } from "@heroui/react";

import { Logo } from "../logo";

export function LoginScreen() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background-secondary p-4">
      <Logo />
      <Card className="w-full max-w-sm">
        <Card.Header className="items-center text-center">
          <Card.Title className="text-xl">Zaloguj się</Card.Title>
          <Card.Description>Podaj e-mail i hasło do swojego konta.</Card.Description>
        </Card.Header>
        <Card.Content>
          <form className="flex flex-col gap-4" onSubmit={(event) => event.preventDefault()}>
            <TextField name="email" type="email" fullWidth>
              <Label>E-mail</Label>
              <Input placeholder="jan@example.com" autoComplete="email" />
            </TextField>
            <TextField name="password" type="password" fullWidth>
              <Label>Hasło</Label>
              <Input autoComplete="current-password" />
            </TextField>
            <Link href="#" className="self-end text-sm">
              Nie pamiętasz hasła?
            </Link>
            <Button type="submit" variant="primary" size="lg" fullWidth>
              Zaloguj się
            </Button>
            <p className="text-center text-sm text-muted">
              Nie masz konta?{" "}
              <Link href="#" className="text-sm">
                Zarejestruj się
              </Link>
            </p>
          </form>
        </Card.Content>
      </Card>
    </div>
  );
}
