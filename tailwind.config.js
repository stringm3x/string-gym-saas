/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--color-bg)",
        sidebar: "var(--color-sidebar)",
        canvas: "var(--color-bg-content)",
        surface: {
          DEFAULT: "var(--color-surface)",
          hover: "var(--color-surface-hover)",
        },
        border: "var(--color-border)",
        brand: {
          green: "var(--color-brand-green)",
          gray: "var(--color-brand-gray)",
        },
        warning: "var(--color-warning)",
        danger: "var(--color-danger)",
        orange: "var(--color-orange)",
        gold: "var(--color-gold)",
        text: {
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
          muted: "var(--color-text-muted)",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist)", "sans-serif"],
        display: ["var(--font-anton)", "sans-serif"],
        mono: ["var(--font-ubuntu-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};
