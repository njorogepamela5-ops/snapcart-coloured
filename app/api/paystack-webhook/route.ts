import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabase } from "@/lib/supabaseClient";

// Verify webhook signature
function verifySignature(payload: string, signature: string | null) {
  if (!signature) return false;
  const hash = crypto
    .createHmac("sha512", process.env.PAYSTACK_SECRET_KEY as string)
    .update(payload)
    .digest("hex");
  return hash === signature;
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-paystack-signature");

    // Verify signature
    if (!verifySignature(rawBody, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(rawBody);

    // Log all events for debugging
    console.log("Webhook event:", event.event, event.data.reference);

    const reference = event.data.reference;
    const amount = event.data.amount / 100; // Convert back from kobo

    if (event.event === "charge.success") {
      // ✅ Update order status to "paid"
      await supabase
        .from("orders")
        .update({ status: "paid" })
        .eq("id", reference);

      console.log(`✅ Order ${reference} marked as paid (${amount})`);
    }

    if (event.event === "charge.failed") {
      await supabase
        .from("orders")
        .update({ status: "failed" })
        .eq("id", reference);

      console.log(`❌ Order ${reference} marked as failed`);
    }

    return NextResponse.json({ status: "ok" });
  } catch (err: any) {
    console.error("Webhook error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
