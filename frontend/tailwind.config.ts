import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        flapkap: {
          green: "#00C48C",
          dark: "#0A1628",
          navy: "#1A2B4A",
          light: "#F4F7FF",
        },
      },
    },
  },
  plugins: [],
};
export default config;
