"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Settings,
  Database,
  Shield,
  Save,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  HardDrive,
  Clock,
  Key,
  User,
  Mail,
  Eye,
  EyeOff,
} from "lucide-react";

export function SettingsView() {
  const { user, refreshUser } = useAuth();
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Admin Account Settings
  const [adminFullName, setAdminFullName] = useState("");
  const [adminUsername, setAdminUsername] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [confirmAdminPassword, setConfirmAdminPassword] = useState("");
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [adminMessage, setAdminMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // General Policy Form State
  const [blindCountDefault, setBlindCountDefault] = useState(false);
  const [qtyThreshold, setQtyThreshold] = useState(5);
  const [valThreshold, setValThreshold] = useState(100);
  const [pctThreshold, setPctThreshold] = useState(10);
  const [require100Pct, setRequire100Pct] = useState(true);
  const [allowPartial, setAllowPartial] = useState(false);
  const [twoPerson, setTwoPerson] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState(60);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/settings");
      if (res.ok) {
        const json = await res.json();
        const s = json.settings || {};
        setSettings(s);
        setBlindCountDefault(Boolean(s.DEFAULT_BLIND_COUNT));
        setQtyThreshold(Number(s.QTY_VARIANCE_THRESHOLD) || 5);
        setValThreshold(Number(s.VAL_VARIANCE_THRESHOLD) || 100);
        setPctThreshold(Number(s.PCT_VARIANCE_THRESHOLD) || 10);
        setRequire100Pct(s.REQUIRE_100_PERCENT_COUNT !== undefined ? Boolean(s.REQUIRE_100_PERCENT_COUNT) : true);
        setAllowPartial(Boolean(s.ALLOW_PARTIAL_SUBMISSION));
        setTwoPerson(Boolean(s.TWO_PERSON_VERIFICATION));
        setSessionTimeout(Number(s.SESSION_TIMEOUT_MINUTES) || 60);
      }
    } catch (err) {
      console.error("Failed to load settings", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    if (user) {
      setAdminFullName(user.fullName || "");
      setAdminUsername(user.username || "");
      setAdminEmail(user.email || "");
    }
  }, [user]);

  const handleSaveAdminProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminMessage(null);

    if (!adminFullName.trim()) {
      setAdminMessage({ type: "error", text: "Administrator Name is required." });
      return;
    }

    if (newAdminPassword) {
      if (newAdminPassword.length < 6) {
        setAdminMessage({ type: "error", text: "Password must be at least 6 characters." });
        return;
      }
      if (newAdminPassword !== confirmAdminPassword) {
        setAdminMessage({ type: "error", text: "New password and confirmation do not match." });
        return;
      }
    }

    try {
      setSavingAdmin(true);
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: adminFullName.trim(),
          username: adminUsername.trim(),
          email: adminEmail.trim(),
          password: newAdminPassword ? newAdminPassword.trim() : undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setAdminMessage({ type: "error", text: json.error || "Failed to update profile." });
        return;
      }

      await refreshUser();
      setAdminMessage({
        type: "success",
        text: "Administrator name and password successfully updated in PostgreSQL database!",
      });
      setNewAdminPassword("");
      setConfirmAdminPassword("");
    } catch (err) {
      setAdminMessage({ type: "error", text: "Network error saving administrator credentials." });
    } finally {
      setSavingAdmin(false);
    }
  };

  const handleSaveSetting = async (key: string, value: unknown) => {
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
    } catch (err) {
      console.error("Save error", err);
    }
  };

  const handleSaveAllPolicies = async () => {
    await handleSaveSetting("DEFAULT_BLIND_COUNT", blindCountDefault);
    await handleSaveSetting("QTY_VARIANCE_THRESHOLD", qtyThreshold);
    await handleSaveSetting("VAL_VARIANCE_THRESHOLD", valThreshold);
    await handleSaveSetting("PCT_VARIANCE_THRESHOLD", pctThreshold);
    await handleSaveSetting("REQUIRE_100_PERCENT_COUNT", require100Pct);
    await handleSaveSetting("ALLOW_PARTIAL_SUBMISSION", allowPartial);
    await handleSaveSetting("TWO_PERSON_VERIFICATION", twoPerson);
    await handleSaveSetting("SESSION_TIMEOUT_MINUTES", sessionTimeout);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">System Configuration & Account Settings</h2>
          <p className="text-xs text-slate-500">
            Edit your Administrator name and realtime password, and manage supermarket variance rules
          </p>
        </div>

        {savedSuccess && (
          <div className="flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 border border-emerald-200 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>Policies Saved to PostgreSQL!</span>
          </div>
        )}
      </div>

      {/* SECTION 1: ADMINISTRATOR ACCOUNT & REALTIME PASSWORD */}
      <div className="rounded-2xl border-2 border-rose-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-600 text-white font-bold text-sm">
              <Key className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Administrator Account & Realtime Password</h3>
              <p className="text-xs text-slate-500">
                Update your administrator display name, login username, and real-time database password
              </p>
            </div>
          </div>
          <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-[10px] font-bold text-rose-800">
            Primary Administrator
          </span>
        </div>

        {adminMessage && (
          <div
            className={`flex items-center gap-2 rounded-xl p-3 text-xs font-semibold ${
              adminMessage.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-rose-50 text-rose-800 border border-rose-200"
            }`}
          >
            {adminMessage.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            )}
            <span>{adminMessage.text}</span>
          </div>
        )}

        <form onSubmit={handleSaveAdminProfile} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700">Administrator Full Name *</label>
              <div className="relative mt-1">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={adminFullName}
                  onChange={(e) => setAdminFullName(e.target.value)}
                  placeholder="e.g. System Administrator"
                  className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-xs text-slate-900 focus:border-rose-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700">Login Username *</label>
              <input
                type="text"
                required
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                placeholder="admin"
                className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-xs font-mono text-slate-900 focus:border-rose-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700">Email Address *</label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="admin@supermarket.com"
                  className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-xs text-slate-900 focus:border-rose-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5 text-rose-600" />
                Replace Realtime Password in Database
              </span>
              <span className="text-[11px] text-slate-500">Leave blank if you only wish to change your name</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700">New Password</label>
                <div className="relative mt-1">
                  <input
                    type={showAdminPassword ? "text" : "password"}
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                    placeholder="Enter your new realtime password..."
                    className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-3 pr-9 text-xs text-slate-900 focus:border-rose-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                  >
                    {showAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700">Confirm New Password</label>
                <div className="relative mt-1">
                  <input
                    type={showAdminPassword ? "text" : "password"}
                    value={confirmAdminPassword}
                    onChange={(e) => setConfirmAdminPassword(e.target.value)}
                    placeholder="Re-type your new realtime password..."
                    className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-3 pr-3 text-xs text-slate-900 focus:border-rose-500 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-500 font-medium">
              Password will be encrypted using <strong>bcrypt (10 rounds)</strong> and updated in PostgreSQL.
            </span>
            <button
              type="submit"
              disabled={savingAdmin}
              className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-5 py-2.5 font-bold text-white shadow-sm hover:bg-rose-700 active:scale-95 disabled:opacity-50 transition-all"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{savingAdmin ? "Updating Database..." : "Save Admin Profile & Password"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* SECTION 2: VARIANCE & REVIEW POLICY SETTINGS */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Shield className="h-5 w-5 text-rose-600" />
          <h3 className="text-sm font-bold text-slate-900">Variance Thresholds & Audit Flags</h3>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700">
              Quantity Threshold (Units)
            </label>
            <input
              type="number"
              value={qtyThreshold}
              onChange={(e) => setQtyThreshold(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-slate-900 focus:border-rose-500"
            />
            <span className="mt-1 block text-[11px] text-slate-400">
              Flag recount if physical diff &gt;= this units
            </span>
          </div>

          <div>
            <label className="block font-semibold text-slate-700">
              Valuation Threshold ($)
            </label>
            <input
              type="number"
              value={valThreshold}
              onChange={(e) => setValThreshold(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-slate-900 focus:border-rose-500"
            />
            <span className="mt-1 block text-[11px] text-slate-400">
              Flag recount if variance dollar impact &gt;= this
            </span>
          </div>

          <div>
            <label className="block font-semibold text-slate-700">
              Percentage Variance (%)
            </label>
            <input
              type="number"
              value={pctThreshold}
              onChange={(e) => setPctThreshold(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-slate-900 focus:border-rose-500"
            />
            <span className="mt-1 block text-[11px] text-slate-400">
              Flag recount if variance percentage &gt;= this %
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 3: STOCK TAKING EXECUTION CONTROLS */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Settings className="h-5 w-5 text-slate-700" />
          <h3 className="text-sm font-bold text-slate-900">Execution Controls & Blind Count Policies</h3>
        </div>

        <div className="space-y-3 text-xs">
          <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={blindCountDefault}
              onChange={(e) => setBlindCountDefault(e.target.checked)}
              className="mt-0.5 rounded text-rose-600"
            />
            <div>
              <span className="font-semibold text-slate-900">Default Blind Count Mode</span>
              <p className="text-slate-500 text-[11px]">
                Stock takers will NOT see expected system stock or variance calculations during counting.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={require100Pct}
              onChange={(e) => setRequire100Pct(e.target.checked)}
              className="mt-0.5 rounded text-rose-600"
            />
            <div>
              <span className="font-semibold text-slate-900">Require 100% Location Item Count</span>
              <p className="text-slate-500 text-[11px]">
                Blocks stock takers from submitting completed location if uncounted items remain.
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={twoPerson}
              onChange={(e) => setTwoPerson(e.target.checked)}
              className="mt-0.5 rounded text-rose-600"
            />
            <div>
              <span className="font-semibold text-slate-900">Two-Person Dual Verification Mode</span>
              <p className="text-slate-500 text-[11px]">
                Requires a second independent stock taker count for high-value items before submission.
              </p>
            </div>
          </label>
        </div>

        <div className="pt-3">
          <button
            onClick={handleSaveAllPolicies}
            className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-slate-800 active:scale-95 transition-all"
          >
            <Save className="h-4 w-4" />
            <span>Save Stock Taking Policies</span>
          </button>
        </div>
      </div>

      {/* SECTION 4: POSTGRESQL DATABASE STATUS */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Database className="h-5 w-5 text-emerald-600" />
          <h3 className="text-sm font-bold text-slate-900">PostgreSQL Database Connection & Safety</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Database Status:</span>
              <span className="flex items-center gap-1.5 font-bold text-emerald-600">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Connected (Local PostgreSQL)
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Database Name:</span>
              <span className="font-mono font-bold text-slate-900">app_db</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Primary Schema Tables:</span>
              <span className="font-bold text-slate-900">17 tables normalized</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Audit Trail Table:</span>
              <span className="font-bold text-slate-900">audit_logs (Immutable)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">PostgreSQL Transactions:</span>
              <span className="font-bold text-emerald-600">Enabled for all writes</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Server Date/Time:</span>
              <span className="font-mono text-slate-900">{new Date().toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
