import { NextRequest, NextResponse } from "next/server";
import { createOrganization, listOrganizations } from "@/lib/repo";
import { OrganizationCreateSchema } from "@/lib/validation";

export async function GET() {
  return NextResponse.json({ organizations: await listOrganizations() });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = OrganizationCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const org = await createOrganization(parsed.data);
  return NextResponse.json({ organization: org }, { status: 201 });
}
