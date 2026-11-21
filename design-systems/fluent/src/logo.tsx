import { Subtitle1, tokens } from "@fluentui/react-components";
import { Hexagon24Regular } from "@fluentui/react-icons";

import { appName } from "@shared/storybook";

export function Logo() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: tokens.spacingHorizontalS }}>
      <Hexagon24Regular style={{ color: tokens.colorBrandForeground1 }} />
      <Subtitle1 wrap={false}>{appName}</Subtitle1>
    </span>
  );
}
