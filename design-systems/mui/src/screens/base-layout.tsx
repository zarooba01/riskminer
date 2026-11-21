import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import FormatListBulletedIcon from "@mui/icons-material/FormatListBulleted";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import HelpOutlineIcon from "@mui/icons-material/HelpOutlined";
import MapOutlinedIcon from "@mui/icons-material/MapOutlined";
import MenuIcon from "@mui/icons-material/Menu";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import SearchIcon from "@mui/icons-material/Search";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import AppBar from "@mui/material/AppBar";
import Avatar from "@mui/material/Avatar";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import ListSubheader from "@mui/material/ListSubheader";
import { useTheme } from "@mui/material/styles";
import TextField from "@mui/material/TextField";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useState, type ReactNode } from "react";

import type { SampleNavSection } from "@sample-data";

import { Logo } from "../logo";

const drawerWidth = 256;

const icons: Record<string, ReactNode> = {
  dashboard: <DashboardOutlinedIcon />,
  list: <FormatListBulletedIcon />,
  map: <MapOutlinedIcon />,
  chart: <AssessmentOutlinedIcon />,
  users: <GroupOutlinedIcon />,
  file: <DescriptionOutlinedIcon />,
  settings: <SettingsOutlinedIcon />,
};

type BaseLayoutProps = {
  navigation: SampleNavSection[];
  user: { name: string; email: string };
  /** Ścieżka aktywnej pozycji menu. */
  activeHref?: string;
  notifications?: number;
  children: ReactNode;
};

/** Strona bazowa w Material Design: AppBar na całą szerokość + Drawer po lewej. */
export function BaseLayout({ navigation, user, activeHref = "/dashboard", notifications = 0, children }: BaseLayoutProps) {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up("md"));
  const [open, setOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .join("");

  const nav = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Toolbar />
      <Box component="nav" aria-label="Nawigacja główna" sx={{ flex: 1, overflow: "auto" }}>
        {navigation.map((section) => (
          <List key={section.label} dense subheader={<ListSubheader sx={{ bgcolor: "transparent" }}>{section.label}</ListSubheader>}>
            {section.items.map((item) => (
              <ListItemButton
                key={item.href}
                selected={item.href === activeHref}
                sx={{ mx: 1, borderRadius: 1 }}
                onClick={() => setMobileOpen(false)}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>{icons[item.icon]}</ListItemIcon>
                <ListItemText primary={item.title} />
                {item.badge && <Chip label={item.badge} size="small" />}
              </ListItemButton>
            ))}
          </List>
        ))}
      </Box>
      <List dense>
        <ListItemButton sx={{ mx: 1, borderRadius: 1 }}>
          <ListItemIcon sx={{ minWidth: 40 }}>
            <HelpOutlineIcon />
          </ListItemIcon>
          <ListItemText primary="Pomoc" />
        </ListItemButton>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100svh" }}>
      <AppBar position="fixed" sx={{ zIndex: (muiTheme) => muiTheme.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: 1 }}>
          <IconButton
            color="inherit"
            edge="start"
            aria-label="Pokaż lub ukryj menu"
            onClick={() => (desktop ? setOpen(!open) : setMobileOpen(!mobileOpen))}
          >
            <MenuIcon />
          </IconButton>
          <Logo />
          <Box sx={{ flex: 1 }} />
          <TextField
            size="small"
            placeholder="Szukaj…"
            sx={{
              display: { xs: "none", sm: "block" },
              width: 280,
              "& .MuiOutlinedInput-root": { bgcolor: "rgba(255,255,255,0.15)", color: "inherit" },
              "& .MuiOutlinedInput-notchedOutline": { borderColor: "transparent" },
            }}
            slotProps={{
              htmlInput: { "aria-label": "Szukaj w aplikacji" },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: "inherit" }} />
                  </InputAdornment>
                ),
              },
            }}
          />
          <IconButton color="inherit" aria-label={`Powiadomienia: ${notifications}`}>
            <Badge badgeContent={notifications} color="error">
              <NotificationsNoneIcon />
            </Badge>
          </IconButton>
          <Avatar sx={{ width: 32, height: 32, fontSize: 14, bgcolor: "secondary.main" }}>{initials}</Avatar>
          <Typography variant="body2" sx={{ display: { xs: "none", lg: "block" } }}>
            {user.name}
          </Typography>
        </Toolbar>
      </AppBar>

      {desktop ? (
        <Drawer
          variant="persistent"
          open={open}
          sx={{ width: open ? drawerWidth : 0, flexShrink: 0, "& .MuiDrawer-paper": { width: drawerWidth, boxSizing: "border-box" } }}
        >
          {nav}
        </Drawer>
      ) : (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          sx={{ "& .MuiDrawer-paper": { width: drawerWidth, boxSizing: "border-box" } }}
        >
          {nav}
        </Drawer>
      )}

      <Box component="main" sx={{ flex: 1, minWidth: 0, p: { xs: 2, md: 3 } }}>
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}

/** Pusta strona: zaznaczone strefy, w które trafia treść ekranu. */
export function BasePagePlaceholder() {
  const zone = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px dashed",
    borderColor: "divider",
    borderRadius: 2,
    color: "text.secondary",
    bgcolor: "action.hover",
  } as const;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Box>
        <Typography variant="h4" component="h1">
          Tytuł strony
        </Typography>
        <Typography color="text.secondary">Krótki opis tego, co użytkownik zrobi na tej stronie.</Typography>
      </Box>
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" } }}>
        {["Kafelek 1", "Kafelek 2", "Kafelek 3"].map((label) => (
          <Box key={label} sx={{ ...zone, height: 112 }}>
            {label}
          </Box>
        ))}
      </Box>
      <Box sx={{ ...zone, minHeight: 320 }}>Treść strony</Box>
    </Box>
  );
}
