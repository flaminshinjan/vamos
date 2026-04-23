import type { Config } from "tailwindcss";

// Keep Tailwind minimal — the design system lives in globals.css with
// CSS variables so dark mode + theming cascade naturally.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: { extend: {} },
  plugins: [],
};

export default config;
