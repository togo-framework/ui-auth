import { create } from "@storybook/theming/create";

// ToGO brand applied to the Storybook manager UI (sidebar, toolbar, docs chrome).
export default create({
  base: "dark",
  brandTitle: "ToGO UI · Design System",
  brandUrl: "https://to-go.dev",
  brandImage: "togo-brand-ui.svg?v=1",
  brandTarget: "_self",

  colorPrimary: "#1FC7DC",
  colorSecondary: "#2D8CE6",

  appBg: "#07090c",
  appContentBg: "#0c1014",
  appPreviewBg: "#0c1014",
  appBorderColor: "#1d2630",
  appBorderRadius: 10,

  textColor: "#e8eef2",
  textInverseColor: "#07090c",
  textMutedColor: "#8b97a3",

  barBg: "#0c1014",
  barTextColor: "#8b97a3",
  barSelectedColor: "#1FC7DC",
  barHoverColor: "#2D8CE6",

  inputBg: "#10151b",
  inputBorder: "#283442",
  inputTextColor: "#e8eef2",
  inputBorderRadius: 8,

  fontBase: '"Sora", "IBM Plex Sans", system-ui, sans-serif',
  fontCode: '"JetBrains Mono", monospace',
});
