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
  Clock,
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

  // Send Recount Modal
  const [sendRecountItem, setSendRecountItem] = useState<RecountItem | null>(null);
  const [sendingRecount, setSendingRecount] = useState(false);

  // Accept Verified Modal
  const [acceptVerifiedItem, setAcceptVerifiedItem] = useState<RecountItem | null>(null);
  const [verificationNotes, setVerificationNotes] = useState("");
  const [acceptingVerified, setAcceptingVerified] = useState(false);

  // Approve Recount Modal
  const [approveRecountItem, setApproveRecountItem] = useState<RecountItem | null>(null);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [approvingRecount, setApprovingRecount] = useState(false);

  // Reject Recount Modal
  const [rejectRecountItem, setRejectRecountItem] = useState<RecountItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectingRecount, setRejectingRecount] = useState(false);

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

  const handleSendRecount = (r: RecountItem) => {
    setSendRecountItem(r);
  };

  const handleConfirmSendRecount = async () => {
    if (!sendRecountItem) return;

    try {
      setSendingRecount(true);
      const res = await fetch("/api/recounts/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recountId: sendRecountItem.id,
          assignedToUserId: user?.id,
          notes: "Recount sent for stock taker verification",
        }),
      });

      if (res.ok) {
        setSendRecountItem(null);
        fetchRecounts();
      }
    } catch (err) {
      console.error("Failed to send recount", err);
    } finally {
      setSendingRecount(false);
    }
  };

  const handleAcceptVerified = (r: RecountItem) => {
    setAcceptVerifiedItem(r);
    setVerificationNotes("");
  };

  const handleConfirmAcceptVerified = async () => {
    if (!acceptVerifiedItem) return;

    try {
      setAcceptingVerified(true);
      const res = await fetch("/api/recounts/accept-verified", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recountId: acceptVerifiedItem.id,
          verificationNotes,
        }),
      });

      if (res.ok) {
        setAcceptVerifiedItem(null);
        fetchRecounts();
      }
    } catch (err) {
      console.error("Failed to accept verified recount", err);
    } finally {
      setAcceptingVerified(false);
    }
  };

  const handleApproveRecount = (r: RecountItem) => {
    setApproveRecountItem(r);
    setApprovalNotes("");
  };

  const handleConfirmApprove = async () => {
    if (!approveRecountItem) return;

    try {
      setApprovingRecount(true);
      const res = await fetch("/api/recounts/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recountId: approveRecountItem.id,
          approvalNotes,
        }),
      });

      if (res.ok) {
        setApproveRecountItem(null);
        setApprovalNotes("");
        fetchRecounts();
      } else {
        const err = await res.json();
        console.error("Approval failed:", err);
      }
    } catch (err) {
      console.error("Failed to approve recount", err);
    } finally {
      setApprovingRecount(false);
    }
  };

  const handleRejectRecount = (r: RecountItem) => {
    setRejectRecountItem(r);
    setRejectionReason("");
  };

  const handleConfirmReject = async () => {
    if (!rejectRecountItem) return;

    try {
      setRejectingRecount(true);
      const res = await fetch("/api/recounts/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recountId: rejectRecountItem.id,
          rejectionReason,
        }),
      });

      if (res.ok) {
        setRejectRecountItem(null);
        setRejectionReason("");
        fetchRecounts();
      } else {
        const err = await res.json();
        console.error("Rejection failed:", err);
      }
    } catch (err) {
      console.error("Failed to reject recount", err);
    } finally {
      setRejectingRecount(false);
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
          {["ALL", "PENDING", "COMPLETED", "APPROVED"].map((st) => (
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

      {/* Auto-Complete Info Banner */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 flex gap-2">
        <Clock className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-xs font-semibold text-blue-900">Auto-Detection Active</p>
          <p className="text-xs text-blue-800">When a stock taker closes and submits a location for counting, pending recounts for that location are automatically detected and marked as COMPLETED with the counted quantities.</p>
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
                      <div className="flex flex-col gap-1">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            r.status === "APPROVED"
                              ? "bg-green-100 text-green-800"
                              : r.status === "COMPLETED" || r.status === "ACCEPTED_VERIFIED"
                              ? "bg-emerald-100 text-emerald-800"
                              : r.status === "IN_PROGRESS"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {r.status}
                        </span>
                        {r.status === "COMPLETED" && r.recountPhysicalQty !== null && r.recountPhysicalQty !== undefined && (
                          <span className="flex items-center gap-1 text-[9px] text-slate-500 italic">
                            <Clock className="h-2.5 w-2.5" />
                            Auto-detected from location
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {r.status === "PENDING" && (
                        <button
                          onClick={() => handleSendRecount(r)}
                          className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
                        >
                          Send Recount
                        </button>
                      )}
                      {r.status === "COMPLETED" && (
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => handleApproveRecount(r)}
                            className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
                          >
                            <Check className="h-3.5 w-3.5 inline mr-1" />
                            Approve
                          </button>
                          <button
                            onClick={() => handleRejectRecount(r)}
                            className="rounded-lg bg-rose-600 px-3 py-1 text-xs font-bold text-white shadow-xs hover:bg-rose-700"
                          >
                            <X className="h-3.5 w-3.5 inline mr-1" />
                            Reject
                          </button>
                        </div>
                      )}
                      {r.status === "APPROVED" && (
                        <span className="rounded-lg bg-green-100 px-3 py-1 text-xs font-bold text-green-800">
                          ✓ Approved
                        </span>
                      )}
                      {(r.status === "ASSIGNED" || r.status === "IN_PROGRESS") && (
                        <span className="text-xs text-slate-500 italic">
                          Pending Stock Taker
                        </span>
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

      {/* SEND RECOUNT MODAL */}
      {sendRecountItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
              <Users className="h-6 w-6" />
            </div>

            <h3 className="mt-3 text-base font-bold text-slate-900">Send Recount to Stock Taker</h3>
            <p className="mt-1 text-xs text-slate-500">
              Item: <strong>{sendRecountItem.itemName}</strong> ({sendRecountItem.locationCode})
            </p>

            <div className="mt-4 rounded-xl bg-blue-50 p-3 text-xs border border-blue-200">
              <p className="text-slate-700">
                This item will be sent to the stock taker for physical verification and recount. They will be notified immediately.
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSendRecountItem(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSendRecount}
                disabled={sendingRecount}
                className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {sendingRecount ? "Sending..." : "Send Recount"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACCEPT VERIFIED MODAL */}
      {acceptVerifiedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>

            <h3 className="mt-3 text-base font-bold text-slate-900">Accept Verified Recount</h3>
            <p className="mt-1 text-xs text-slate-500">
              Item: <strong>{acceptVerifiedItem.itemName}</strong> ({acceptVerifiedItem.locationCode})
            </p>

            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs space-y-1.5 border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-600">System Quantity:</span>
                <strong className="text-slate-900">{acceptVerifiedItem.systemQty} units</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Recount Result:</span>
                <strong className="text-emerald-600">{acceptVerifiedItem.recountPhysicalQty} units</strong>
              </div>
              <div className="flex justify-between border-t pt-1.5 mt-1.5">
                <span className="text-slate-600">Variance:</span>
                <strong className={acceptVerifiedItem.recountPhysicalQty && acceptVerifiedItem.recountPhysicalQty > acceptVerifiedItem.systemQty ? "text-emerald-600" : "text-rose-600"}>
                  {acceptVerifiedItem.recountPhysicalQty && acceptVerifiedItem.recountPhysicalQty > acceptVerifiedItem.systemQty ? `+${(acceptVerifiedItem.recountPhysicalQty - acceptVerifiedItem.systemQty)}` : acceptVerifiedItem.recountPhysicalQty ? `-${(acceptVerifiedItem.systemQty - acceptVerifiedItem.recountPhysicalQty)}` : "0"}
                </strong>
              </div>
            </div>

            <div className="mt-4">
              <label className="block font-semibold text-slate-700 text-xs">Verification Notes (Optional)</label>
              <textarea
                rows={2}
                value={verificationNotes}
                onChange={(e) => setVerificationNotes(e.target.value)}
                placeholder="e.g. Variance confirmed and accepted due to inventory adjustment..."
                className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-hidden"
              />
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAcceptVerifiedItem(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAcceptVerified}
                disabled={acceptingVerified}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {acceptingVerified ? "Accepting..." : "Accept Verified"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* APPROVE RECOUNT MODAL */}
      {approveRecountItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>

            <h3 className="mt-3 text-base font-bold text-slate-900">Approve Recount</h3>
            <p className="mt-1 text-xs text-slate-500">
              Item: <strong>{approveRecountItem.itemName}</strong> ({approveRecountItem.locationCode})
            </p>

            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs space-y-1.5 border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-600">System Quantity:</span>
                <strong className="text-slate-900">{approveRecountItem.systemQty} units</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">1st Count:</span>
                <strong className="text-slate-900">{approveRecountItem.originalPhysicalQty} units</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">2nd Recount:</span>
                <strong className="text-emerald-600">{approveRecountItem.recountPhysicalQty} units</strong>
              </div>
              <div className="flex justify-between border-t pt-1.5 mt-1.5">
                <span className="text-slate-600">Final Quantity:</span>
                <strong className="text-emerald-700">{approveRecountItem.finalQuantity} units</strong>
              </div>
            </div>

            <div className="mt-4 rounded-lg bg-emerald-50 p-2.5 border border-emerald-200 text-xs text-emerald-900">
              <p className="font-semibold">✓ Ready to approve</p>
              <p className="text-emerald-800 mt-1">The recount has been completed and verified by the stock taker.</p>
            </div>

            <div className="mt-4">
              <label className="block font-semibold text-slate-700 text-xs">Approval Notes (Optional)</label>
              <textarea
                rows={2}
                value={approvalNotes}
                onChange={(e) => setApprovalNotes(e.target.value)}
                placeholder="e.g. Recount verified and approved. Final count accepted..."
                className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-hidden"
              />
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setApproveRecountItem(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmApprove}
                disabled={approvingRecount}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {approvingRecount ? "Approving..." : "Approve Recount"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT RECOUNT MODAL */}
      {rejectRecountItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
              <AlertTriangle className="h-6 w-6" />
            </div>

            <h3 className="mt-3 text-base font-bold text-slate-900">Reject & Resend Recount</h3>
            <p className="mt-1 text-xs text-slate-500">
              Item: <strong>{rejectRecountItem.itemName}</strong> ({rejectRecountItem.locationCode})
            </p>

            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs space-y-1.5 border border-slate-200">
              <div className="flex justify-between">
                <span className="text-slate-600">System Quantity:</span>
                <strong className="text-slate-900">{rejectRecountItem.systemQty} units</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">1st Count:</span>
                <strong className="text-slate-900">{rejectRecountItem.originalPhysicalQty} units</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">2nd Recount:</span>
                <strong className="text-rose-600">{rejectRecountItem.recountPhysicalQty} units</strong>
              </div>
            </div>

            <div className="mt-4 rounded-lg bg-rose-50 p-2.5 border border-rose-200 text-xs text-rose-900">
              <p className="font-semibold">⚠ This recount will be rejected</p>
              <p className="text-rose-800 mt-1">It will be sent back to the stock taker for re-verification.</p>
            </div>

            <div className="mt-4">
              <label className="block font-semibold text-slate-700 text-xs">Reason for Rejection *</label>
              <textarea
                rows={3}
                required
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Count appears incorrect based on system records. Please recount carefully and verify the physical inventory..."
                className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-rose-500 focus:outline-hidden"
              />
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectRecountItem(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={rejectingRecount || !rejectionReason.trim()}
                className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {rejectingRecount ? "Rejecting..." : "Reject & Resend"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
