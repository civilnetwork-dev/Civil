import type { Config as TailwindConfig } from "tailwindcss";

export default {
  content: ["./src/**/*.astro", "./src/**/*.tsx"],
  theme: {
    extend: {
      backgroundColor: {
        "catppuccin-mocha-mantle": "#181825",
      },
    },
    fontFamily: {
      "schibsted-grotesk": ["Schibsted Grotesk"],
      montserrat: ["Montserrat"],
    },
  },
  plugins: [],
} satisfies TailwindConfig;
