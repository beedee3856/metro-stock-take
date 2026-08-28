"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Users,
  Search,
  Check,
  X,
  MapPin,
  Package,
} from "lucide-react";

interface RecountItem {
  id: string;
  stockTakeId: string;
  stockTakeLocationId: string;
  itemId: string;
  itemName: string;
  itemCode: string;
  eanCode: string;
  locationCode: string;
  systemQty: number;
  originalPhysicalQty: number;
  recountPhysicalQty?: number | null;
  difference?: number | null;
  finalQuantity?: number | null;
  reason: string;
  status: string;
  notes?: string | null;
  requestedByName?: string;
  createdAt: string;
}

export function RecountsView() {
  const { user } = useAuth();
  const [recounts, setRecounts] = useState<RecountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Resolve Modal
  const [resolveRecount, setResolveRecount] = useState<RecountItem | null>(null);
  const [secondCountQty, setSecondCountQty] = useState<number | string>(0);
  const [finalQty, setFinalQty] = useState<number | string>(0);
  const [resolveNotes, setResolveNotes] = useState("");
  const [resolving, setResolving] = useState(false);

  const fetchRecounts = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/recounts?status=${statusFilter}`);
      if (res.ok) {
        const json = await res.json();
        setRecounts(json.recounts || []);
      }
    } catch (err) {
      console.error("Failed to load recounts", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecounts();
  }, [statusFilter]);

  const handleOpenResolve = (r: RecountItem) => {
    setResolveRecount(r);
    setSecondCountQty(r.originalPhysicalQty);
    setFinalQty(r.originalPhysicalQty);
    setResolveNotes("");
  };

  const handleConfirmResolve = async () => {
    if (!resolveRecount) return;

    try {
      setResolving(true);
      const res = await fetch("/api/recounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recountId: resolveRecount.id,
          recountPhysicalQty: Number(secondCountQty),
          finalQuantity: Number(finalQty),
          notes: resolveNotes,
        }),
      });

      if (res.ok) {
        setResolveRecount(null);
        fetchRecounts();
      }
    } catch (err) {
      console.error("Failed to resolve recount", err);
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Recount Verification Management</h2>
          <p className="text-xs text-slate-500">
            Audit and verify stock lines flagged for large variances, high-value discrepancies, or supervisor checks
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1 shadow-xs text-xs">
          {["ALL", "PENDING", "COMPLETED"].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`rounded-lg px-3 py-1.5 font-semibold transition-colors ${
                statusFilter === st ? "bg-rose-600 text-white" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Recounts Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
              <tr>
                <th className="px-4 py-3">Product Name</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Flag Reason</th>
                <th className="px-4 py-3">System Stock</th>
                <th className="px-4 py-3">1st Physical Count</th>
                <th className="px-4 py-3">2nd Recount</th>
                <th className="px-4 py-3">Delta / Final</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    Loading recounts...
                  </td>
                </tr>
              ) : recounts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    No recounts pending verification.
                  </td>
                </tr>
              ) : (
                recounts.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{r.itemName}</p>
                      <span className="font-mono text-[10px] text-slate-400">{r.itemCode}</span>
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-slate-700">
                      {r.locationCode}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                        {r.reason}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-900">{r.systemQty}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">{r.originalPhysicalQty}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">
                      {r.recountPhysicalQty !== null && r.recountPhysicalQty !== undefined ? (
                        r.recountPhysicalQty
                      ) : (
                        <span className="text-slate-400 italic">Pending</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.difference !== null && r.difference !== undefined ? (
                        <span
                          className={`font-bold ${
                            r.difference !== 0 ? "text-amber-600" : "text-emerald-600"
                          }`}
                        >
                          Diff: {r.difference > 0 ? `+${r.difference}` : r.difference} (Final: {r.finalQuantity})
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          r.status === "COMPLETED"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.status === "PENDING" && (
                        <button
                          onClick={() => handleOpenResolve(r)}
                          className="rounded-lg bg-rose-600 px-3 py-1 text-xs font-bold text-white shadow-xs hover:bg-rose-700"
                        >
                          Resolve Recount
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RESOLVE RECOUNT MODAL */}
      {resolveRecount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
              <RotateCcw className="h-6 w-6" />
            </div>

            <h3 className="mt-3 text-base font-bold text-slate-900">Resolve Physical Recount</h3>
            <p className="mt-1 text-xs text-slate-500">
              Product: <strong>{resolveRecount.itemName}</strong> ({resolveRecount.locationCode})
            </p>

            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs space-y-1.5 border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-600">Book System Quantity:</span>
                <strong className="text-slate-900">{resolveRecount.systemQty} units</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Initial 1st Physical Count:</span>
                <strong className="text-rose-600">{resolveRecount.originalPhysicalQty} units</strong>
              </div>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700">Enter Verified 2nd Recount Quantity *</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={secondCountQty}
                  onChange={(e) => {
                    setSecondCountQty(e.target.value);
                    setFinalQty(e.target.value);
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm font-bold text-slate-900 focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700">Final Quantity to Accept *</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={finalQty}
                  onChange={(e) => setFinalQty(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-sm font-bold text-slate-900 focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700">Recount Verification Notes</label>
                <textarea
                  rows={2}
                  value={resolveNotes}
                  onChange={(e) => setResolveNotes(e.target.value)}
                  placeholder="e.g. Stock taker recounted top pallet and confirmed 32 units..."
                  className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-rose-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResolveRecount(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmResolve}
                disabled={resolving}
                className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {resolving ? "Resolving..." : "Accept Verified Recount"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
