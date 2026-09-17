import { execSync } from "node:child_process";

/**
 * Runs migrations against the test database before the suite starts.
 * The test database URL mirrors DATABASE_URL with the name "phoenix_test".
 */
export default function globalSetup() {
  const baseUrl = process.env["DATABASE_URL"] ?? "";
  const url = new URL(baseUrl);
  url.pathname = "/phoenix_test";

  // vitest runs with apps/api as cwd; use the package-local prisma shim.
  execSync("sh node_modules/.bin/prisma migrate deploy", {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: url.toString() },
    stdio: "inherit",
  });
}
