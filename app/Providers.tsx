// app/Providers.tsx
"use client";

import { Toaster } from "react-hot-toast";
import { AuthProvider } from "./supermarket/[id]/context/AuthContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AuthProvider>{children}</AuthProvider>

      {/* Global Toaster (styled to match red/blue theme) */}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            borderRadius: "8px",
            padding: "12px 16px",
            fontSize: "14px",
            fontWeight: "500",
            color: "white",
          },
          success: {
            style: {
              background: "#2563eb", // Blue
            },
          },
          error: {
            style: {
              background: "#dc2626", // Red
            },
          },
          loading: {
            style: {
              background: "linear-gradient(to right, #dc2626, #2563eb)", // Red → Blue
            },
          },
        }}
      />
    </>
  );
}
