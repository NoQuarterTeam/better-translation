import { defineConfig } from "vite-plus"

const ignorePatterns = [
  "dist/",
  ".cache/",
  ".turbo/",
  ".output/",
  "bun.lock",
  "routeTree.gen.ts",
  ".tanstack-start/",
  ".tanstack/",
  "drizzle/",
  "migrations/",
  ".vercel",
  "node_modules/",
  "bt/",
  "routeTree.gen.ts",
]
export default defineConfig({
  // Oxlint configuration.
  lint: {
    settings: { react: { linkComponents: [{ name: "Link", attribute: "to" }] } },
    ignorePatterns,
    options: { typeAware: true, typeCheck: true },
    plugins: ["typescript", "promise", "react"],
    rules: {
      "no-unused-vars": "error",
      "react/rules-of-hooks": "error",
      "react/jsx-key": "error",
      "typescript/consistent-type-imports": "error",
    },
  },

  // Oxfmt configuration.
  fmt: {
    semi: false,
    singleQuote: false,
    printWidth: 130,
    tabWidth: 2,
    trailingComma: "all",
    sortImports: {
      customGroups: [
        { groupName: "better-translation", elementNamePattern: ["better-translation/**"] },
        { groupName: "local-alias", elementNamePattern: ["@/**"] },
      ],
      groups: [
        ["type-import", "value-builtin", "value-external"],
        "better-translation",
        "local-alias",
        ["type-internal", "value-internal"],
        ["type-parent", "type-sibling", "type-index"],
        ["value-parent", "value-sibling", "value-index"],
        "unknown",
      ],
    },
    sortTailwindcss: {
      stylesheet: "./apps/web/src/styles.css",
      attributes: ["class", "className"],
      functions: ["clsx", "cn", "cva", "tw"],
    },
    ignorePatterns,
  },

  // Vite Task configuration.
  run: {
    tasks: {},
  },
})
