"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Users,
  UserPlus,
  Shield,
  Search,
  Key,
  CheckCircle,
  XCircle,
  X,
  Edit2,
} from "lucide-react";

interface UserItem {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: string;
  phone?: string | null;
  isActive: boolean;
  lastLoginAt?: string | null;
  storeName?: string | null;
}

export function UsersView() {
  const { user } = useAuth();
  const [usersList, setUsersList] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Create User Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserItem | null>(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("STOCK_TAKER");
  const [phone, setPhone] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/users");
      if (res.ok) {
        const json = await res.json();
        setUsersList(json.users || []);
      }
    } catch (err) {
      console.error("Failed to load users", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleOpenCreate = () => {
    setEditUser(null);
    setUsername("");
    setEmail("");
    setPassword("");
    setFullName("");
    setRole("STOCK_TAKER");
    setPhone("");
    setIsActive(true);
    setErrorMsg("");
    setCreateModalOpen(true);
  };

  const handleOpenEdit = (u: UserItem) => {
    setEditUser(u);
    setUsername(u.username);
    setEmail(u.email);
    setPassword("");
    setFullName(u.fullName);
    setRole(u.role);
    setPhone(u.phone || "");
    setIsActive(u.isActive);
    setErrorMsg("");
    setCreateModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    try {
      setSaving(true);
      const url = editUser ? "/api/users" : "/api/users";
      const method = editUser ? "PUT" : "POST";

      const payload: Record<string, unknown> = editUser
        ? {
            id: editUser.id,
            fullName,
            username,
            email,
            role,
            phone,
            isActive,
            newPassword: password || undefined,
          }
        : {
            username,
            email,
            password,
            fullName,
            role,
            phone,
          };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error || "Failed to save user");
        return;
      }

      setCreateModalOpen(false);
      fetchUsers();
    } catch (err) {
      setErrorMsg("Network error saving user account.");
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = usersList.filter(
    (u) =>
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">User Management & Role-Based Access</h2>
          <p className="text-xs text-slate-500">
            Manage administrators, stock-taking supervisors, count staff, store managers, and auditors
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-700 active:scale-98 transition-all"
        >
          <UserPlus className="h-4 w-4" />
          <span>Add System User</span>
        </button>
      </div>

      {/* Search Filter */}
      <div className="flex items-center rounded-2xl border border-slate-200 bg-white p-3 shadow-xs max-w-md">
        <Search className="h-4 w-4 text-slate-400 mr-2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by full name, username, or role..."
          className="w-full text-xs text-slate-800 focus:outline-hidden"
        />
      </div>

      {/* Users Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
              <tr>
                <th className="px-4 py-3">Full Name</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Email Address</th>
                <th className="px-4 py-3">Assigned Role</th>
                <th className="px-4 py-3">Store Branch</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last Login</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Loading users...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No users matching criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-900">{u.fullName}</td>
                    <td className="px-4 py-3 font-mono text-slate-700">{u.username}</td>
                    <td className="px-4 py-3 text-slate-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          u.role === "ADMINISTRATOR"
                            ? "bg-rose-100 text-rose-800"
                            : u.role === "SUPERVISOR"
                            ? "bg-purple-100 text-purple-800"
                            : u.role === "STOCK_TAKER"
                            ? "bg-emerald-100 text-emerald-800"
                            : u.role === "STORE_MANAGER"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-200 text-slate-800"
                        }`}
                      >
                        {u.role.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{u.storeName || "All Branches"}</td>
                    <td className="px-4 py-3">
                      {u.isActive ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                          <CheckCircle className="h-3 w-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                          <XCircle className="h-3 w-3" /> Disabled
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-[11px]">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "Never"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleOpenEdit(u)}
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
                      >
                        <Edit2 className="h-3.5 w-3.5 inline mr-1 text-slate-500" />
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT USER MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editUser ? "Edit User & Role" : "Create New User"}
              </h3>
              <button onClick={() => setCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="mt-3 rounded-xl bg-rose-50 p-2.5 text-xs text-rose-700 border border-rose-200">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSaveUser} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700">Full Name *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-slate-900 focus:border-rose-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700">Username *</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin"
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-slate-900 focus:border-rose-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@supermarket.com"
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-slate-900 focus:border-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700">
                  {editUser ? "Reset Password (leave empty to keep current)" : "Password *"}
                </label>
                <input
                  type="password"
                  required={!editUser}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={editUser ? "New password..." : "••••••••"}
                  className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-slate-900 focus:border-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700">Role *</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-slate-900 focus:border-rose-500"
                  >
                    <option value="STOCK_TAKER">Stock Taker (Count Staff)</option>
                    <option value="SUPERVISOR">Stock-Taking Supervisor</option>
                    <option value="STORE_MANAGER">Store Manager</option>
                    <option value="AUDITOR">Internal Auditor</option>
                    <option value="ADMINISTRATOR">Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700">Phone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+254 700 000 000"
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-slate-900 focus:border-rose-500"
                  />
                </div>
              </div>

              {editUser && (
                <div className="pt-2">
                  <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="rounded text-rose-600"
                    />
                    <span>Account is Active</span>
                  </label>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-rose-600 px-5 py-2 font-bold text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : editUser ? "Update User" : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
