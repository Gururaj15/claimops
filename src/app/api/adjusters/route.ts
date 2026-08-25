import { NextRequest, NextResponse } from "next/server";
import { listAdjusters } from "@/lib/repo";

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("org");
  if (!orgId) return NextResponse.json({ error: "org query param required" }, { status: 400 });
  return NextResponse.json({ adjusters: await listAdjusters(orgId) });
}
