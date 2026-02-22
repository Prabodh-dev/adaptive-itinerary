"use client";

import { useEffect, useState } from "react";
import {
  approveAdminReport,
  getAdminReports,
  rejectAdminReport,
  type AdminReport,
} from "@/api/client";

const STORAGE_KEY = "adaptive_admin_review_key";

export default function AdminReportsPage() {
  const [adminKey, setAdminKey] = useState("");
  const [status, setStatus] = useState<"pending" | "approved" | "rejected">("pending");
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setAdminKey(stored);
  }, []);

  async function loadReports() {
    if (!adminKey.trim()) {
      setMessage("Enter admin key first.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      localStorage.setItem(STORAGE_KEY, adminKey.trim());
      const res = await getAdminReports(adminKey.trim(), status);
      setReports(res.reports);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load reports.");
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(reportId: string) {
    try {
      await approveAdminReport(adminKey.trim(), reportId);
      setMessage("Report approved.");
      await loadReports();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Approve failed.");
    }
  }

  async function handleReject(reportId: string) {
    try {
      await rejectAdminReport(adminKey.trim(), reportId, { reason: "Rejected by admin review." });
      setMessage("Report rejected.");
      await loadReports();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Reject failed.");
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 py-6">
      <section className="glass-card p-6">
        <h1 className="text-3xl">Admin Report Review</h1>
        <p className="mt-2 text-sm text-[#52695d]">Approve or reject contributor reports and trigger community signal updates.</p>
      </section>

      <section className="glass-card grid gap-4 p-5 md:grid-cols-[1fr_auto_auto_auto] md:items-end">
        <div>
          <label className="field-label">Admin Review Key</label>
          <input className="field-control" value={adminKey} onChange={(e) => setAdminKey(e.target.value)} />
        </div>
        <div>
          <label className="field-label">Status</label>
          <select className="field-control" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <button className="btn-subtle px-4 py-2 text-sm" onClick={loadReports} disabled={loading}>
          {loading ? "Loading..." : "Load Reports"}
        </button>
        <span className="text-xs text-[#5a7165]">{reports.length} reports</span>
      </section>

      {message && <p className="glass-card p-3 text-sm text-[#315241]">{message}</p>}

      <section className="glass-card p-5">
        <ul className="space-y-3">
          {reports.map((report) => (
            <li key={report.id} className="rounded-xl border border-[#cbdacb] bg-white/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">
                  {report.type} | severity {report.severity}
                </p>
                <span className="rounded bg-[#edf5f0] px-2 py-1 text-xs font-semibold">{report.status}</span>
              </div>
              <p className="mt-1 text-sm text-[#455c4f]">{report.message}</p>
              <p className="mt-1 text-xs text-[#60776b]">
                Contributor: {report.contributor.name} ({report.contributor.id}) | Trust {report.contributor.trustScore}
              </p>
              <p className="text-xs text-[#60776b]">
                Location: {report.lat.toFixed(5)}, {report.lng.toFixed(5)}
              </p>
              {report.photoUrl && (
                <a href={report.photoUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-teal-700 underline">
                  View photo
                </a>
              )}
              {status === "pending" && (
                <div className="mt-3 flex gap-2">
                  <button className="btn-brand px-3 py-1.5 text-xs" onClick={() => handleApprove(report.id)}>
                    Approve
                  </button>
                  <button className="btn-subtle px-3 py-1.5 text-xs" onClick={() => handleReject(report.id)}>
                    Reject
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
        {reports.length === 0 && <p className="text-sm text-[#5b7266]">No reports for selected status.</p>}
      </section>
    </main>
  );
}
