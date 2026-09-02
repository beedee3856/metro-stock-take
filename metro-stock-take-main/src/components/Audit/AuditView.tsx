"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  ShieldCheck,
  Search,
  Filter,
  Clock,
  User,
  Activity,
  FileCode,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

interface AuditLogEntry {
  id: string;
  userId?: string | null;
  userName: string;
  userRole?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  previousValue?: string | null;
  newValue?: string | null;
  ipAddress?: string | null;
  reason?: string | null;
  createdAt: string;
}

export function AuditView() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        action: actionFilter,
        query: searchQuery,
      });
      const res = await fetch(`/api/audit-logs?${params}`);
      if (res.ok) {
        const json = await res.json();
        setLogs(json.logs || []);
      }
    } catch (err) {
      console.error("Failed to load audit logs", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900">Immutable Audit Trail & Compliance Log</h2>
        <p className="text-xs text-slate-500">
          Permanent chronological log of all stock count entries, supervisor overrides, recounts, and finalizations
        </p>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by User, Action, or Reason..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-xs text-slate-800 focus:border-rose-500 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <label className="text-slate-500 font-semibold">Action:</label>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:border-rose-500"
          >
            <option value="ALL">All Recorded Actions</option>
            <option value="LOGIN">User Logins</option>
            <option value="COUNT_ENTRY">Count Entries</option>
            <option value="COUNT_EDIT">Count Edits</option>
            <option value="RECOUNT_REQUESTED">Recount Requests</option>
            <option value="LOCATION_COUNT_APPROVED">Approvals</option>
            <option value="FINALIZE_STOCK_TAKE">Finalizations</option>
          </select>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity Type</th>
                <th className="px-4 py-3">Reason / Details</th>
                <th className="px-4 py-3 text-right">Inspection</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Loading audit trail from PostgreSQL...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No matching audit records found.
                  </td>
                </tr>
              ) : (
                logs.map((l) => {
                  const isExpanded = expandedId === l.id;
                  return (
                    <React.Fragment key={l.id}>
                      <tr className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                          {new Date(l.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {l.userName}
                          {l.userRole && (
                            <span className="block text-[10px] text-slate-400 font-normal">
                              {l.userRole}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-mono font-bold text-slate-800">
                            {l.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{l.entityType}</td>
                        <td className="px-4 py-3 text-slate-700 max-w-xs truncate">
                          {l.reason || "-"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : l.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            <span>{isExpanded ? "Hide" : "Diff"}</span>
                            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable JSON Diff Row */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90 border-b border-slate-100">
                          <td colSpan={6} className="px-6 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                              <div>
                                <span className="font-bold text-slate-700 block mb-1">
                                  Previous Value (State Before):
                                </span>
                                <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl overflow-x-auto text-[11px] max-h-40">
                                  {l.previousValue
                                    ? JSON.stringify(JSON.parse(l.previousValue), null, 2)
                                    : "(None - New Record)"}
                                </pre>
                              </div>
                              <div>
                                <span className="font-bold text-slate-700 block mb-1">
                                  New Value (State After):
                                </span>
                                <pre className="p-3 bg-slate-900 text-emerald-300 rounded-xl overflow-x-auto text-[11px] max-h-40">
                                  {l.newValue ? JSON.stringify(JSON.parse(l.newValue), null, 2) : "(None)"}
                                </pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
