import { NextRequest, NextResponse } from "next/server";
import { listClaims } from "@/lib/repo";
import { handleClaimIntake } from "@/lib/intake";

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("org");
  if (!orgId) return NextResponse.json({ error: "org query param required" }, { status: 400 });
  return NextResponse.json({ claims: listClaims(orgId) });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const source = req.headers.get("x-claimops-source") ?? "web_form";
  const result = handleClaimIntake(body, source);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result, { status: 201 });
}
