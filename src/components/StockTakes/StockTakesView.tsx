"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  ClipboardList,
  Plus,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  RotateCcw,
  Download,
  Users,
  MapPin,
  FileSpreadsheet,
  FileText,
  Clock,
  EyeOff,
  ShieldCheck,
  X,
  Search,
  Check,
  ChevronRight,
  Filter,
} from "lucide-react";
import { exportToExcel, exportDetailedPDF } from "@/lib/exportUtils";

interface StockTake {
  id: string;
  stockTakeNumber: string;
  name: string;
  type: string;
  status: string;
  startDate: string;
  plannedEndDate?: string | null;
  notes?: string | null;
  isBlindCount: boolean;
  require100Percent: boolean;
  twoPersonControl: boolean;
  isLocked: boolean;
  storeName?: string | null;
  storeId?: string | null;
  totalLocations: number;
  completedLocations: number;
  inProgressLocations: number;
  pendingLocations: number;
  totalExpected: number;
  totalCounted: number;
  progressPercentage: number;
}

interface StockTakeLocation {
  id: string;
  stockTakeId: string;
  locationId: string;
  locationCode: string;
  locationName: string;
  departmentName?: string;
  status: string;
  assignedUserId?: string;
  assignedUserName?: string;
  expectedItemsCount: number;
  countedItemsCount: number;
  notes?: string;
}

interface StockCountRow {
  id: string;
  itemId: string;
  itemName?: string;
  itemCode?: string;
  eanCode?: string;
  systemQuantity: number | null;
  physicalQuantity: number;
  varianceQuantity: number | null;
  costPrice: string;
  varianceValue: string | null;
  variancePercentage: string | null;
  countStatus: string;
  countedBy?: string;
  createdAt: string;
  locationCode?: string;
}

export function StockTakesView() {
  const { user } = useAuth();
  const [stockTakes, setStockTakes] = useState<StockTake[]>([]);
  const [selectedST, setSelectedST] = useState<StockTake | null>(null);
  const [loading, setLoading] = useState(true);

  // Tabs in detailed session
  const [activeTab, setActiveTab] = useState<
    "overview" | "locations" | "counts" | "variances" | "recounts" | "finalization" | "reports"
  >("overview");

  // Detailed session data
  const [stLocations, setStLocations] = useState<StockTakeLocation[]>([]);
  const [stCounts, setStCounts] = useState<StockCountRow[]>([]);
  const [stStats, setStStats] = useState<Record<string, unknown> | null>(null);
  const [selectedCountIds, setSelectedCountIds] = useState<string[]>([]);
  const [deletingCounts, setDeletingCounts] = useState(false);
  const [deletingSession, setDeletingSession] = useState<string | null>(null);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [activeLocationToAssign, setActiveLocationToAssign] = useState<StockTakeLocation | null>(null);
  const [allStockTakers, setAllStockTakers] = useState<{ id: string; fullName: string }[]>([]);
  const [selectedTakerId, setSelectedTakerId] = useState("");
  const [quickAssignLocationId, setQuickAssignLocationId] = useState("");
  const [quickAssignTakerId, setQuickAssignTakerId] = useState("");

  const [finalizeModalOpen, setFinalizeModalOpen] = useState(false);
  const [generateAdjustments, setGenerateAdjustments] = useState(true);

  const [unlockModalOpen, setUnlockModalOpen] = useState(false);
  const [unlockReason, setUnlockReason] = useState("");

  // New stock take form
  const [newSTName, setNewSTName] = useState("");
  const [newSTType, setNewSTType] = useState("FULL");
  const [newSTStoreId, setNewSTStoreId] = useState("");
  const [newSTStoreName, setNewSTStoreName] = useState("");
  const [availableStores, setAvailableStores] = useState<{ id: string; name: string; code: string }[]>([]);
  const [newSTBlind, setNewSTBlind] = useState(false);
  const [newST100Pct, setNewST100Pct] = useState(true);
  const [newSTNotes, setNewSTNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Fetch list of stock takes
  const fetchStockTakes = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/stock-takes");
      if (res.ok) {
        const json = await res.json();
        setStockTakes(json.stockTakes || []);
      }
    } catch (err) {
      console.error("Failed to load stock takes", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch stores for creation dropdown
  useEffect(() => {
    fetchStockTakes();
    fetch("/api/stores")
      .then((r) => r.json())
      .then((data) => {
        if (data.stores) {
          setAvailableStores(data.stores);
          if (data.stores.length > 0) {
            setNewSTStoreId(data.stores[0].id);
          }
        }
      })
      .catch(() => {});
    // Fetch users for assignment dropdown
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => {
        if (data.users) {
          const takers = data.users.filter((u: { role: string }) =>
            ["STOCK_TAKER", "SUPERVISOR"].includes(u.role)
          );
          setAllStockTakers(takers);
        }
      })
      .catch(() => {});
  }, [fetchStockTakes]);

  useEffect(() => {
    if (quickAssignLocationId && !stLocations.some((loc) => loc.id === quickAssignLocationId && !loc.assignedUserId)) {
      setQuickAssignLocationId("");
    }
  }, [quickAssignLocationId, stLocations]);

  // Load detailed stock take when selected
  const fetchSessionDetails = useCallback(async (stId: string) => {
    try {
      const res = await fetch(`/api/stock-takes/${stId}`);
      if (res.ok) {
        const json = await res.json();
        setStLocations(json.locations || []);
        setStStats(json.stats || {});
      }

      // Fetch count lines
      const countRes = await fetch(`/api/stock-counts?stockTakeId=${stId}`);
      if (countRes.ok) {
        const countJson = await countRes.json();
        setStCounts(countJson.counts || []);
      }
    } catch (err) {
      console.error("Failed to load session details", err);
    }
  }, []);

  useEffect(() => {
    if (selectedST) {
      fetchSessionDetails(selectedST.id);
    }
  }, [selectedST, fetchSessionDetails]);

  // Handle action buttons: Start, Pause, Resume, Lock, Unlock, Finalize
  const handleSessionAction = async (action: string, reason?: string) => {
    if (!selectedST) return;
    try {
      const res = await fetch(`/api/stock-takes/${selectedST.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      if (res.ok) {
        fetchStockTakes();
        fetchSessionDetails(selectedST.id);
        setUnlockModalOpen(false);
        setUnlockReason("");
      }
    } catch (err) {
      console.error("Session action error", err);
    }
  };

  // Create Stock Take
  const handleCreateStockTake = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    if (!newSTName.trim()) {
      setCreateError("Session Name is required.");
      return;
    }

    try {
      setCreating(true);
      const res = await fetch("/api/stock-takes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSTName.trim(),
          storeId: newSTStoreId || undefined,
          storeName: newSTStoreName.trim() || undefined,
          type: newSTType,
          isBlindCount: newSTBlind,
          require100Percent: newST100Pct,
          notes: newSTNotes,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setCreateModalOpen(false);
        setNewSTName("");
        setNewSTNotes("");
        const refreshed = await fetch("/api/stock-takes");
        const refreshedJson = await refreshed.json();
        const refreshedSessions = refreshedJson.stockTakes || [];
        setStockTakes(refreshedSessions);
        const createdSession = refreshedSessions.find((session: StockTake) => session.id === json.stockTake?.id);
        if (createdSession) setSelectedST(createdSession);
      } else {
        setCreateError(json.error || "Unable to create stock-take session.");
      }
    } catch (err) {
      console.error("Failed to create stock take", err);
      setCreateError("Network error while creating the stock-take session.");
    } finally {
      setCreating(false);
    }
  };

  // Assign Stock Taker to Location
  const handleAssignTaker = async () => {
    if (!selectedST || !activeLocationToAssign) return;

    try {
      const res = await fetch(`/api/stock-takes/${selectedST.id}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stockTakeLocationId: activeLocationToAssign.id,
          assignedUserId: selectedTakerId || null,
        }),
      });

      if (res.ok) {
        setAssignModalOpen(false);
        fetchSessionDetails(selectedST.id);
      }
    } catch (err) {
      console.error("Failed to assign staff", err);
    }
  };

  const toggleCountSelection = (id: string) => {
    setSelectedCountIds((prev) =>
      prev.includes(id) ? prev.filter((countId) => countId !== id) : [...prev, id]
    );
  };

  const handleDeleteCounts = async (ids?: string[]) => {
    if (!selectedST) return;
    const countIds = ids && ids.length > 0 ? ids : selectedCountIds;
    if (countIds.length === 0) return;

    try {
      setDeletingCounts(true);
      const res = await fetch("/api/stock-counts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countIds, stockTakeId: selectedST.id }),
      });

      if (res.ok) {
        const updated = selectedCountIds.filter((id) => !countIds.includes(id));
        setSelectedCountIds(updated);
        fetchSessionDetails(selectedST.id);
      }
    } catch (err) {
      console.error("Failed to delete stock counts", err);
    } finally {
      setDeletingCounts(false);
    }
  };

  const handleDeleteSession = async (stockTakeId: string) => {
    if (!stockTakeId) return;

    const confirmed = window.confirm("Delete this stock take session? This cannot be undone.");
    if (!confirmed) return;

    try {
      setDeletingSession(stockTakeId);
      const res = await fetch("/api/stock-takes", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stockTakeId }),
      });

      if (res.ok) {
        setSelectedST(null);
        fetchStockTakes();
      }
    } catch (err) {
      console.error("Failed to delete stock take", err);
    } finally {
      setDeletingSession(null);
    }
  };

  const handleQuickAssignLocation = async () => {
    if (!selectedST || !quickAssignLocationId) return;

    try {
      const res = await fetch(`/api/stock-takes/${selectedST.id}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stockTakeLocationId: quickAssignLocationId,
          assignedUserId: quickAssignTakerId || null,
        }),
      });

      if (res.ok) {
        setQuickAssignLocationId("");
        setQuickAssignTakerId("");
        fetchSessionDetails(selectedST.id);
      }
    } catch (err) {
      console.error("Failed to assign stock taker to location", err);
    }
  };

  // Finalize Stock Take
  const handleFinalize = async () => {
    if (!selectedST) return;

    try {
      const res = await fetch(`/api/stock-takes/${selectedST.id}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generateAdjustments, overrideIncomplete: true }),
      });

      if (res.ok) {
        setFinalizeModalOpen(false);
        fetchStockTakes();
        fetchSessionDetails(selectedST.id);
      }
    } catch (err) {
      console.error("Finalize error", err);
    }
  };

  // Location count approval / rejection by supervisor
  const handleLocationReview = async (locationId: string, action: "APPROVE" | "REJECT") => {
    try {
      const res = await fetch(`/api/stock-take-locations/${locationId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok && selectedST) {
        fetchSessionDetails(selectedST.id);
      }
    } catch (err) {
      console.error("Review location error", err);
    }
  };

  // Export handlers
  const handleExportExcel = () => {
    if (!selectedST) return;
    const rows = stCounts.map((c) => ({
      "Stock Take No": selectedST.stockTakeNumber,
      "Location": c.locationCode,
      "Item Name": c.itemName,
      "Item Code": c.itemCode,
      "EAN": c.eanCode,
      "System Qty": c.systemQuantity,
      "Physical Qty": c.physicalQuantity,
      "Variance Qty": c.varianceQuantity,
      "Cost Price": c.costPrice,
      "Variance Value": c.varianceValue,
      "Counted By": c.countedBy,
      "Status": c.countStatus,
      "Count Date": new Date(c.createdAt).toLocaleDateString(),
    }));
    exportToExcel(rows, `${selectedST.stockTakeNumber}-Detailed-Counts`);
  };

  const handleExportPDF = () => {
    if (!selectedST) return;
    const columns = ["Location", "Item Name", "Item Code", "System", "Physical", "Variance", "Cost (Ksh)", "Value (Ksh)", "Status"];
    const rows = stCounts.map((c) => [
      c.locationCode || "",
      c.itemName || "",
      c.itemCode || "",
      c.systemQuantity !== null ? String(c.systemQuantity) : "N/A",
      String(c.physicalQuantity),
      c.varianceQuantity !== null ? String(c.varianceQuantity) : "N/A",
      `Ksh ${c.costPrice}`,
      c.varianceValue ? `Ksh ${c.varianceValue}` : "Ksh 0.00",
      c.countStatus,
    ]);

    exportDetailedPDF({
      title: "Stock Taking Comprehensive Audit Report",
      stockTakeNumber: selectedST.stockTakeNumber,
      storeName: selectedST.storeName || "All branches",
      date: new Date(selectedST.startDate).toLocaleDateString(),
      status: selectedST.status,
      preparedBy: user?.fullName || "Stock Audit Admin",
      columns,
      rows,
      fileName: `${selectedST.stockTakeNumber}-Stock-Take-Report`,
    });
  };

  return (
    <div className="space-y-6">
      {/* If No Session Selected: Show List of Stock Takes */}
      {!selectedST ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Stock-Taking Sessions</h2>
              <p className="text-xs text-slate-500">
                Plan, monitor, control, review and reconcile physical supermarket counts
              </p>
            </div>

            {(user?.role === "ADMINISTRATOR" || user?.role === "SUPERVISOR") && (
              <button
                onClick={() => setCreateModalOpen(true)}
                className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 active:scale-98 transition-all"
              >
                <Plus className="h-4 w-4" />
                <span>Create Stock Take</span>
              </button>
            )}
          </div>

          {/* Stock Takes Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                  <tr>
                    <th className="px-4 py-3.5">Session Reference</th>
                    <th className="px-4 py-3.5">Session Name</th>
                    <th className="px-4 py-3.5">Store</th>
                    <th className="px-4 py-3.5">Type</th>
                    <th className="px-4 py-3.5">Start Date</th>
                    <th className="px-4 py-3.5">Counting Progress</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stockTakes.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No stock-taking sessions found.
                      </td>
                    </tr>
                  ) : (
                    stockTakes.map((st) => (
                      <tr key={st.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-4 py-3.5 font-mono font-bold text-slate-900">
                          {st.stockTakeNumber}
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-semibold text-slate-900">{st.name}</p>
                          {st.isBlindCount && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                              <EyeOff className="h-3 w-3" /> Blind Count
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-slate-700">{st.storeName || "All branches"}</td>
                        <td className="px-4 py-3.5">
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                            {st.type}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-500">
                          {new Date(st.startDate).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="w-36 space-y-1">
                            <div className="flex justify-between text-[11px]">
                              <span>{st.totalCounted}/{st.totalExpected}</span>
                              <span className="font-bold text-rose-600">{st.progressPercentage}%</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-rose-600"
                                style={{ width: `${st.progressPercentage}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                              st.status === "FINALIZED"
                                ? "bg-emerald-100 text-emerald-800"
                                : st.status === "IN_PROGRESS"
                                ? "bg-amber-100 text-amber-800"
                                : st.status === "LOCKED"
                                ? "bg-slate-200 text-slate-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {st.status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setSelectedST(st)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 shadow-xs hover:bg-rose-50"
                            >
                              <span>Open Details</span>
                              <ChevronRight className="h-3.5 w-3.5" />
                            </button>

                            {(user?.role === "ADMINISTRATOR" || user?.role === "SUPERVISOR") && (
                              <button
                                onClick={() => handleDeleteSession(st.id)}
                                disabled={deletingSession === st.id}
                                className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[10px] font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                              >
                                {deletingSession === st.id ? "Deleting..." : "Delete"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* DETAILED STOCK TAKE VIEW (Header, Controls & Tabs) */
        <div className="space-y-5">
          {/* Back Button & Header */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSelectedST(null)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              ← Back to All Stock Takes
            </button>

            {/* Session Control Buttons (Requirement 25) */}
            <div className="flex flex-wrap items-center gap-2">
              {selectedST.status === "PLANNED" && (
                <button
                  onClick={() => handleSessionAction("START")}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs"
                >
                  <Play className="h-3.5 w-3.5" />
                  <span>Start Counting</span>
                </button>
              )}

              {selectedST.status === "IN_PROGRESS" && (
                <button
                  onClick={() => handleSessionAction("PAUSE")}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Pause className="h-3.5 w-3.5" />
                  <span>Pause Session</span>
                </button>
              )}

              {selectedST.status === "REVIEW" && (
                <button
                  onClick={() => handleSessionAction("RESUME")}
                  className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                >
                  <Play className="h-3.5 w-3.5" />
                  <span>Resume Session</span>
                </button>
              )}

              {/* Lock / Unlock */}
              {selectedST.isLocked ? (
                <button
                  onClick={() => setUnlockModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100"
                >
                  <Unlock className="h-3.5 w-3.5" />
                  <span>Unlock Session</span>
                </button>
              ) : (
                <button
                  onClick={() => handleSessionAction("LOCK")}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Lock className="h-3.5 w-3.5" />
                  <span>Lock Session</span>
                </button>
              )}

              {/* Finalize Button */}
              {selectedST.status !== "FINALIZED" && user?.role === "ADMINISTRATOR" && (
                <button
                  onClick={() => setFinalizeModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-700"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Finalize Stock Take</span>
                </button>
              )}

              {(user?.role === "ADMINISTRATOR" || user?.role === "SUPERVISOR") && (
                <button
                  onClick={() => handleDeleteSession(selectedST.id)}
                  disabled={deletingSession === selectedST.id}
                  className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>{deletingSession === selectedST.id ? "Deleting..." : "Delete Session"}</span>
                </button>
              )}
            </div>
          </div>

          {/* Session Banner */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {selectedST.stockTakeNumber}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      selectedST.status === "FINALIZED"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-rose-100 text-rose-800"
                    }`}
                  >
                    {selectedST.status}
                  </span>
                  {selectedST.isLocked && (
                    <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-800">
                      <Lock className="h-3 w-3" /> Locked
                    </span>
                  )}
                </div>
                <h1 className="mt-1 text-2xl font-bold text-slate-900">{selectedST.name}</h1>
                <p className="text-xs text-slate-500">
                  Store: {selectedST.storeName} | Type: {selectedST.type} | Started:{" "}
                  {new Date(selectedST.startDate).toLocaleDateString()}
                </p>
              </div>

              {/* Fast Export Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportExcel}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  <span>Export Excel (.xlsx)</span>
                </button>
                <button
                  onClick={handleExportPDF}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
                >
                  <FileText className="h-4 w-4 text-rose-600" />
                  <span>Download PDF</span>
                </button>
              </div>
            </div>

            {/* Quick Assignment Card */}
            {(user?.role === "ADMINISTRATOR" || user?.role === "SUPERVISOR") && (
              <div className="mt-6 rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-50 to-white p-4 shadow-xs">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-rose-600">
                      Quick assignment
                    </p>
                    <h3 className="mt-1 text-sm font-bold text-slate-900">
                      Assign a stock taker to any unassigned location
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.08em] text-slate-600">
                        Location
                      </label>
                      <select
                        value={quickAssignLocationId}
                        onChange={(e) => setQuickAssignLocationId(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-rose-500 focus:outline-hidden"
                      >
                        <option value="">Select a location</option>
                        {stLocations
                          .filter((loc) => !loc.assignedUserId)
                          .map((loc) => (
                            <option key={loc.id} value={loc.id}>
                              {loc.locationCode} — {loc.locationName}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.08em] text-slate-600">
                        Stock taker
                      </label>
                      <select
                        value={quickAssignTakerId}
                        onChange={(e) => setQuickAssignTakerId(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-rose-500 focus:outline-hidden"
                      >
                        <option value="">Unassigned</option>
                        {allStockTakers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.fullName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={handleQuickAssignLocation}
                        disabled={!quickAssignLocationId}
                        className="w-full rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Assign Staff
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Sub Tabs */}
            <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
              {[
                { key: "overview", label: "Overview & Metrics" },
                { key: "locations", label: `Locations & Staff (${stLocations.length})` },
                { key: "counts", label: `Count Lines (${stCounts.length})` },
                { key: "variances", label: "Variances Analysis" },
                { key: "finalization", label: "Finalization & Adjustments" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
                    activeTab === tab.key
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* TAB 1: OVERVIEW */}
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <p className="text-xs font-bold text-slate-500 uppercase">Items Counted</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{stCounts.length}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Target expected: {selectedST.totalExpected} units
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <p className="text-xs font-bold text-slate-500 uppercase">Aisles & Locations</p>
                <p className="mt-2 text-3xl font-bold text-slate-900">{stLocations.length}</p>
                <p className="mt-1 text-xs text-emerald-600 font-semibold">
                  {stLocations.filter((l) => ["SUBMITTED", "APPROVED"].includes(l.status)).length} submitted
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                <p className="text-xs font-bold text-slate-500 uppercase">Variances Detected</p>
                <p className="mt-2 text-3xl font-bold text-rose-600">
                  {stCounts.filter((c) => c.varianceQuantity !== 0).length} items
                </p>
                <p className="mt-1 text-xs text-slate-500">Requiring review or adjustment</p>
              </div>
            </div>
          )}

          {/* TAB 2: LOCATIONS & ASSIGNMENTS (Requirement 12 & 45) */}
          {activeTab === "locations" && (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 p-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Stock Take Locations & Staff Assignments</h3>
                  <p className="text-xs text-slate-500">Control which stock taker counts which aisle</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                    <tr>
                      <th className="px-4 py-3">Location Code</th>
                      <th className="px-4 py-3">Location Name</th>
                      <th className="px-4 py-3">Assigned Stock Taker</th>
                      <th className="px-4 py-3">Expected Items</th>
                      <th className="px-4 py-3">Counted Items</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stLocations.map((loc) => (
                      <tr key={loc.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">
                          {loc.locationCode}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">{loc.locationName}</td>
                        <td className="px-4 py-3">
                          {loc.assignedUserName ? (
                            <span className="font-semibold text-slate-900">{loc.assignedUserName}</span>
                          ) : (
                            <span className="rounded bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                              Unassigned
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium">{loc.expectedItemsCount}</td>
                        <td className="px-4 py-3 font-bold text-emerald-600">
                          {loc.countedItemsCount}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                              loc.status === "APPROVED"
                                ? "bg-emerald-100 text-emerald-800"
                                : loc.status === "SUBMITTED"
                                ? "bg-amber-100 text-amber-800"
                                : loc.status === "RECOUNT_REQUIRED"
                                ? "bg-rose-100 text-rose-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {loc.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Reassign button */}
                            {(user?.role === "ADMINISTRATOR" || user?.role === "SUPERVISOR") && (
                              <button
                                onClick={() => {
                                  setActiveLocationToAssign(loc);
                                  setSelectedTakerId(loc.assignedUserId || "");
                                  setAssignModalOpen(true);
                                }}
                                className="rounded-lg border border-slate-200 px-2.5 py-1 text-slate-700 hover:bg-slate-100 font-semibold"
                              >
                                Reassign
                              </button>
                            )}

                            {/* Supervisor Approve / Reject */}
                            {loc.status === "SUBMITTED" &&
                              (user?.role === "SUPERVISOR" || user?.role === "ADMINISTRATOR") && (
                                <>
                                  <button
                                    onClick={() => handleLocationReview(loc.id, "APPROVE")}
                                    className="rounded-lg bg-emerald-600 px-2.5 py-1 text-white font-bold hover:bg-emerald-700"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => handleLocationReview(loc.id, "REJECT")}
                                    className="rounded-lg bg-rose-50 text-rose-700 px-2.5 py-1 font-semibold hover:bg-rose-100"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: COUNT LINES (Requirement 46) */}
          {activeTab === "counts" && (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 p-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Count Lines</h3>
                  <p className="text-xs text-slate-500">Select rows to delete one or many count entries</p>
                </div>
                {(user?.role === "ADMINISTRATOR" || user?.role === "SUPERVISOR") && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedCountIds([])}
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Clear Selection
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCounts()}
                      disabled={selectedCountIds.length === 0 || deletingCounts}
                      className="rounded-lg bg-rose-600 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {deletingCounts ? "Deleting..." : `Delete Selected (${selectedCountIds.length})`}
                    </button>
                  </div>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                    <tr>
                      {(user?.role === "ADMINISTRATOR" || user?.role === "SUPERVISOR") && (
                        <th className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={stCounts.length > 0 && selectedCountIds.length === stCounts.length}
                            onChange={() =>
                              setSelectedCountIds(
                                selectedCountIds.length === stCounts.length ? [] : stCounts.map((c) => c.id)
                              )
                            }
                            className="h-3.5 w-3.5 rounded border-slate-300 text-rose-600"
                          />
                        </th>
                      )}
                      <th className="px-4 py-3">Location</th>
                      <th className="px-4 py-3">Product Name</th>
                      <th className="px-4 py-3">Item Code</th>
                      <th className="px-4 py-3">EAN Code</th>
                      <th className="px-4 py-3">System Qty</th>
                      <th className="px-4 py-3">Physical Qty</th>
                      <th className="px-4 py-3">Variance</th>
                      <th className="px-4 py-3">Variance Value</th>
                      <th className="px-4 py-3">Stock Taker</th>
                      <th className="px-4 py-3">Status</th>
                      {(user?.role === "ADMINISTRATOR" || user?.role === "SUPERVISOR") && (
                        <th className="px-4 py-3 text-right">Action</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stCounts.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-8 text-center text-slate-400">
                          No count lines recorded yet.
                        </td>
                      </tr>
                    ) : (
                      stCounts.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50">
                          {(user?.role === "ADMINISTRATOR" || user?.role === "SUPERVISOR") && (
                            <td className="px-4 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={selectedCountIds.includes(c.id)}
                                onChange={() => toggleCountSelection(c.id)}
                                className="h-3.5 w-3.5 rounded border-slate-300 text-rose-600"
                              />
                            </td>
                          )}
                          <td className="px-4 py-3 font-mono font-semibold">{c.locationCode}</td>
                          <td className="px-4 py-3 font-semibold text-slate-900">{c.itemName}</td>
                          <td className="px-4 py-3 font-mono">{c.itemCode}</td>
                          <td className="px-4 py-3 font-mono text-slate-500">{c.eanCode}</td>
                          <td className="px-4 py-3">{c.systemQuantity ?? "N/A"}</td>
                          <td className="px-4 py-3 font-bold text-slate-900">{c.physicalQuantity}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`font-bold ${
                                (c.varianceQuantity || 0) > 0
                                  ? "text-emerald-600"
                                  : (c.varianceQuantity || 0) < 0
                                  ? "text-rose-600"
                                  : "text-slate-500"
                              }`}
                            >
                              {(c.varianceQuantity || 0) > 0 ? `+${c.varianceQuantity}` : c.varianceQuantity}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold">Ksh {c.varianceValue || "0.00"}</td>
                          <td className="px-4 py-3 text-slate-700">{c.countedBy}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                                c.countStatus === "APPROVED"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : c.countStatus === "RECOUNT_REQUIRED"
                                  ? "bg-rose-100 text-rose-800"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {c.countStatus}
                            </span>
                          </td>
                          {(user?.role === "ADMINISTRATOR" || user?.role === "SUPERVISOR") && (
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleDeleteCounts([c.id])}
                                disabled={deletingCounts}
                                className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                              >
                                Delete
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: VARIANCES */}
          {activeTab === "variances" && (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Inventory Variance Analysis</h3>
                  <p className="text-xs text-slate-500">Products with discrepancies between book stock and physical count</p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                    <tr>
                      <th className="px-4 py-3">Location</th>
                      <th className="px-4 py-3">Product Name</th>
                      <th className="px-4 py-3">System Qty</th>
                      <th className="px-4 py-3">Physical Qty</th>
                      <th className="px-4 py-3">Variance Qty</th>
                      <th className="px-4 py-3">Unit Cost</th>
                      <th className="px-4 py-3">Variance Value</th>
                      <th className="px-4 py-3">Review Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stCounts.filter((c) => c.varianceQuantity !== 0).length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-400">
                          Zero discrepancies found. All counts match system quantities!
                        </td>
                      </tr>
                    ) : (
                      stCounts
                        .filter((c) => c.varianceQuantity !== 0)
                        .map((c) => (
                          <tr key={c.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-mono font-semibold">{c.locationCode}</td>
                            <td className="px-4 py-3 font-semibold text-slate-900">{c.itemName}</td>
                            <td className="px-4 py-3">{c.systemQuantity}</td>
                            <td className="px-4 py-3 font-bold">{c.physicalQuantity}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`font-bold ${
                                  (c.varianceQuantity || 0) > 0 ? "text-emerald-600" : "text-rose-600"
                                }`}
                              >
                                {(c.varianceQuantity || 0) > 0 ? `+${c.varianceQuantity}` : c.varianceQuantity}
                              </span>
                            </td>
                            <td className="px-4 py-3">Ksh {c.costPrice}</td>
                            <td className="px-4 py-3 font-bold">Ksh {c.varianceValue}</td>
                            <td className="px-4 py-3">
                              <span className="rounded bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                                Review Flagged
                              </span>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: FINALIZATION */}
          {activeTab === "finalization" && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs max-w-2xl space-y-4">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-8 w-8 text-rose-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">Stock Take Finalization & Approval</h3>
                  <p className="text-xs text-slate-500">
                    Lock physical counts, generate immutable variance snapshots, and create inventory adjustments
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Current Status:</span>
                  <span className="font-bold text-slate-900">{selectedST.status}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Locations Counted:</span>
                  <span className="font-bold text-slate-900">{stLocations.length} locations</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Total Count Lines:</span>
                  <span className="font-bold text-slate-900">{stCounts.length} lines</span>
                </div>
              </div>

              {selectedST.status !== "FINALIZED" ? (
                <div className="space-y-4 pt-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={generateAdjustments}
                      onChange={(e) => setGenerateAdjustments(e.target.checked)}
                      className="rounded text-rose-600 focus:ring-rose-500"
                    />
                    <span>Automatically generate stock ledger adjustments for all variances</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => setFinalizeModalOpen(true)}
                    className="rounded-xl bg-rose-600 px-5 py-3 text-xs font-bold text-white shadow-md hover:bg-rose-700 active:scale-95 transition-all"
                  >
                    Proceed to Finalize & Lock Session
                  </button>
                </div>
              ) : (
                <div className="rounded-xl bg-emerald-50 p-4 text-emerald-800 border border-emerald-200 text-xs">
                  <p className="font-bold">Stock Take is Finalized & Locked</p>
                  <p className="mt-1 text-[11px] text-emerald-700">
                    All physical counts are immutable. Inventory adjustments have been generated and archived.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* CREATE STOCK TAKE MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Create New Stock Take Session</h3>
              <button onClick={() => setCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateStockTake} className="mt-4 space-y-4 text-xs">
              {createError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 font-semibold text-rose-700">
                  {createError}
                </div>
              )}
              <div>
                <label className="block font-semibold text-slate-700">Session Name *</label>
                <input
                  type="text"
                  required
                  value={newSTName}
                  onChange={(e) => setNewSTName(e.target.value)}
                  placeholder="e.g. Q2 Storewide Inventory Count"
                  className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-rose-500 focus:outline-hidden"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block font-semibold text-slate-700">Store</label>
                  <select
                    value={newSTStoreId}
                    onChange={(e) => setNewSTStoreId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-rose-500"
                  >
                    {availableStores.length === 0 ? (
                      <option value="">No stores available</option>
                    ) : (
                      availableStores.map((store) => (
                        <option key={store.id} value={store.id}>
                          {store.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700">Stock Take Type</label>
                  <select
                    value={newSTType}
                    onChange={(e) => setNewSTType(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-rose-500"
                  >
                    <option value="FULL">Full Store Stock Take</option>
                    <option value="DEPARTMENT">Department Stock Take</option>
                    <option value="LOCATION">Location Stock Take</option>
                    <option value="CYCLE_COUNT">Cycle Count</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700">Custom Store Name</label>
                <input
                  type="text"
                  value={newSTStoreName}
                  onChange={(e) => setNewSTStoreName(e.target.value)}
                  placeholder="Enter store name for this stock take"
                  className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-rose-500 focus:outline-hidden"
                />
              </div>

              {/* Control Rules */}
              <div className="space-y-2 rounded-xl bg-slate-50 p-3 border border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800">
                  <input
                    type="checkbox"
                    checked={newSTBlind}
                    onChange={(e) => setNewSTBlind(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  <span>Enable Blind Counting (Hides system stock from stock takers)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800">
                  <input
                    type="checkbox"
                    checked={newST100Pct}
                    onChange={(e) => setNewST100Pct(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  <span>Require 100% Location Count before submission</span>
                </label>
              </div>

              <div>
                <label className="block font-semibold text-slate-700">Notes / Scope</label>
                <textarea
                  rows={2}
                  value={newSTNotes}
                  onChange={(e) => setNewSTNotes(e.target.value)}
                  placeholder="Additional audit guidelines or team instructions..."
                  className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-rose-500 focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Initialize Session"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGN STOCK TAKER MODAL */}
      {assignModalOpen && activeLocationToAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95">
            <h3 className="text-base font-bold text-slate-900">Assign Stock Taker to Location</h3>
            <p className="mt-1 text-xs text-slate-500">
              Location: <strong>{activeLocationToAssign.locationCode}</strong> — {activeLocationToAssign.locationName}
            </p>

            <div className="mt-4 space-y-3 text-xs">
              <label className="block font-semibold text-slate-700">Select Counting Staff</label>
              <select
                value={selectedTakerId}
                onChange={(e) => setSelectedTakerId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-rose-500"
              >
                <option value="">-- Unassigned --</option>
                {allStockTakers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAssignModalOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAssignTaker}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700"
              >
                Confirm Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FINALIZE CONFIRMATION DIALOG (Requirement 56) */}
      {finalizeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
              <AlertTriangle className="h-6 w-6" />
            </div>

            <h3 className="mt-3 text-lg font-bold text-slate-900">FINALIZE STOCK TAKE?</h3>
            <p className="mt-1 text-xs text-slate-500">
              After finalization, all stock counts will be locked and cannot be edited without administrative intervention.
              Final variance snapshots will be stored and archived in PostgreSQL.
            </p>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setFinalizeModalOpen(false)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleFinalize}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white hover:bg-rose-700"
              >
                Finalize Stock Take
              </button>
            </div>
          </div>
        </div>
      )}

      {/* UNLOCK DIALOG (Requirement 26) */}
      {unlockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
              <Unlock className="h-6 w-6" />
            </div>

            <h3 className="mt-3 text-base font-bold text-slate-900">Unlock Stock Take Session</h3>
            <p className="mt-1 text-xs text-slate-500">
              Unlocking requires an explicit reason and creates an immutable entry in the audit trail.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700">Reason for Unlocking *</label>
              <textarea
                required
                rows={2}
                value={unlockReason}
                onChange={(e) => setUnlockReason(e.target.value)}
                placeholder="Explain reason (e.g., recount required on electronics aisle)..."
                className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-rose-500 focus:outline-hidden"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setUnlockModalOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSessionAction("UNLOCK", unlockReason)}
                disabled={!unlockReason.trim()}
                className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"
              >
                Confirm Unlock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
