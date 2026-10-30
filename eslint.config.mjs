// ESLint 9 flat config. eslint-config-next@16 ships native flat configs, so we
// import and spread the shareable config directly (no FlatCompat bridge needed).
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  ...nextCoreWebVitals,
  {
    ignores: [
      ".next/**",
      ".next-build/**",
      ".next-verify/**",
      ".next-claude/**",
      "node_modules/**",
    ],
  },
];

export default eslintConfig;
