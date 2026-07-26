import { defineConfig, devices } from "@playwright/test";

// Needs the local Supabase stack up and seeded:
//   npx supabase start && npm run seed
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // the specs share one seeded database
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "list" : [["list"], ["html", { open: "never" }]],
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /setup\.spec\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/aisha.json" },
      dependencies: ["setup"],
      testIgnore: /setup\.spec\.ts/,
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
