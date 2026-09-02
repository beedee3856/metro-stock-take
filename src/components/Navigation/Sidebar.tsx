"use client";

import React from "react";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard,
  ClipboardList,
  ScanLine,
  CheckSquare,
  RotateCcw,
  Package,
  UploadCloud,
  MapPin,
  FileBarChart,
  Users,
  ShieldCheck,
  Settings,
  Store,
  ChevronRight,
  Sparkles,
} from "lucide-react";

export type NavSection =
  | "dashboard"
  | "stock-takes"
  | "counting-terminal"
  | "my-tasks"
  | "recounts"
  | "items"
  | "import-items"
  | "locations"
  | "reports"
  | "users"
  | "audit-logs"
  | "settings";

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  isOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ activeSection, onSelectSection, isOpen, onCloseMobile }: SidebarProps) {
  const { user } = useAuth();
  const role = user?.role || "STOCK_TAKER";

  const isStockTaker = role === "STOCK_TAKER";
  const isAuditor = role === "AUDITOR";
  const isAdmin = role === "ADMINISTRATOR";
  const isSupervisor = role === "SUPERVISOR";
  const isManager = role === "STORE_MANAGER";

  const handleNav = (section: NavSection) => {
    onSelectSection(section);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-72 flex-col bg-slate-900 text-slate-200 transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-18 items-center gap-3 border-b border-slate-800 px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-rose-700 text-white shadow-md shadow-rose-900/40">
            <ScanLine className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold tracking-tight text-white text-base">MetroCount</span>
              <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-rose-400">
                PRO
              </span>
            </div>
            <p className="text-xs text-slate-400">Supermarket Stock Taking</p>
          </div>
        </div>

        {/* User Role Card */}
        <div className="mx-4 mt-4 rounded-xl border border-slate-800 bg-slate-800/60 p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-700 font-semibold text-rose-400">
              {user?.fullName?.charAt(0) || "U"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-white">{user?.fullName || "Guest"}</p>
              <div className="flex items-center gap-1">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
                <p className="truncate text-[11px] font-medium text-slate-400">
                  {role.replace("_", " ")}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {/* Main Group */}
          <div>
            <p className="px-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              Core Operations
            </p>
            <nav className="mt-2 space-y-1">
              <button
                onClick={() => handleNav("dashboard")}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors ${
                  activeSection === "dashboard"
                    ? "bg-rose-600 text-white shadow-sm"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Dashboard</span>
              </button>

              {/* Counting Terminal (Optimized for Mobile/Tablet) */}
              <button
                onClick={() => handleNav("counting-terminal")}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-xs font-medium transition-colors ${
                  activeSection === "counting-terminal"
                    ? "bg-rose-600 text-white shadow-sm"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <ScanLine className="h-4 w-4 text-emerald-400" />
                  <span>Counting Terminal</span>
                </div>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                  Scan
                </span>
              </button>

              {/* My Assigned Tasks (For Stock Takers) */}
              <button
                onClick={() => handleNav("my-tasks")}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors ${
                  activeSection === "my-tasks"
                    ? "bg-rose-600 text-white shadow-sm"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <CheckSquare className="h-4 w-4 text-amber-400" />
                <span>My Assigned Tasks</span>
              </button>
            </nav>
          </div>

          {/* Stock Taking Management */}
          <div>
            <p className="px-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              Stock Taking
            </p>
            <nav className="mt-2 space-y-1">
              <button
                onClick={() => handleNav("stock-takes")}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors ${
                  activeSection === "stock-takes"
                    ? "bg-rose-600 text-white shadow-sm"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <ClipboardList className="h-4 w-4" />
                <span>Stock Take Sessions</span>
              </button>

              {!isStockTaker && (
                <button
                  onClick={() => handleNav("recounts")}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-xs font-medium transition-colors ${
                    activeSection === "recounts"
                      ? "bg-rose-600 text-white shadow-sm"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <RotateCcw className="h-4 w-4" />
                    <span>Recounts Management</span>
                  </div>
                  <span className="rounded bg-rose-500/20 px-1.5 py-0.2 text-[10px] font-semibold text-rose-300">
                    Review
                  </span>
                </button>
              )}
            </nav>
          </div>

          {/* Item Master & Catalog */}
          <div>
            <p className="px-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              Item Master
            </p>
            <nav className="mt-2 space-y-1">
              <button
                onClick={() => handleNav("items")}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors ${
                  activeSection === "items"
                    ? "bg-rose-600 text-white shadow-sm"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Package className="h-4 w-4" />
                <span>Items & Barcodes</span>
              </button>

              {(isAdmin || isSupervisor) && (
                <button
                  onClick={() => handleNav("import-items")}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors ${
                    activeSection === "import-items"
                      ? "bg-rose-600 text-white shadow-sm"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <UploadCloud className="h-4 w-4" />
                  <span>Import Master (Excel/CSV)</span>
                </button>
              )}
            </nav>
          </div>

          {/* Locations & Stores */}
          <div>
            <p className="px-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              Organization
            </p>
            <nav className="mt-2 space-y-1">
              <button
                onClick={() => handleNav("locations")}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors ${
                  activeSection === "locations"
                    ? "bg-rose-600 text-white shadow-sm"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <MapPin className="h-4 w-4" />
                <span>Locations & Aisles</span>
              </button>
            </nav>
          </div>

          {/* Reports & Compliance */}
          <div>
            <p className="px-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              Reports & Audit
            </p>
            <nav className="mt-2 space-y-1">
              <button
                onClick={() => handleNav("reports")}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors ${
                  activeSection === "reports"
                    ? "bg-rose-600 text-white shadow-sm"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <FileBarChart className="h-4 w-4" />
                <span>Reports & Exports (PDF/Excel)</span>
              </button>

              {(isAdmin || isAuditor) && (
                <button
                  onClick={() => handleNav("audit-logs")}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors ${
                    activeSection === "audit-logs"
                      ? "bg-rose-600 text-white shadow-sm"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span>Audit Logs</span>
                </button>
              )}
            </nav>
          </div>

          {/* System & Users */}
          {isAdmin && (
            <div>
              <p className="px-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                Administration
              </p>
              <nav className="mt-2 space-y-1">
                <button
                  onClick={() => handleNav("users")}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors ${
                    activeSection === "users"
                      ? "bg-rose-600 text-white shadow-sm"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <Users className="h-4 w-4" />
                  <span>User Management & RBAC</span>
                </button>

                <button
                  onClick={() => handleNav("settings")}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors ${
                    activeSection === "settings"
                      ? "bg-rose-600 text-white shadow-sm"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <Settings className="h-4 w-4" />
                  <span>System Settings & Rules</span>
                </button>
              </nav>
            </div>
          )}
        </div>

        {/* Database Status Footer */}
        <div className="border-t border-slate-800 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>PostgreSQL Active</span>
            </div>
            <span className="text-[10px] text-slate-400">v2026.1</span>
          </div>
        </div>
      </aside>
    </>
  );
}
