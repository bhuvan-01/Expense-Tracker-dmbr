import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:4173",
    channel: process.env.CI ? undefined : "chrome",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node --import tsx server/index.ts",
    url: "http://127.0.0.1:4173/sign-in",
    reuseExistingServer: false,
    env: {
      PORT: "4173",
      BETTER_AUTH_URL: "http://127.0.0.1:4173",
      DATABASE_PATH: `.data/e2e-${process.pid}.sqlite`,
      E2E_TEST: "1",
    },
    timeout: 60_000,
  },
});
