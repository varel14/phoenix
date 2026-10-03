import "dotenv/config";
import { defineConfig } from "vitest/config";

// Derive the test database URL from DATABASE_URL by swapping the database name.
const baseUrl = process.env["DATABASE_URL"] ?? "postgresql://varel@localhost:5432/phoenix";
const testDatabaseUrl = (() => {
  try {
    const url = new URL(baseUrl);
    url.pathname = "/phoenix_test";
    return url.toString();
  } catch {
    return baseUrl;
  }
})();

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    // All files share one test database — parallel execution would have
    // one file's TRUNCATE wipe another file's fixtures.
    fileParallelism: false,
    testTimeout: 30000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: testDatabaseUrl,
      BETTER_AUTH_SECRET: "phoenix-test-secret-0123456789abcdef0123456789abcdef",
      BETTER_AUTH_URL: "http://localhost:4000",
      CORS_ORIGIN: "*",
      // Tests always exercise the local-disk storage fallback; the R2 path is
      // covered separately with a mocked S3 client (object-storage.test.ts).
      R2_ACCOUNT_ID: "",
      R2_ACCESS_KEY_ID: "",
      R2_SECRET_ACCESS_KEY: "",
      R2_BUCKET: "",
    },
  },
});
