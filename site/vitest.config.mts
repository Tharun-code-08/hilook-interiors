import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // `server-only` throws by design when imported outside a server
      // component. The modules under test legitimately import it, so it is
      // stubbed here rather than removed from the source.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Integration tests each own a temp database file; running files in
    // parallel is fine, but tests *within* a file share one and must not
    // interleave.
    fileParallelism: true,
    sequence: { concurrent: false },
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts"],
      exclude: ["lib/frames.generated.ts", "lib/schema.ts", "lib/types.ts"],
      reporter: ["text-summary", "lcov"],
    },
  },
});
