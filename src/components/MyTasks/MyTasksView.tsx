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

interface MyTasksViewProps {
  onSelectSection: (section: NavSection) => void;
}

export function MyTasksView({ onSelectSection }: MyTasksViewProps) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    fetchTasks();
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

              {/* Action Button */}
              <div className="mt-5 pt-3 border-t border-slate-100">
                <button
                  onClick={() => onSelectSection("counting-terminal")}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-rose-700 active:scale-98 transition-all"
                >
                  <ScanLine className="h-4 w-4" />
                  <span>
                    {t.countedItemsCount > 0 ? "CONTINUE COUNTING" : "START SCANNING"}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
