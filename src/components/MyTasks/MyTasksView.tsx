"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  CheckSquare,
  ScanLine,
  MapPin,
  Clock,
  ArrowRight,
  RefreshCw,
  EyeOff,
  Send,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Play,
} from "lucide-react";
import { NavSection } from "../Navigation/Sidebar";

interface TaskItem {
  id: string;
  stockTakeId: string;
  locationId: string;
  locationCode: string;
  locationName: string;
  departmentName?: string;
  stockTakeNumber: string;
  stockTakeName: string;
  isBlindCount: boolean;
  expectedItemsCount: number;
  countedItemsCount: number;
  remaining: number;
  progress: number;
  status: string;
}

interface RecountItem {
  id: string;
  stockTakeId: string;
  stockTakeLocationId: string;
  itemId: string;
  itemName: string;
  itemCode: string;
  locationCode: string;
  systemQty: number;
  originalPhysicalQty: number;
  reason: string;
  status: string;
  createdAt: string;
}

interface MyTasksViewProps {
  onSelectSection: (section: NavSection) => void;
  onStartCounting?: (taskId: string) => void;
}

export function MyTasksView({ onSelectSection, onStartCounting }: MyTasksViewProps) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [recounts, setRecounts] = useState<RecountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRecounts, setLoadingRecounts] = useState(false);
  const [selectedRecount, setSelectedRecount] = useState<RecountItem | null>(null);
  const [continueToTerminal, setContinueToTerminal] = useState(false);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [selectedTaskToClose, setSelectedTaskToClose] = useState<TaskItem | null>(null);
  const [closingSummary, setClosingSummary] = useState<{
    expected: number;
    counted: number;
    uncounted: number;
  } | null>(null);
  const [submittingClose, setSubmittingClose] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/my-tasks");
      if (res.ok) {
        const json = await res.json();
        setTasks(json.tasks || []);
      }
    } catch (err) {
      console.error("Failed to load tasks", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecounts = async () => {
    try {
      setLoadingRecounts(true);
      const res = await fetch("/api/recounts?status=IN_PROGRESS");
      if (res.ok) {
        const json = await res.json();
        setRecounts(json.recounts || []);
      }
    } catch (err) {
      console.error("Failed to load recounts", err);
    } finally {
      setLoadingRecounts(false);
    }
  };

  const handleOpenCloseModal = (task: TaskItem) => {
    if (task.status === "SUBMITTED" || task.status === "APPROVED") {
      setMessage({ text: "This assignment has already been submitted for review.", type: "error" });
      return;
    }
    setSelectedTaskToClose(task);
    const expected = task.expectedItemsCount;
    const counted = task.countedItemsCount;
    const uncounted = Math.max(0, expected - counted);
    setClosingSummary({ expected, counted, uncounted });
    setCloseModalOpen(true);
  };

  const handleConfirmClose = async () => {
    if (!selectedTaskToClose) return;

    try {
      setSubmittingClose(true);
      const res = await fetch(`/api/stock-take-locations/${selectedTaskToClose.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrideIncomplete: true }),
      });

      const json = await res.json();
      if (!res.ok) {
        setMessage({ text: json.error || "Failed to close assignment", type: "error" });
        return;
      }

      setMessage({
        text: `Assignment closed successfully. Awaiting supervisor review.`,
        type: "success",
      });

      setCloseModalOpen(false);
      setSelectedTaskToClose(null);
      setClosingSummary(null);
      fetchTasks();
    } catch (err) {
      setMessage({ text: "Network error closing assignment", type: "error" });
    } finally {
      setSubmittingClose(false);
    }
  };

  const handleSelectRecount = (recount: RecountItem) => {
    setSelectedRecount(recount);
    // Store recount context in sessionStorage for the counting terminal to use
    sessionStorage.setItem("selectedRecount", JSON.stringify(recount));
  };

  const handleContinueCounting = () => {
    if (selectedRecount) {
      onSelectSection("counting-terminal");
    }
  };

  const handleCancelRecount = () => {
    setSelectedRecount(null);
    sessionStorage.removeItem("selectedRecount");
  };

  useEffect(() => {
    fetchTasks();
    fetchRecounts();
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">My Stock-Taking Tasks & Assignments</h2>
          <p className="text-xs text-slate-500">
            Locations and aisles assigned to {user?.fullName || "you"} for physical counting
          </p>
        </div>

        <button
          onClick={fetchTasks}
          className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Recounts Section */}
      {selectedRecount ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-900">Recount Request Selected</h3>
              </div>
              <p className="mt-1 text-xs text-slate-600 mb-3">
                Click "Continue Counting" to go to the counting terminal and recount this item.
              </p>

              <div className="rounded-lg bg-white p-3 space-y-2 text-xs border border-emerald-100 mb-4">
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-700">Item:</span>
                  <span className="text-slate-900">{selectedRecount.itemName} ({selectedRecount.itemCode})</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-700">Location:</span>
                  <span className="text-slate-900">{selectedRecount.locationCode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-700">Reason:</span>
                  <span className="text-slate-900">{selectedRecount.reason}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-700">Original Count:</span>
                  <span className="text-slate-900">{selectedRecount.originalPhysicalQty} units</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCancelRecount}
              className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleContinueCounting}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors"
            >
              <Play className="h-3.5 w-3.5" />
              Continue Counting
            </button>
          </div>
        </div>
      ) : recounts.length > 0 ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <RotateCcw className="h-5 w-5 text-rose-600" />
            <h3 className="text-base font-bold text-slate-900">Pending Recounts ({recounts.length})</h3>
          </div>
          <p className="text-xs text-slate-600 mb-3">
            You have been assigned the following items that need to be recounted. Click on an item to continue counting.
          </p>

          <div className="space-y-2">
            {recounts.map((rc) => (
              <button
                key={rc.id}
                onClick={() => handleSelectRecount(rc)}
                className="w-full text-left rounded-lg border border-rose-200 bg-white p-3 hover:bg-rose-50 hover:border-rose-300 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">
                      {rc.itemName} <span className="text-slate-500 font-normal">({rc.itemCode})</span>
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      <span className="font-medium">Location:</span> {rc.locationCode} | <span className="font-medium">Original:</span> {rc.originalPhysicalQty} units
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-rose-600 flex-shrink-0" />
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Task Cards Grid */}
      {loading ? (
        <div className="py-12 text-center text-xs text-slate-400">Loading assigned tasks...</div>
      ) : tasks.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-400 shadow-xs">
          <CheckSquare className="mx-auto h-12 w-12 text-slate-300" />
          <h3 className="mt-3 text-base font-bold text-slate-800">No Locations Assigned</h3>
          <p className="mt-1 text-xs text-slate-500">
            You do not currently have any active locations assigned. Contact your supervisor.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tasks.map((t) => (
            <div
              key={t.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:border-rose-300 transition-all"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-slate-500">
                    {t.stockTakeNumber}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      t.status === "SUBMITTED"
                        ? "bg-amber-100 text-amber-800"
                        : t.status === "APPROVED"
                        ? "bg-emerald-100 text-emerald-800"
                        : t.status === "IN_PROGRESS"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {t.status}
                  </span>
                </div>

                <h3 className="mt-2 text-lg font-bold text-slate-900">{t.locationCode}</h3>
                <p className="text-xs text-slate-600 font-medium">{t.locationName}</p>
                {t.departmentName && (
                  <p className="text-[11px] text-slate-400 mt-0.5">{t.departmentName}</p>
                )}

                {t.isBlindCount && (
                  <div className="mt-2 inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                    <EyeOff className="h-3 w-3 text-slate-500" />
                    Blind Counting Active
                  </div>
                )}

                {/* Progress bar */}
                <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3">
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>
                      Counted: <strong className="text-slate-900">{t.countedItemsCount}</strong> /{" "}
                      {t.expectedItemsCount}
                    </span>
                    <span className="font-bold text-rose-600">{t.progress}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-rose-600"
                      style={{ width: `${t.progress}%` }}
                    ></div>
                  </div>
                </div>

                <div className="mt-3 flex justify-between text-xs text-slate-500">
                  <span>Remaining items:</span>
                  <span className="font-bold text-slate-800">{t.remaining} items</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-5 pt-3 border-t border-slate-100 flex gap-2">
                                <button
                  onClick={() =>
                    onStartCounting ? onStartCounting(t.id) : onSelectSection("counting-terminal")
                  }
                  disabled={t.status === "SUBMITTED" || t.status === "APPROVED"}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-rose-700 active:scale-98 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ScanLine className="h-4 w-4" />
                  <span>
                    {t.status === "SUBMITTED" || t.status === "APPROVED"
                      ? "CLOSED"
                      : t.countedItemsCount > 0
                      ? "CONTINUE"
                      : "START"}
                  </span>
                </button>

                <button
                  onClick={() => handleOpenCloseModal(t)}
                  disabled={t.status === "SUBMITTED" || t.status === "APPROVED"}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 active:scale-98 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="h-4 w-4" />
                  <span>CLOSE</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Notification Alert */}
      {message && (
        <div
          className={`fixed bottom-4 right-4 rounded-xl p-4 text-xs font-medium z-40 ${
            message.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        </div>
      )}

      {/* CLOSE ASSIGNMENT MODAL */}
      {closeModalOpen && selectedTaskToClose && closingSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>

            <h3 className="mt-3 text-lg font-bold text-slate-900">
              Close Assignment for Supervisor Review
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Location: <strong>{selectedTaskToClose.locationCode}</strong> — <strong>{selectedTaskToClose.locationName}</strong>
            </p>

            {/* Count Summary */}
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Expected Items in Location:</span>
                <strong className="text-slate-900 text-sm">{closingSummary.expected}</strong>
              </div>
              <div className="flex justify-between items-center border-t border-slate-200 pt-2">
                <span className="text-slate-600">Items You Counted:</span>
                <strong className="text-emerald-600 text-sm">{closingSummary.counted}</strong>
              </div>
              {closingSummary.uncounted > 0 && (
                <div className="flex justify-between items-center border-t border-slate-200 pt-2">
                  <span className="text-slate-600">Items Not Counted:</span>
                  <strong className="text-amber-600 text-sm">{closingSummary.uncounted}</strong>
                </div>
              )}
            </div>

            {/* Warning for Uncounted Items */}
            {closingSummary.uncounted > 0 && (
              <div className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <span>
                  <strong className="block">Incomplete Count:</strong>
                  {closingSummary.uncounted} expected item(s) have not been counted. You can still submit for review.
                </span>
              </div>
            )}

            {/* What Happens Next */}
            <div className="mt-4 rounded-xl bg-blue-50 p-3 border border-blue-200">
              <p className="text-xs font-semibold text-blue-900 mb-2">What happens next:</p>
              <ul className="text-xs text-blue-800 space-y-1.5">
                <li className="flex gap-2">
                  <span className="font-bold text-blue-600">1.</span>
                  <span>Your count data is submitted for supervisor/admin review</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-blue-600">2.</span>
                  <span>Supervisor will verify counts and check for variances</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-blue-600">3.</span>
                  <span>They can approve the count or request a recount if needed</span>
                </li>
              </ul>
            </div>

            <p className="mt-4 text-xs font-semibold text-slate-800">
              Are you ready to close this assignment and wait for review?
            </p>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setCloseModalOpen(false);
                  setSelectedTaskToClose(null);
                  setClosingSummary(null);
                }}
                className="flex-1 rounded-xl border border-slate-300 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Continue Counting
              </button>
              <button
                type="button"
                onClick={handleConfirmClose}
                disabled={submittingClose}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {submittingClose ? (
                  <>
                    <Clock className="h-3.5 w-3.5" />
                    Closing...
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    Close Assignment
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
