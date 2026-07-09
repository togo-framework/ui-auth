import { addons } from "@storybook/manager-api";
import togoTheme from "./theme";

addons.setConfig({
  theme: togoTheme,
  sidebar: { showRoots: true },
});
