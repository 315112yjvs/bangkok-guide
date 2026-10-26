import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        // 繪本風色票：和紙白底、墨灰線條與文字，四個淺色只用在色塊（太淡，不能當文字色）
        ink: "#3E3A39",
        muted: "#6F6864",
        line: "#E8DFD0",
        paper: "#FFFCF6",
        coral: { DEFAULT: "#F2A497", soft: "#FBE3DD" },     // 珊瑚粉
        mustard: { DEFAULT: "#F6D27A", soft: "#FCF0CC" },   // 山吹黃
        mizu: { DEFAULT: "#A8D3E6", soft: "#E1F0F7" },      // 水色
        matcha: { DEFAULT: "#B9DAA5", soft: "#E6F2DD" },    // 若竹綠
        // 舊的 brand 色名沿用，改指向墨灰：logo 保留原本的藍，其他地方不再用藍色
        brand: { DEFAULT: "#3E3A39", dark: "#2A2726", soft: "#FCF0CC" },
      },
      fontFamily: {
        liufen: ['Huninn', 'OpenHuninn', 'NotoSansThai', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
