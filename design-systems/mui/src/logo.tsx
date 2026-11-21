import HexagonOutlinedIcon from "@mui/icons-material/HexagonOutlined";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { appName } from "@shared/storybook";

export function Logo({ color = "inherit" }: { color?: "inherit" | "primary" }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: color === "primary" ? "primary.main" : "inherit" }}>
      <HexagonOutlinedIcon />
      <Typography variant="h6" component="span" noWrap sx={{ color: color === "primary" ? "text.primary" : "inherit" }}>
        {appName}
      </Typography>
    </Box>
  );
}
