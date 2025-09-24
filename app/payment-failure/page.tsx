"use client";

import Link from "next/link";

export default function PaymentFailurePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-red-50">
      <div className="bg-white p-8 rounded shadow-md text-center">
        <h1 className="text-3xl font-bold text-red-700 mb-4">Payment Failed ❌</h1>
        <p className="mb-4">
          Something went wrong during checkout. Please try again.
        </p>
        <Link
          href="/"
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded inline-block"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
