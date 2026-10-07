"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";

export default function Home() {
  const { ready, role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    router.replace(role === "council" ? "/dashboard" : "/report");
  }, [ready, role, router]);

  if (!ready) return <p className="p-6 text-center text-gray-500">Loading...</p>;
  return null;
}
