import { NextRequest, NextResponse } from "next/server";
import { handleClaimIntake } from "@/lib/intake";

/**
 * A genuinely separate, publicly reachable endpoint — once deployed, this
 * URL (https://your-app.vercel.app/api/webhooks/claims) is a real webhook
 * target you could point an external system at (e.g. a legacy claims
 * system's outbound webhook, or an email-to-webhook bridge like SendGrid
 * Inbound Parse / Mailgun Routes for the "email attachment" intake channel
 * from the original spec — those services turn an inbound email into an
 * HTTP POST, which lands here). No signature verification is implemented
 * yet, which is fine for a demo hitting it yourself but is the one thing
 * you'd add before pointing a real third party at this in production
 * (HMAC signature header, checked before handleClaimIntake runs).
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const result = await handleClaimIntake(body, "webhook");
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result, { status: 201 });
}
