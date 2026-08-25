import { NextRequest, NextResponse } from "next/server";
import { deleteRule, updateRule } from "@/lib/repo";
import { z } from "zod";

const PatchSchema = z.object({
  enabled: z.boolean().optional(),
  priority: z.coerce.number().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  await updateRule(id, parsed.data);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteRule(id);
  return NextResponse.json({ ok: true });
}
