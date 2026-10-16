import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: `${process.env.PLACED_DATA_DIR ?? "./data"}/placed.db` },
});
