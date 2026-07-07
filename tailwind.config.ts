import type { Config } from "tailwindcss";

export default <Partial<Config>>{
  content: [
    "./components/**/*.{vue,js,ts}",
    "./layouts/**/*.vue",
    "./pages/**/*.vue",
    "./composables/**/*.{js,ts}",
    "./app.vue",
  ],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        surface: "var(--surface-1)",
        "surface-page": "var(--surface-page)",
        ink: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
        },
        gridline: "var(--gridline)",
        baseline: "var(--baseline)",
        border: {
          hairline: "var(--border-hairline)",
        },
        series: {
          1: "var(--series-1)",
          2: "var(--series-2)",
          3: "var(--series-3)",
          4: "var(--series-4)",
          5: "var(--series-5)",
          6: "var(--series-6)",
          7: "var(--series-7)",
          8: "var(--series-8)",
        },
      },
      fontFamily: {
        sans: [
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
      },
    },
  },
};
