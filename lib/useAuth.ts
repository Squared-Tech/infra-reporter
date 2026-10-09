"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "./supabase";

export function useAuth(required?: "council", allowAnonymous?: boolean) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) {
        if (!allowAnonymous) router.replace("/login");
        setReady(true);
        return;
      }
      const { data: p } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      const r = p?.role ?? "citizen";
      const isCouncil = r === "council" || r === "admin";
      if (required === "council" && !isCouncil) {
        router.replace("/where");
        return;
      }
      setRole(r);
      setEmail(user.email ?? "");
      setReady(true);
    })();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  return { ready, role, email, logout };
}