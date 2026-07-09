import * as React from "react";
import type { Preview } from "@storybook/react";
import togoTheme from "./theme";
import "./tailwind.css";

// Viewport presets so every component can be previewed mobile-first → desktop.
const customViewports = {
  mobile: { name: "Mobile (375)", styles: { width: "375px", height: "812px" }, type: "mobile" },
  tablet: { name: "Tablet (768)", styles: { width: "768px", height: "1024px" }, type: "tablet" },
  laptop: { name: "Laptop (1280)", styles: { width: "1280px", height: "800px" }, type: "desktop" },
  desktop: { name: "Desktop (1440)", styles: { width: "1440px", height: "900px" }, type: "desktop" },
};

const preview: Preview = {
  // Autodocs: every component gets a generated Docs page (description + props + controls).
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    viewport: { viewports: customViewports },
    backgrounds: { disable: true }, // the theme toggle drives the background via tokens
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    docs: { theme: togoTheme }, // ToGO brand on the autodocs pages
    options: {
      storySort: {
        order: ["Getting Started", "Design System", "Components", "Pages"],
      },
    },
  },
  globalTypes: {
    theme: {
      description: "Color mode",
      defaultValue: "dark",
      toolbar: {
        title: "Theme",
        icon: "circlehollow",
        dynamicTitle: true,
        items: [
          { value: "dark", title: "Dark", icon: "moon" },
          { value: "light", title: "Light", icon: "sun" },
        ],
      },
    },
    direction: {
      description: "Text direction",
      defaultValue: "ltr",
      toolbar: {
        title: "Direction",
        icon: "transfer",
        dynamicTitle: true,
        items: [
          { value: "ltr", title: "LTR" },
          { value: "rtl", title: "RTL (عربي)" },
        ],
      },
    },
  },
  decorators: [
    (Story, ctx) => {
      const theme = (ctx.globals.theme as string) || "dark";
      const dir = (ctx.globals.direction as string) || "ltr";
      // Full-bleed stories (auth, layout, profile) render edge-to-edge with no padding.
      const fullBleed = Boolean(ctx.parameters.fullBleed);
      // In STORY (canvas) view, apply on <html> too so portaled UI (Dialog/DropdownMenu/
      // Popover) is themed + RTL. In DOCS view, do NOT touch <html> — it would flip
      // Storybook's own docs chrome (props tables, headings); the wrapper below still
      // themes + mirrors the component preview itself.
      React.useEffect(() => {
        if (ctx.viewMode === "docs") return;
        document.documentElement.classList.toggle("dark", theme === "dark");
        // data-theme drives the --togo-color-* semantic layer (ThemeProvider switch
        // surface); .dark keeps the bridged tokens + dark: utilities in sync.
        document.documentElement.setAttribute("data-theme", theme);
        document.documentElement.setAttribute("dir", dir);
      }, [theme, dir]);
      return (
        <div
          dir={dir}
          data-theme={theme}
          className={`tg-root ${theme === "dark" ? "dark" : ""} bg-background text-foreground`}
          style={{ padding: fullBleed ? 0 : 24, minHeight: "100vh" }}
        >
          <Story />
        </div>
      );
    },
  ],
};

export default preview;
