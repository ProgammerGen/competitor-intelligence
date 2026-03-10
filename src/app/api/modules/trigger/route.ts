import { NextRequest, NextResponse } from "next/server";
import { runModule } from "@/lib/modules";

type ModuleType = "news" | "product_launch" | "review" | "job_posting";
const VALID_MODULES: ModuleType[] = ["news", "product_launch", "review", "job_posting"];

export async function POST(req: NextRequest) {
  const { moduleType, competitorId } = (await req.json()) as {
    moduleType: ModuleType;
    competitorId?: string;
  };

  if (!VALID_MODULES.includes(moduleType)) {
    return NextResponse.json({ error: "Invalid moduleType" }, { status: 400 });
  }

  // Fire and forget — don't await so the HTTP request returns immediately
  runModule(moduleType, competitorId).catch((err) => {
    console.error(`[trigger] ${moduleType} error:`, err);
  });

  return NextResponse.json({ status: "triggered" });
}
