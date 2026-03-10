import "dotenv/config";
import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { initScheduler } from "./src/jobs/scheduler";
import { db } from "./src/lib/db";
import { users } from "./src/lib/db/schema";

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001";

app.prepare().then(async () => {
  // Seed the single user row
  await db
    .insert(users)
    .values({ id: DEFAULT_USER_ID })
    .onConflictDoNothing();

  const server = createServer((req, res) => {
    handle(req, res, parse(req.url!, true));
  });

  const port = parseInt(process.env.PORT ?? "3000", 10);
  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
    initScheduler();
  });
});
