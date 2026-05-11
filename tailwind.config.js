/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        ink: "#070b12",
        panel: "#111827",
        panel2: "#1f2937",
        cyanline: "#3dd6c6",
        goldline: "#ffd166",
        dangerline: "#fb7185",
      },
      boxShadow: {
        glow: "0 0 36px rgba(61, 214, 198, 0.28)",
        gold: "0 0 28px rgba(255, 209, 102, 0.22)",
      },
    },
  },
  plugins: [],
};
