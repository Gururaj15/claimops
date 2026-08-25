import { NextRequest, NextResponse } from "next/server";
import { createRule, listRules } from "@/lib/repo";
import { RuleCreateSchema } from "@/lib/validation";

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("org");
  if (!orgId) return NextResponse.json({ error: "org query param required" }, { status: 400 });
  return NextResponse.json({ rules: await listRules(orgId) });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = RuleCreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const rule = await createRule(parsed.data);
  return NextResponse.json({ rule }, { status: 201 });
}
