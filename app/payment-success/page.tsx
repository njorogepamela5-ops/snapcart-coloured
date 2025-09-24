"use client";

export default function PaymentSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-green-50">
      <div className="bg-white p-8 rounded shadow-md text-center">
        <h1 className="text-3xl font-bold text-green-700 mb-4">Payment Successful 🎉</h1>
        <p className="mb-4">Thank you for your order! Your payment has been confirmed.</p>
        <a
          href="/"
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
        >
          Back to Home
        </a>
      </div>
    </div>
  );
}
