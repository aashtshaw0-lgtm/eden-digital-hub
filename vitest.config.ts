import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // convex-test resolves the app's Convex functions with `import.meta.glob`,
    // which only works if Vite transforms it — so it must not be externalised.
    server: {
      deps: {
        inline: ["convex-test"],
      },
    },
  },
});