import { createApp } from "./app";
import { env } from "./config/env";
import { reportDatabaseSchema } from "./lib/schema-check";

const app = createApp();

app.listen(env.PORT, async () => {
  console.log(`API server listening on http://localhost:${env.PORT}`);
  await reportDatabaseSchema();
});
