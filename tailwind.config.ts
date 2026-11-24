import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: { colors: { brand: { DEFAULT: "#6258A6", dark: "#4a4280", light: "#efedf8" } } } },
  plugins: [],
} satisfies Config;
