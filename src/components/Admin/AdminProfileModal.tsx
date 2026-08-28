"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  User,
  Lock,
  Mail,
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  X,
  Eye,
  EyeOff,
  Save,
  Building,
} from "lucide-react";

interface AdminProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AdminProfileModal({ isOpen, onClose }: AdminProfileModalProps) {
  const { user, refreshUser } = useAuth();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName || "");
      setUsername(user.username || "");
      setEmail(user.email || "");
      setPassword("");
      setConfirmPassword("");
      setStatusMessage(null);
    }
  }, [user, isOpen]);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    if (!fullName.trim()) {
      setStatusMessage({ type: "error", text: "Administrator name is required." });
      return;
    }

    if (password) {
      if (password.length < 6) {
        setStatusMessage({ type: "error", text: "New password must be at least 6 characters." });
        return;
      }
      if (password !== confirmPassword) {
        setStatusMessage({ type: "error", text: "New password and confirmation do not match." });
        return;
      }
    }

    try {
      setSaving(true);
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          username: username.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          password: password ? password.trim() : undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setStatusMessage({ type: "error", text: json.error || "Failed to update profile." });
        return;
      }

      await refreshUser();
      setStatusMessage({
        type: "success",
        text: "Administrator name and password updated successfully in PostgreSQL database!",
      });
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setStatusMessage({ type: "error", text: "Network error saving profile changes." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Administrator Profile & Security</h3>
              <p className="text-xs text-slate-500">Edit administrator name and update realtime password</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Feedback Alert */}
        {statusMessage && (
          <div
            className={`mt-4 flex items-center gap-2 rounded-xl p-3 text-xs font-semibold ${
              statusMessage.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-rose-50 text-rose-800 border border-rose-200"
            }`}
          >
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSave} className="mt-4 space-y-4 text-xs">
          {/* Administrator Full Name */}
          <div>
            <label className="block font-semibold text-slate-700">Administrator Full Name *</label>
            <div className="relative mt-1">
              <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Your Real Full Name"
                className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-xs text-slate-900 focus:border-rose-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Username */}
            <div>
              <label className="block font-semibold text-slate-700">Login Username *</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 font-mono focus:border-rose-500 focus:outline-hidden"
              />
            </div>

            {/* Email Address */}
            <div>
              <label className="block font-semibold text-slate-700">Email Address *</label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@supermarket.com"
                  className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-xs text-slate-900 focus:border-rose-500 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Password Update Section */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5 text-rose-600" />
                Replace Realtime Password
              </span>
              <span className="text-[10px] text-slate-500 font-medium">Leave empty to keep unchanged</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700">New Password</label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-8 text-xs text-slate-900 focus:border-rose-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700">Confirm New Password</label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 focus:border-rose-500 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Database info note */}
          <p className="text-[11px] text-slate-500">
            Changes will be immediately hashed via <strong>bcrypt</strong> and persisted in the local <strong>PostgreSQL</strong> database.
          </p>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-5 py-2 font-bold text-white shadow-sm hover:bg-rose-700 active:scale-95 disabled:opacity-50 transition-all"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{saving ? "Updating Database..." : "Save to Database"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
