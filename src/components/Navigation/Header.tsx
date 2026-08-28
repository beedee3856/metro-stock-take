"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Menu,
  ScanLine,
  Store,
  Bell,
  LogOut,
  ShieldCheck,
  Key,
  User,
} from "lucide-react";
import { NavSection } from "./Sidebar";
import { AdminProfileModal } from "@/components/Admin/AdminProfileModal";

interface HeaderProps {
  onToggleSidebar: () => void;
  onSelectSection: (section: NavSection) => void;
}

export function Header({ onToggleSidebar, onSelectSection }: HeaderProps) {
  const { user, logout } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-18 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur-md lg:px-8">
        {/* Left items */}
        <div className="flex items-center gap-4">
          <button
            onClick={onToggleSidebar}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="Toggle Navigation"
          >
            <Menu className="h-6 w-6" />
          </button>

          {/* Store Indicator */}
          <div className="hidden sm:flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700">
            <Store className="h-3.5 w-3.5 text-rose-600" />
            <span className="font-semibold text-slate-900">Metro Grand Hypermarket</span>
            <span className="text-slate-400">|</span>
            <span className="text-slate-500">STR-001 (Main Store)</span>
          </div>
        </div>

        {/* Right Items */}
        <div className="flex items-center gap-3">
          {/* Quick Scan Button */}
          <button
            onClick={() => onSelectSection("counting-terminal")}
            className="flex items-center gap-2 rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-rose-700 active:scale-98"
          >
            <ScanLine className="h-4 w-4" />
            <span className="hidden sm:inline">Scan & Count</span>
          </button>

          {/* Administrator Profile Button (Opens Name & Password Editor) */}
          <button
            onClick={() => setShowProfileModal(true)}
            className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs hover:bg-slate-100 hover:border-rose-300 transition-all cursor-pointer group"
            title="Click to edit Administrator Name and Realtime Password"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-600 font-bold text-white text-xs group-hover:scale-105 transition-transform">
              {user?.fullName?.charAt(0) || "A"}
            </div>
            <div className="hidden md:block text-left">
              <p className="font-bold text-slate-900 text-xs leading-none group-hover:text-rose-600 transition-colors">
                {user?.fullName || "Administrator"}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[10px] font-semibold text-rose-600 tracking-wide uppercase">
                  {user?.role?.replace("_", " ") || "ADMINISTRATOR"}
                </span>
                <span className="text-[10px] text-slate-400">• Edit</span>
              </div>
            </div>
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 transition-colors"
              title="Notifications"
            >
              <Bell className="h-4 w-4" />
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-3 shadow-xl z-50 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <p className="text-xs font-bold text-slate-900">Stock Take Notifications</p>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                    System Active
                  </span>
                </div>
                <div className="mt-2 text-xs text-slate-500 py-3 text-center">
                  System online and operational. Ready to initialize stock count sessions.
                </div>
              </div>
            )}
          </div>

          {/* Logout */}
          <button
            onClick={logout}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 p-2 text-xs font-medium text-slate-600 hover:bg-rose-50 hover:text-rose-600 transition-colors"
            title="Sign Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Admin Profile & Password Modal */}
      <AdminProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />
    </>
  );
}
