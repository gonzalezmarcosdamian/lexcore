import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#f0f4ff",
          100: "#dce6ff",
          200: "#b9ccff",
          300: "#8faaf8",
          400: "#6284f0",
          500: "#3d62e8",
          600: "#2b4dd4",
          700: "#2140b8",
          800: "#1b3494",
          900: "#152872",
          950: "#0d1a4d",
        },
        ink: {
          900: "#0f1c2e",
          800: "#1a2e46",
          700: "#253d5e",
          600: "#3a5272",
          400: "#6b8aaa",
          200: "#c2d0de",
          100: "#e8eef4",
          50:  "#f4f7fa",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
