/** @type {import("prettier").Config} */
const config = {
  printWidth: 120,
  useTabs: false,
  tabWidth: 2,
  trailingComma: "es5",
  singleQuote: true,
  semi: true,
  jsxSingleQuote: true,
  plugins: ["prettier-plugin-organize-imports", "prettier-plugin-tailwindcss"],
};

export default config;
