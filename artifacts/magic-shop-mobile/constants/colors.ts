export const radius = 8;

const colors = {
  light: {
    text: "#151C28",
    tint: "#D6741F",

    background: "#FBFAF9",
    foreground: "#151C28",

    card: "#FFFFFF",
    cardForeground: "#151C28",

    primary: "#D6741F",
    primaryForeground: "#FFFFFF",

    secondary: "#F3F0ED",
    secondaryForeground: "#151C28",

    muted: "#F2F0ED",
    mutedForeground: "#555D6D",

    accent: "#F9EFE7",
    accentForeground: "#151C28",

    destructive: "#C51111",
    destructiveForeground: "#FAFAFA",

    border: "#E5E0DC",
    input: "#D8D1CA",

    sidebar: "#0D172B",
    sidebarForeground: "#F1EBE4",
    sidebarBorder: "#1C2840",
    sidebarAccent: "#192743",
    navy: "#0D172B",
    navyDeep: "#081021",
    copper: "#D6741F",
    copperLight: "#E28736",
  },
  dark: {
    text: "#F5F2EF",
    tint: "#E28736",

    background: "#0D121C",
    foreground: "#F5F2EF",

    card: "#121926",
    cardForeground: "#F5F2EF",

    primary: "#E28736",
    primaryForeground: "#0A1429",

    secondary: "#1F2533",
    secondaryForeground: "#F5F2EF",

    muted: "#212631",
    mutedForeground: "#BEB3A7",

    accent: "#20293C",
    accentForeground: "#F5F2EF",

    destructive: "#C51111",
    destructiveForeground: "#FAFAFA",

    border: "#262F40",
    input: "#2E384D",

    sidebar: "#081021",
    sidebarForeground: "#F1EBE4",
    sidebarBorder: "#182339",
    sidebarAccent: "#182339",
    navy: "#081021",
    navyDeep: "#040712",
    copper: "#E28736",
    copperLight: "#E48F44",
  },
};

export type ColorPalette = (typeof colors)["light"];
export type ColorTokens = ColorPalette & { radius: number };

export default colors;
