import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("💡 /api/pay received body:", body);

    const { email, amount, reference } = body;

    if (!email || !amount || !reference) {
      console.error("❌ Missing required fields");
      return NextResponse.json(
        { error: "Missing required fields: email, amount, reference" },
        { status: 400 }
      );
    }

    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: amount * 100, // Paystack expects kobo
        reference,
        callback_url: process.env.PAYMENT_SUCCESS_URL,
      }),
    });

    const data = await paystackRes.json();
    console.log("💡 Paystack response:", data);

    if (!paystackRes.ok) {
      console.error("❌ Paystack initialization failed:", data);
      return NextResponse.json({ error: data }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error("❌ /api/pay error:", err);
    return NextResponse.json({ error: err.message || "Unknown error" }, { status: 500 });
  }
}
