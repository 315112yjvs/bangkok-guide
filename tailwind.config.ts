import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // 品牌色票：一個品牌藍（取自 logo）＋中性墨色與紙色，其餘顏色只留給功能性用途
        brand: { DEFAULT: "#3d4aae", dark: "#323d91", soft: "#eef0fa" },
        ink: "#17181c",
        muted: "#6a6e76",
        line: "#e5e4df",
        paper: "#f6f5f1",
      },
      fontFamily: {
        liufen: ['OpenHuninn', 'NotoSansThai', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
