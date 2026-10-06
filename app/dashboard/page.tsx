"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const ReportMap = dynamic(() => import("@/components/ReportMap"), { ssr: false });

export default function Dashboard() {
  const [reports, setReports] = useState<any[]>([]);

  async function load() {
    const { data } = await supabase
      .from("reports")
      .select("*")
      .order("severity", { ascending: false });
    setReports(data ?? []);
  }

  async function setStatus(id: string, status: string) {
    await supabase.from("reports").update({ status }).eq("id", id);
    load();
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="max-w-4xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">Council dashboard</h1>
      <p className="text-sm text-gray-500">{reports.length} reports, ranked by severity</p>
      <ReportMap reports={reports} />

      <div className="space-y-2">
        {reports.map((r) => (
          <div key={r.id} className="border rounded p-3 flex gap-3 items-center">
            <img src={r.photo_url} className="w-20 h-20 object-cover rounded" alt="" />
            <div className="flex-1 text-sm">
              <p className="font-semibold">
                {r.category} · severity {r.severity}/5
              </p>
              <p className="text-gray-600">{r.reason}</p>
              <p>{r.suggested_action}</p>
            </div>
            <select
              value={r.status}
              onChange={(e) => setStatus(r.id, e.target.value)}
              className="border rounded p-1"
            >
              <option value="reported">Reported</option>
              <option value="in_progress">In progress</option>
              <option value="fixed">Fixed</option>
            </select>
          </div>
        ))}
      </div>
    </main>
  );
}