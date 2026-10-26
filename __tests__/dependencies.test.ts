import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

const databasePackages = [
  "drizzle-orm",
  "drizzle-kit",
  "prisma",
  "@prisma/client",
  "better-sqlite3",
  "sqlite3",
  "pg",
  "postgres",
  "mysql2",
];

test("package.json does not depend on a database", () => {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const names = [
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
  ];

  for (const name of databasePackages) {
    expect(names).not.toContain(name);
  }
});
