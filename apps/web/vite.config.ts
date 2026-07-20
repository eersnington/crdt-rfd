import { defineConfig } from "vite-plus";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const yjsRuntimePackages = [
  "yjs",
  "y-protocols/awareness",
  "y-prosemirror",
  "@tiptap/y-tiptap",
  "@tiptap/extension-collaboration",
  "@tiptap/extension-collaboration-caret",
];

const editorRuntimePackages = [
  ...yjsRuntimePackages,
  "@tiptap/core",
  "@tiptap/react",
  "@tiptap/react/menus",
  "@tiptap/starter-kit",
  "@tiptap/markdown",
  "@tiptap/extension-bubble-menu",
];

const config = defineConfig({
  lint: {
    plugins: ["import", "typescript", "unicorn"],
    options: { typeAware: true, typeCheck: true },
    rules: {
      "for-direction": "error",
      "no-async-promise-executor": "error",
      "no-case-declarations": "error",
      "no-class-assign": "error",
      "no-compare-neg-zero": "error",
      "no-cond-assign": "error",
      "no-constant-binary-expression": "error",
      "no-constant-condition": "error",
      "no-control-regex": "error",
      "no-debugger": "error",
      "no-delete-var": "error",
      "no-dupe-else-if": "error",
      "no-duplicate-case": "error",
      "no-empty-character-class": "error",
      "no-empty-pattern": "error",
      "no-empty-static-block": "error",
      "no-ex-assign": "error",
      "no-extra-boolean-cast": "error",
      "no-fallthrough": "error",
      "no-global-assign": "error",
      "no-invalid-regexp": "error",
      "no-irregular-whitespace": "error",
      "no-loss-of-precision": "error",
      "no-misleading-character-class": "error",
      "no-nonoctal-decimal-escape": "error",
      "no-regex-spaces": "error",
      "no-self-assign": "error",
      "no-shadow": "warn",
      "no-shadow-restricted-names": "error",
      "no-sparse-arrays": "error",
      "no-unsafe-finally": "error",
      "no-unsafe-optional-chaining": "error",
      "no-unused-labels": "error",
      "no-unused-private-class-members": "error",
      "no-useless-backreference": "error",
      "no-useless-catch": "error",
      "no-useless-escape": "error",
      "no-var": "error",
      "no-with": "error",
      "prefer-const": "error",
      "require-yield": "error",
      "use-isnan": "error",
      "valid-typeof": "error",
      "import/consistent-type-specifier-style": ["error", "prefer-top-level"],
      "import/first": "error",
      "import/newline-after-import": "error",
      "import/no-commonjs": "error",
      "import/no-duplicates": "error",
      "import/no-cycle": "off",
      "import/order": "off",
      "sort-imports": "off",
      "typescript/ban-ts-comment": [
        "error",
        {
          "ts-expect-error": false,
          "ts-ignore": "allow-with-description",
        },
      ],
      "typescript/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "typescript/method-signature-style": ["error", "property"],
      "typescript/no-duplicate-enum-values": "error",
      "typescript/no-extra-non-null-assertion": "error",
      "typescript/no-for-in-array": "error",
      "typescript/no-inferrable-types": ["error", { ignoreParameters: true }],
      "typescript/no-misused-new": "error",
      "typescript/no-namespace": "error",
      "typescript/no-non-null-asserted-optional-chain": "error",
      "typescript/no-unnecessary-condition": "error",
      "typescript/no-unnecessary-type-assertion": "error",
      "typescript/no-unsafe-function-type": "error",
      "typescript/no-wrapper-object-types": "error",
      "typescript/prefer-as-const": "error",
      "typescript/prefer-for-of": "warn",
      "typescript/triple-slash-reference": "error",
      "typescript/array-type": "off",
      "typescript/require-await": "off",
      "unicorn/prefer-node-protocol": "error",
    },
  },
  resolve: {
    tsconfigPaths: true,
    // React hooks, the renderer, and Yjs all require one module identity per runtime.
    dedupe: ["react", "react-dom", ...yjsRuntimePackages],
  },
  // Yjs instances must be shared with Tiptap in every Vite runtime.
  // Pre-bundle the lazy editor too, preventing a navigation-time optimizer reload.
  optimizeDeps: { include: editorRuntimePackages },
  ssr: { noExternal: yjsRuntimePackages },
  test: { server: { deps: { inline: yjsRuntimePackages } } },
  build: { rolldownOptions: { external: ["cloudflare:workers"] } },
  plugins: [
    devtools(),
    tailwindcss(),
    tanstackStart({ server: { entry: "./server.ts" } }),
    viteReact(),
  ],
});

export default config;
