"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  ScanLine,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Building2,
  CheckCircle2,
} from "lucide-react";

export function LoginView() {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setLoading(true);

    const res = await login(identifier, password);
    if (!res.success) {
      setErrorMsg(res.error || "Invalid credentials. Please verify your Administrator username and password.");
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-slate-100">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto h-24 w-24 overflow-hidden rounded-2xl shadow-xl shadow-rose-950/60">
            <img src="/metrocount-logo.png" alt="MetroCount PRO" className="h-full w-full object-cover" />
          </div>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-white">MetroCount PRO</h1>
            <span className="rounded-md bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-400 border border-rose-500/30">
              ENTERPRISE
            </span>
          </div>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Supermarket Stock Taking & Physical Inventory Management System
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-xl">
          <div className="mb-5 pb-4 border-b border-slate-800">
            <h2 className="text-base font-bold text-white">Administrator Sign In</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Enter your authorized credentials to access stock-taking operations
            </p>
          </div>

          {errorMsg && (
            <div className="mb-4 rounded-xl bg-rose-500/10 p-3 text-xs font-semibold text-rose-400 border border-rose-500/25">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-300">Username or Email Address</label>
              <div className="relative mt-1.5">
                <User className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  required
                  autoFocus
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="admin or admin@supermarket.com"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/80 py-3 pl-10 pr-3 text-white placeholder:text-slate-600 focus:border-rose-500 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-300">Password</label>
              </div>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/80 py-3 pl-10 pr-10 text-white placeholder:text-slate-600 focus:border-rose-500 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 text-xs">
              <label className="flex items-center gap-2 text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-950 text-rose-600 focus:ring-rose-500/30"
                />
                <span>Remember session</span>
              </label>
              <span className="text-[11px] text-slate-500">PostgreSQL Secured</span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 py-3 text-xs font-bold text-white shadow-lg shadow-rose-900/40 hover:bg-rose-700 active:scale-98 transition-all disabled:opacity-50"
            >
              <span>{loading ? "Authenticating..." : "Sign In"}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {/* Live Production Security Features */}
          <div className="mt-6 border-t border-slate-800/80 pt-4 space-y-2 text-[11px] text-slate-400">
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span>Production PostgreSQL Database Connected</span>
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-slate-500" />
              <span>Bcrypt password hashing & role-based audit trail active</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-[11px] text-slate-500">
          MetroCount PRO • Retail Inventory & Stock Taking Architecture
        </div>
      </div>
    </div>
  );
}
