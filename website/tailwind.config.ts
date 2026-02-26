import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "var(--brand-bg)",
          surface: "var(--brand-surface)",
          surface2: "var(--brand-surface2)",
          line: "var(--brand-line)",
          yellow: "var(--brand-yellow)",
          ink: "var(--brand-ink)",
          muted: "var(--brand-muted)",
        },
      },
      fontFamily: {
        display: ["var(--font-body)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
        jp: ["var(--font-jp)", "sans-serif"],
        heading: ["var(--font-heading)", "sans-serif"],
      },
      boxShadow: {
        sticker: "0 12px 28px -20px rgba(0, 0, 0, 0.7)",
        stickerHover: "0 18px 34px -22px rgba(0, 0, 0, 0.78)",
      },
      transitionTimingFunction: {
        pop: "cubic-bezier(0.2, 0.9, 0.2, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
