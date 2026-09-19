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
          "green-deep": "var(--color-brand-green-deep)",
        },
        "on-brand": "var(--color-on-brand)",
        paper: {
          DEFAULT: "var(--color-paper)",
          ink: "var(--color-paper-ink)",
          "ink-soft": "var(--color-paper-ink-soft)",
          "ink-faint": "var(--color-paper-ink-faint)",
          line: "var(--color-paper-line)",
        },
        warning: "var(--color-warning)",
        danger: "var(--color-danger)",
        gold: "var(--color-gold)",
        success: "var(--color-success)",
        whatsapp: "var(--color-whatsapp)",
        bubble: {
          bot: "var(--color-bubble-bot)",
          auto: "var(--color-bubble-auto)",
        },
        text: {
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
          muted: "var(--color-text-muted)",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist)", "system-ui", "-apple-system", "sans-serif"],
        display: ["var(--font-anton)", "Arial Narrow", "Impact", "sans-serif"],
        mono: ["var(--font-ubuntu-mono)", "ui-monospace", "monospace"],
      },
      // Escala tipográfica del sistema de marca (tokens.json → type.groups).
      fontSize: {
        "titular-xl": ["88px", { lineHeight: "80px", letterSpacing: "0.01em" }],
        "titular-l": ["56px", { lineHeight: "52px", letterSpacing: "0.01em" }],
        "titular-m": ["34px", { lineHeight: "34px", letterSpacing: "0.01em" }],
        "cuerpo-l": ["19px", { lineHeight: "30px" }],
        cuerpo: ["16px", { lineHeight: "26px" }],
        "cuerpo-s": ["14px", { lineHeight: "22px" }],
        etiqueta: ["13px", { lineHeight: "16px", letterSpacing: "0.16em" }],
        dato: ["15px", { lineHeight: "20px", letterSpacing: "0.04em" }],
      },
      boxShadow: {
        "hard-green": "var(--shadow-hard-green)",
        "hard-ink": "var(--shadow-hard-ink)",
      },
    },
  },
  plugins: [],
};
