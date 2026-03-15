import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  companyProducts,
  events,
  relevanceScores,
  trackedCompetitors,
} from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const product = await db.query.companyProducts.findFirst({
    where: eq(companyProducts.id, id),
  });
  if (!product) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const relatedEvents = await db
    .select({
      event: events,
      score: relevanceScores,
      competitor: {
        id: trackedCompetitors.id,
        name: trackedCompetitors.name,
        domain: trackedCompetitors.domain,
      },
    })
    .from(events)
    .innerJoin(relevanceScores, eq(relevanceScores.eventId, events.id))
    .innerJoin(trackedCompetitors, eq(trackedCompetitors.id, events.competitorId))
    .where(sql`${relevanceScores.matchedProducts}::jsonb ? ${product.title}`)
    .orderBy(desc(events.eventOccurredAt))
    .limit(20);

  return NextResponse.json({ product, relatedEvents });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await req.json()) as {
    title?: string;
    description?: string;
    price?: string;
    productType?: string;
    imageUrl?: string;
  };

  const [updated] = await db
    .update(companyProducts)
    .set({
      ...(body.title !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description || null }),
      ...(body.price !== undefined && { price: body.price || null }),
      ...(body.productType !== undefined && { productType: body.productType || null }),
      ...(body.imageUrl !== undefined && { imageUrl: body.imageUrl || null }),
    })
    .where(eq(companyProducts.id, id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.delete(companyProducts).where(eq(companyProducts.id, id));
  return NextResponse.json({ ok: true });
}
