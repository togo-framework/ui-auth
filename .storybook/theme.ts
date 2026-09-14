import { create } from "@storybook/theming/create";

// ToGO brand (https://to-go.dev/en/brand) on the Storybook manager: the ink ground,
// hairline lines, square chrome and the teal action colour — fadymondy.com's grid.
export default create({
  base: "dark",
  brandTitle: "ToGO UI · Design System",
  brandUrl: "https://to-go.dev",
  brandImage: "togo-brand-ui.svg?v=2",
  brandTarget: "_self",

  colorPrimary: "#1F8A99",
  colorSecondary: "#1F8A99",

  appBg: "#0B1429",
  appContentBg: "#0B1429",
  appPreviewBg: "#0B1429",
  appBorderColor: "#25355C",
  appBorderRadius: 0,

  textColor: "#F0EBE1",
  textInverseColor: "#0B1429",
  textMutedColor: "#8A97B8",

  barBg: "#0E1A3C",
  barTextColor: "#8A97B8",
  barSelectedColor: "#1F8A99",
  barHoverColor: "#F0EBE1",

  inputBg: "#0E1A3C",
  inputBorder: "#25355C",
  inputTextColor: "#F0EBE1",
  inputBorderRadius: 6,

  fontBase: '"Lusail", system-ui, sans-serif',
  fontCode: '"JetBrains Mono", monospace',
});
