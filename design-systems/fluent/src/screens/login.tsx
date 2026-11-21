import { Body1, Button, Card, Field, Input, Link, Title2, makeStyles, tokens } from "@fluentui/react-components";

import { Logo } from "../logo";

const useStyles = makeStyles({
  page: {
    minHeight: "100svh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: tokens.spacingVerticalXXL,
    padding: tokens.spacingHorizontalL,
    backgroundColor: tokens.colorNeutralBackground3,
  },
  card: { width: "100%", maxWidth: "400px", padding: tokens.spacingHorizontalXXL },
  form: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalL },
  center: { textAlign: "center" },
  forgot: { alignSelf: "flex-end" },
});

export function LoginScreen() {
  const styles = useStyles();

  return (
    <div className={styles.page}>
      <Logo />
      <Card className={styles.card}>
        <form className={styles.form} onSubmit={(event) => event.preventDefault()}>
          <div className={styles.center}>
            <Title2 as="h1" block>
              Zaloguj się
            </Title2>
            <Body1>Podaj e-mail i hasło do swojego konta.</Body1>
          </div>
          <Field label="E-mail">
            <Input type="email" autoComplete="email" placeholder="jan@example.com" />
          </Field>
          <Field label="Hasło">
            <Input type="password" autoComplete="current-password" />
          </Field>
          <Link href="#" className={styles.forgot}>
            Nie pamiętasz hasła?
          </Link>
          <Button type="submit" appearance="primary" size="large">
            Zaloguj się
          </Button>
          <Body1 className={styles.center}>
            Nie masz konta? <Link href="#">Zarejestruj się</Link>
          </Body1>
        </form>
      </Card>
    </div>
  );
}
