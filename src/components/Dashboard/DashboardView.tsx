"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  ClipboardList,
  Calendar,
  CheckCircle2,
  MapPin,
  Package,
  Users,
  ScanLine,
  Clock,
  TrendingDown,
  TrendingUp,
  AlertTriangle,
  RotateCcw,
  PlusCircle,
  UploadCloud,
  FileBarChart,
  ArrowRight,
  RefreshCw,
  Sliders,
  DollarSign,
} from "lucide-react";
import { NavSection } from "../Navigation/Sidebar";

interface DashboardData {
  summary: {
    activeStockTakes: number;
    plannedStockTakes: number;
    completedStockTakes: number;
    locations: number;
    totalItems: number;
    assignedStockTakers: number;
    itemsCounted: number;
    itemsExpected: number;
    itemsPending: number;
    totalVarianceVal: string;
    positiveVarianceVal: string;
    negativeVarianceVal: string;
    pendingRecounts: number;
  };
  currentStockTake: {
    id: string;
    number: string;
    name: string;
    status: string;
    type: string;
    isBlindCount: boolean;
  } | null;
  progress: {
    overallProgress: number;
    locationCompletionPct: number;
    completedLocations: number;
    pendingLocations: number;
    inProgressLocations: number;
    itemsCounted: number;
    itemsExpected: number;
  };
  charts: {
    varianceByDept: { department: string; varianceVal: number; itemsCount: number }[];
    varianceByLocation: { location: string; varianceVal: number; varianceQty: number }[];
    takerProductivity: { name: string; counted: number; accuracy: number }[];
    varianceSplit: { name: string; value: number; color: string }[];
    locationsSplit: { name: string; value: number; color: string }[];
  };
}

interface DashboardViewProps {
  onSelectSection: (section: NavSection) => void;
}

export function DashboardView({ onSelectSection }: DashboardViewProps) {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/stats/dashboard");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("Failed to load dashboard stats", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading && !data) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-rose-600" />
          <p className="text-sm font-medium text-slate-500">Loading live stock taking dashboard...</p>
        </div>
      </div>
    );
  }

  const s = data?.summary || {
    activeStockTakes: 0,
    plannedStockTakes: 0,
    completedStockTakes: 0,
    locations: 0,
    totalItems: 0,
    assignedStockTakers: 0,
    itemsCounted: 0,
    itemsExpected: 0,
    itemsPending: 0,
    totalVarianceVal: "0.00",
    positiveVarianceVal: "0.00",
    negativeVarianceVal: "0.00",
    pendingRecounts: 0,
  };

  const p = data?.progress || {
    overallProgress: 0,
    locationCompletionPct: 0,
    completedLocations: 0,
    pendingLocations: 0,
    inProgressLocations: 0,
    itemsCounted: 0,
    itemsExpected: 0,
  };

  const c = data?.charts || {
    varianceByDept: [],
    varianceByLocation: [],
    takerProductivity: [],
    varianceSplit: [],
    locationsSplit: [],
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-rose-950 p-6 text-white shadow-xl md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-rose-500/20 px-2.5 py-0.5 text-xs font-semibold text-rose-300">
              {data?.currentStockTake ? "Active Session" : "Production Ready"}
            </span>
            <span className="text-xs text-slate-400">
              {data?.currentStockTake ? data.currentStockTake.number : "Metro Grand Hypermarket"}
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">
            {data?.currentStockTake ? data.currentStockTake.name : "Supermarket Stock Taking System"}
          </h1>
          <p className="text-xs text-slate-300">
            Real-time physical count auditing, barcode reconciliation and variance tracking
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onSelectSection("counting-terminal")}
            className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-rose-900/30 transition-all hover:bg-rose-700 active:scale-95"
          >
            <ScanLine className="h-4 w-4" />
            <span>Scan Stock Now</span>
          </button>

          {(user?.role === "ADMINISTRATOR" || user?.role === "SUPERVISOR") && (
            <button
              onClick={() => onSelectSection("stock-takes")}
              className="flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2.5 text-xs font-semibold text-white backdrop-blur-md transition-all hover:bg-white/20 active:scale-95"
            >
              <PlusCircle className="h-4 w-4 text-rose-400" />
              <span>New Stock Take</span>
            </button>
          )}

          <button
            onClick={() => onSelectSection("reports")}
            className="flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2.5 text-xs font-semibold text-white backdrop-blur-md transition-all hover:bg-white/20 active:scale-95"
          >
            <FileBarChart className="h-4 w-4 text-emerald-400" />
            <span>Generate Report</span>
          </button>

          <button
            onClick={fetchStats}
            className="rounded-xl bg-white/10 p-2.5 text-white backdrop-blur-md hover:bg-white/20 transition-all"
            title="Refresh Metrics"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 12 SUMMARY KPI CARDS */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold tracking-tight text-slate-900 uppercase">
            Audit Overview & Inventory Key Metrics
          </h2>
          <span className="text-xs text-slate-500">Auto-calculated from PostgreSQL</span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {/* 1. Active Stock Takes */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">Active Counts</span>
              <ClipboardList className="h-4 w-4 text-rose-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{s.activeStockTakes}</p>
            <span className="mt-1 inline-block text-[11px] font-semibold text-emerald-600">In Progress</span>
          </div>

          {/* 2. Planned Stock Takes */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">Planned Sessions</span>
              <Calendar className="h-4 w-4 text-blue-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{s.plannedStockTakes}</p>
            <span className="mt-1 inline-block text-[11px] text-slate-500">Upcoming Audits</span>
          </div>

          {/* 3. Completed Stock Takes */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">Finalized Takes</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{s.completedStockTakes}</p>
            <span className="mt-1 inline-block text-[11px] text-slate-500">Locked & Reconciled</span>
          </div>

          {/* 4. Total Locations */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">Locations</span>
              <MapPin className="h-4 w-4 text-purple-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{s.locations}</p>
            <span className="mt-1 inline-block text-[11px] text-slate-500">Aisles & Cold Rooms</span>
          </div>

          {/* 5. Total Items Master */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">Item Master</span>
              <Package className="h-4 w-4 text-amber-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{s.totalItems}</p>
            <span className="mt-1 inline-block text-[11px] text-slate-500">Active SKUs / EANs</span>
          </div>

          {/* 6. Assigned Stock Takers */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">Stock Takers</span>
              <Users className="h-4 w-4 text-indigo-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">{s.assignedStockTakers}</p>
            <span className="mt-1 inline-block text-[11px] text-slate-500">Active Counting Staff</span>
          </div>

          {/* 7. Items Counted */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">Items Counted</span>
              <ScanLine className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-emerald-600">{s.itemsCounted}</p>
            <span className="mt-1 inline-block text-[11px] text-emerald-600 font-medium">
              Verified Physical
            </span>
          </div>

          {/* 8. Items Pending */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">Items Pending</span>
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-amber-600">{s.itemsPending}</p>
            <span className="mt-1 inline-block text-[11px] text-amber-600 font-medium">Awaiting Scan</span>
          </div>

          {/* 9. Total Variance Value */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">Net Variance Val</span>
              <DollarSign className="h-4 w-4 text-rose-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-slate-900">${s.totalVarianceVal}</p>
            <span className="mt-1 inline-block text-[11px] text-slate-500">Cost Price Impact</span>
          </div>

          {/* 10. Positive Variance */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">Positive Variance</span>
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-emerald-600">+${s.positiveVarianceVal}</p>
            <span className="mt-1 inline-block text-[11px] text-emerald-600">Surplus Physical</span>
          </div>

          {/* 11. Negative Variance */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">Negative Variance</span>
              <TrendingDown className="h-4 w-4 text-rose-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-rose-600">-${s.negativeVarianceVal}</p>
            <span className="mt-1 inline-block text-[11px] text-rose-600">Inventory Shortage</span>
          </div>

          {/* 12. Recounts Pending */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium">Recounts Pending</span>
              <RotateCcw className="h-4 w-4 text-rose-600" />
            </div>
            <p className="mt-2 text-2xl font-bold text-rose-600">{s.pendingRecounts}</p>
            <span className="mt-1 inline-block text-[11px] text-rose-600 font-semibold">
              Action Required
            </span>
          </div>
        </div>
      </div>

      {/* REAL-TIME PROGRESS BARS SECTION */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Overall Progress Meter */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Current Stock Take Progress</h3>
              <p className="text-xs text-slate-500">Items counted vs expected in active session</p>
            </div>
            <span className="rounded-full bg-rose-50 px-3 py-1 text-sm font-bold text-rose-600">
              {p.overallProgress}% Complete
            </span>
          </div>

          {/* Main Progress Bar */}
          <div className="mt-4 h-4 w-full overflow-hidden rounded-full bg-slate-100 p-0.5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-rose-500 to-rose-600 transition-all duration-500"
              style={{ width: `${p.overallProgress}%` }}
            ></div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-4 border-t border-slate-100 pt-4 text-center">
            <div>
              <p className="text-xs text-slate-500">Items Counted</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{p.itemsCounted}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Items Expected</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{p.itemsExpected}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Locations Complete</p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {p.completedLocations} / {p.completedLocations + p.inProgressLocations + p.pendingLocations}
              </p>
            </div>
          </div>

          {/* Detailed Location Status Segments */}
          <div className="mt-4 flex items-center justify-between text-xs text-slate-600 bg-slate-50 p-3 rounded-xl">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-emerald-500"></span>
              <span>Completed ({p.completedLocations})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-amber-500"></span>
              <span>In Progress ({p.inProgressLocations})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-slate-300"></span>
              <span>Pending Start ({p.pendingLocations})</span>
            </div>
          </div>
        </div>

        {/* Stock Taker Productivity & Accuracy */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <h3 className="text-base font-bold text-slate-900">Stock Taker Productivity</h3>
          <p className="text-xs text-slate-500">Items counted & verification accuracy</p>

          <div className="mt-4 space-y-3">
            {c.takerProductivity.length === 0 ? (
              <p className="text-xs text-slate-400">No staff activity recorded yet.</p>
            ) : (
              c.takerProductivity.map((t, idx) => (
                <div key={idx} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">{t.name}</span>
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                      {t.accuracy}% Accuracy
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span>{t.counted} items scanned</span>
                    <span className="font-medium text-slate-700">Active</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${Math.min(100, t.counted * 10)}%` }}
                    ></div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* CHARTS: VARIANCE BY DEPARTMENT & LOCATION */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Department Variance Breakdown */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Variance Value by Department</h3>
              <p className="text-xs text-slate-500">Financial variance distribution across supermarket sections</p>
            </div>
            <span className="text-xs font-semibold text-rose-600">Net Impact</span>
          </div>

          <div className="mt-6 space-y-4">
            {c.varianceByDept.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-xs text-slate-400">
                No variance recorded across departments yet.
              </div>
            ) : (
              c.varianceByDept.map((d, i) => {
                const isPositive = d.varianceVal >= 0;
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">{d.department}</span>
                      <span className={`font-bold ${isPositive ? "text-emerald-600" : "text-rose-600"}`}>
                        {isPositive ? `+$${d.varianceVal}` : `-$${Math.abs(d.varianceVal)}`}
                        <span className="ml-1 text-[10px] text-slate-400 font-normal">({d.itemsCount} items)</span>
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${isPositive ? "bg-emerald-500" : "bg-rose-500"}`}
                        style={{ width: `${Math.min(100, Math.max(15, Math.abs(d.varianceVal) * 3))}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Location Variance Breakdown */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Variance by Location & Aisle</h3>
              <p className="text-xs text-slate-500">Unit differences identified per physical aisle</p>
            </div>
            <button
              onClick={() => onSelectSection("reports")}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700"
            >
              View Full Report →
            </button>
          </div>

          <div className="mt-6 space-y-4">
            {c.varianceByLocation.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-xs text-slate-400">
                No location variance detected.
              </div>
            ) : (
              c.varianceByLocation.map((loc, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <MapPin className="h-4 w-4 text-slate-400" />
                    <div>
                      <p className="font-bold text-slate-800">{loc.location}</p>
                      <p className="text-[11px] text-slate-500">
                        Units:{" "}
                        <span className={loc.varianceQty >= 0 ? "text-emerald-600 font-semibold" : "text-rose-600 font-semibold"}>
                          {loc.varianceQty > 0 ? `+${loc.varianceQty}` : loc.varianceQty} units
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-slate-900">
                      ${Math.abs(loc.varianceVal).toFixed(2)}
                    </span>
                    <p className="text-[10px] text-slate-500">Valuation Delta</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
