// app/supermarket/[id]/context/AuthContext.tsx
"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "../../../../lib/supabaseClient"; // ✅ correct path from your dir structure

// Type for the Auth context
interface AuthContextType {
  session: Session | null;
}

// Create context with default value
const AuthContext = createContext<AuthContextType>({ session: null });

// Props type for provider
interface AuthProviderProps {
  children: ReactNode;
}

// AuthProvider component
export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    // 1️⃣ Get initial session
    const getInitialSession = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error("Error fetching session:", error.message);
        return;
      }
      setSession(session ?? null);
    };

    getInitialSession();

    // 2️⃣ Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook to use auth context
export const useAuth = () => useContext(AuthContext);
