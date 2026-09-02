"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  ScanLine,
  MapPin,
  Clock,
  CheckCircle2,
  Hourglass,
  ClipboardCheck,
  TrendingDown,
  TrendingUp,
  ArrowRight,
  RefreshCw,
  Inbox,
  UserCheck,
} from "lucide-react";

/* 1. STOCK TAKER BOARD — assignments on the taker's own dashboard */

interface TakerTask {
  id: string;
  stockTakeNumber: string;
  locationCode: string;
  locationName: string;
  departmentName?: string | null;
  status: string;
  expectedItemsCount: number;
  countedItemsCount: number;
  remaining: number;
  progress: number;
  isBlindCount: boolean;
}

export function TakerAssignmentBoard({
  onStartCounting,
}: {
  onStartCounting: (taskId: string) => void;
}) {
  const [tasks, setTasks] = useState<TakerTask[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/my-tasks", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setTasks(json.tasks || []);
      }
    } catch (err) {
      console.error("Failed to load my tasks", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const open = tasks.filter((t) => !["SUBMITTED", "APPROVED", "COMPLETED"].includes(t.status));

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">My Counting Assignments</h2>
            <p className="text-xs text-slate-500">
              Tap an assignment to open the scanning terminal and start counting
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={fetchTasks}
          className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
          title="Refresh assignments"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading ? (
        <div className="py-10 text-center text-xs text-slate-400">Loading your assignments…</div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Inbox className="h-8 w-8 text-slate-300" />
          <p className="text-xs font-semibold text-slate-600">No locations assigned to you yet</p>
          <p className="text-[11px] text-slate-400">
            Your supervisor will assign aisles to you when a stock take opens.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {tasks.map((t) => {
            const closed = ["SUBMITTED", "APPROVED", "COMPLETED"].includes(t.status);
            return (
              <article
                key={t.id}
                className={`flex flex-col justify-between rounded-xl border p-4 transition-all ${
                  closed
                    ? "border-slate-200 bg-slate-50/70"
                    : "border-slate-200 bg-white hover:border-rose-300 hover:shadow-md"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 shrink-0 text-rose-600" />
                      <span className="font-mono text-sm font-black tracking-tight text-slate-900">
                        {t.locationCode}
                      </span>
                    </div>
                    {t.status === "SUBMITTED" ? (
                      <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                        <Hourglass className="h-3 w-3" /> AWAITING REVIEW
                      </span>
                    ) : t.status === "RECOUNT_REQUIRED" ? (
                      <span className="flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                        <RefreshCw className="h-3 w-3" /> RECOUNT
                      </span>
                    ) : closed ? (
                      <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                        <CheckCircle2 className="h-3 w-3" /> {t.status}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                        <Clock className="h-3 w-3" /> {t.status.replace("_", " ")}
                      </span>
                    )}
                  </div>

                  <p className="mt-1.5 text-xs font-semibold text-slate-800">{t.locationName}</p>
                  <p className="text-[11px] text-slate-500">
                    {t.stockTakeNumber}
                    {t.departmentName ? ` • ${t.departmentName}` : ""}
                  </p>

                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-600">
                      <span>
                        Counted <strong className="text-slate-900">{t.countedItemsCount}</strong> /{" "}
                        {t.expectedItemsCount}
                      </span>
                      <span className="font-bold text-rose-600">{t.progress}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          closed ? "bg-emerald-500" : "bg-rose-600"
                        }`}
                        style={{ width: `${t.progress}%` }}
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onStartCounting(t.id)}
                  disabled={closed}
                  className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all active:scale-98 ${
                    closed
                      ? "cursor-not-allowed bg-slate-200 text-slate-500"
                      : "bg-rose-600 text-white shadow-sm hover:bg-rose-700"
                  }`}
                >
                  <ScanLine className="h-4 w-4" />
                  <span>
                    {closed
                      ? "CLOSED — IN REVIEW"
                      : t.countedItemsCount > 0
                      ? "CONTINUE COUNTING"
                      : "START COUNTING"}
                  </span>
                  {!closed && <ArrowRight className="h-3.5 w-3.5" />}
                </button>
              </article>
            );
          })}
        </div>
      )}

      {!loading && open.length === 0 && tasks.length > 0 && (
        <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-center text-[11px] font-semibold text-emerald-800 border border-emerald-200">
          All your assigned locations are submitted and closed. Well done — awaiting supervisor review.
        </p>
      )}
    </section>
  );
}

/* 2. ADMIN / SUPERVISOR BOARD — submitted locations awaiting action */

export interface ReviewQueueItem {
  id: string;
  stockTakeId: string;
  stockTakeNumber: string;
  locationCode: string;
  locationName: string;
  takerName: string | null;
  submittedAt: string | null;
  expected: number;
  counted: number;
  netVarianceQty: number;
  netVarianceVal: number;
  negativeLines: number;
}

export function ReviewQueueBoard({
  onOpenSession,
}: {
  onOpenSession: (stockTakeId: string) => void;
}) {
  const [queue, setQueue] = useState<ReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchQueue = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/stats/dashboard", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setQueue(json.reviewQueue || []);
      }
    } catch (err) {
      console.error("Failed to load review queue", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <UserCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Awaiting Your Review</h2>
            <p className="text-xs text-slate-500">
              Locations submitted by stock takers — approve clean counts, send negative variances for recount
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
            {queue.length} pending
          </span>
          <button
            type="button"
            onClick={fetchQueue}
            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
            title="Refresh queue"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs text-slate-400">Loading review queue…</div>
      ) : queue.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-400" />
          <p className="text-xs font-semibold text-slate-600">Nothing waiting for review</p>
          <p className="text-[11px] text-slate-400">
            Submitted locations from stock takers will appear here instantly.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-2.5">
          {queue.map((q) => {
            const hasNegative = q.negativeLines > 0 || q.netVarianceQty < 0;
            return (
              <div
                key={q.id}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 transition-colors hover:border-amber-300 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white font-mono text-[10px] font-black text-slate-700 border border-slate-200">
                    {q.locationCode.slice(0, 6)}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">
                      {q.locationCode} — {q.locationName}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {q.stockTakeNumber} • Counted by{" "}
                      <strong className="text-slate-700">{q.takerName || "Unassigned"}</strong>
                      {q.submittedAt ? ` • ${new Date(q.submittedAt).toLocaleString()}` : ""}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold">
                      <span className="rounded bg-white border border-slate-200 px-1.5 py-0.5 text-slate-700">
                        {q.counted}/{q.expected} items
                      </span>
                      <span
                        className={`flex items-center gap-1 rounded px-1.5 py-0.5 ${
                          q.netVarianceQty < 0 ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {q.netVarianceQty < 0 ? (
                          <TrendingDown className="h-3 w-3" />
                        ) : q.netVarianceQty > 0 ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <CheckCircle2 className="h-3 w-3" />
                        )}
                        Net {q.netVarianceQty > 0 ? "+" : ""}
                        {q.netVarianceQty} units (${Math.abs(q.netVarianceVal).toFixed(2)})
                      </span>
                      {hasNegative && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">
                          {q.negativeLines} negative line{q.negativeLines === 1 ? "" : "s"} → recount candidate
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenSession(q.stockTakeId)}
                  className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-slate-800 active:scale-95"
                >
                  <span>Review & Approve</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}