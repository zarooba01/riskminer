import {
  Avatar,
  Badge,
  Body1,
  Button,
  CounterBadge,
  NavDrawer,
  NavDrawerBody,
  NavDrawerFooter,
  NavItem,
  NavSectionHeader,
  SearchBox,
  Title2,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import {
  Alert24Regular,
  Board20Regular,
  DataBarVertical20Regular,
  Document20Regular,
  List20Regular,
  Map20Regular,
  Navigation24Regular,
  People20Regular,
  QuestionCircle20Regular,
  Settings20Regular,
} from "@fluentui/react-icons";
import { useEffect, useState, type ReactElement, type ReactNode } from "react";

import type { SampleNavSection } from "@sample-data";

import { Logo } from "../logo";

const icons: Record<string, ReactElement> = {
  dashboard: <Board20Regular />,
  list: <List20Regular />,
  map: <Map20Regular />,
  chart: <DataBarVertical20Regular />,
  users: <People20Regular />,
  file: <Document20Regular />,
  settings: <Settings20Regular />,
};

const useStyles = makeStyles({
  root: { display: "flex", flexDirection: "column", height: "100svh", backgroundColor: tokens.colorNeutralBackground2 },
  header: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    height: "56px",
    flexShrink: 0,
    padding: `0 ${tokens.spacingHorizontalM}`,
    backgroundColor: tokens.colorNeutralBackground1,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  spacer: { flex: 1 },
  search: { width: "280px", "@media (max-width: 640px)": { display: "none" } },
  userName: { "@media (max-width: 1024px)": { display: "none" } },
  bell: { position: "relative" },
  bellBadge: { position: "absolute", top: "2px", right: "2px" },
  body: { display: "flex", flex: 1, minHeight: 0 },
  nav: { width: "256px" },
  navLabel: { flex: 1 },
  main: { flex: 1, minWidth: 0, overflowY: "auto", padding: tokens.spacingHorizontalL, "@media (min-width: 768px)": { padding: tokens.spacingHorizontalXXL } },
  stack: { display: "flex", flexDirection: "column", gap: tokens.spacingVerticalXL },
  tiles: { display: "grid", gap: tokens.spacingHorizontalL, gridTemplateColumns: "1fr", "@media (min-width: 768px)": { gridTemplateColumns: "repeat(3, 1fr)" } },
  zone: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: `1px dashed ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusLarge,
    color: tokens.colorNeutralForeground3,
    backgroundColor: tokens.colorNeutralBackground3,
  },
});

function useIsDesktop() {
  const [desktop, setDesktop] = useState(() => window.matchMedia("(min-width: 768px)").matches);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const onChange = () => setDesktop(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return desktop;
}

type BaseLayoutProps = {
  navigation: SampleNavSection[];
  user: { name: string; email: string };
  /** Ścieżka aktywnej pozycji menu. */
  activeHref?: string;
  notifications?: number;
  children: ReactNode;
};

/** Strona bazowa w Fluent UI: nagłówek na całą szerokość + NavDrawer po lewej. */
export function BaseLayout({ navigation, user, activeHref = "/dashboard", notifications = 0, children }: BaseLayoutProps) {
  const styles = useStyles();
  const desktop = useIsDesktop();
  const [open, setOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isOpen = desktop ? open : mobileOpen;

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <Button
          appearance="subtle"
          icon={<Navigation24Regular />}
          aria-label="Pokaż lub ukryj menu"
          onClick={() => (desktop ? setOpen(!open) : setMobileOpen(!mobileOpen))}
        />
        <Logo />
        <div className={styles.spacer} />
        <SearchBox className={styles.search} placeholder="Szukaj…" aria-label="Szukaj w aplikacji" />
        <span className={styles.bell}>
          <Button appearance="subtle" icon={<Alert24Regular />} aria-label={`Powiadomienia: ${notifications}`} />
          {notifications > 0 && <CounterBadge className={styles.bellBadge} count={notifications} size="small" color="danger" />}
        </span>
        <Avatar name={user.name} color="brand" size={32} />
        <Body1 className={styles.userName}>{user.name}</Body1>
      </header>

      <div className={styles.body}>
        <NavDrawer
          className={styles.nav}
          open={isOpen}
          type={desktop ? "inline" : "overlay"}
          selectedValue={activeHref}
          onOpenChange={(_, data) => (desktop ? setOpen(data.open) : setMobileOpen(data.open))}
        >
          <NavDrawerBody>
            {navigation.map((section) => (
              <div key={section.label}>
                <NavSectionHeader>{section.label}</NavSectionHeader>
                {section.items.map((item) => (
                  <NavItem key={item.href} value={item.href} icon={icons[item.icon]} onClick={() => setMobileOpen(false)}>
                    <span className={styles.navLabel}>{item.title}</span>
                    {item.badge && (
                      <Badge appearance="tint" size="small">
                        {item.badge}
                      </Badge>
                    )}
                  </NavItem>
                ))}
              </div>
            ))}
          </NavDrawerBody>
          <NavDrawerFooter>
            <NavItem value="/help" icon={<QuestionCircle20Regular />}>
              Pomoc
            </NavItem>
          </NavDrawerFooter>
        </NavDrawer>
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}

/** Pusta strona: zaznaczone strefy, w które trafia treść ekranu. */
export function BasePagePlaceholder() {
  const styles = useStyles();

  return (
    <div className={styles.stack}>
      <div>
        <Title2 as="h1" block>
          Tytuł strony
        </Title2>
        <Body1>Krótki opis tego, co użytkownik zrobi na tej stronie.</Body1>
      </div>
      <div className={styles.tiles}>
        {["Kafelek 1", "Kafelek 2", "Kafelek 3"].map((label) => (
          <div key={label} className={styles.zone} style={{ height: 112 }}>
            {label}
          </div>
        ))}
      </div>
      <div className={styles.zone} style={{ minHeight: 320 }}>
        Treść strony
      </div>
    </div>
  );
}
