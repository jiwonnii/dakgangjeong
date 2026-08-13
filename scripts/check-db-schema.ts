import { checkDatabaseSchema, formatSchemaCheckResult } from "../src/lib/schema-check.js";

const result = await checkDatabaseSchema();

for (const line of formatSchemaCheckResult(result)) {
  console.log(line);
}

process.exit(result.status === "problems" ? 1 : 0);
