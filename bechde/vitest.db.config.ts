import { defineConfig } from "vitest/config";

// The RLS suite talks to the local Supabase stack, so it needs a running database
// and must not run in parallel with itself (the tests share seeded rows).
export default defineConfig({
  test: {
    include: ["supabase/tests/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
