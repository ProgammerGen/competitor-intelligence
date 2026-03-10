import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { runModule } from "@/lib/modules";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001";
const MODULES = ["news", "product_launch", "review", "job_posting"] as const;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db.insert(users).values({ id: DEFAULT_USER_ID }).onConflictDoNothing();

  for (const moduleType of MODULES) {
    await runModule(moduleType).catch((err) =>
      console.error(`[cron] ${moduleType} error:`, err)
    );
  }

  return NextResponse.json({ ok: true, ran: MODULES });
}
