"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { validatePasswordStrength, type PasswordStrength } from "@/lib/passwordValidation";
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
  AlertCircle,
  Trash2,
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
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength | null>(null);

  // Delete User Modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserItem | null>(null);
  const [deleting, setDeleting] = useState(false);

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

    // For new users, password is REQUIRED and must be strong
    if (!editUser) {
      if (!password || password.trim().length === 0) {
        setErrorMsg("Password is required to create a new user.");
        return;
      }
      const strength = validatePasswordStrength(password);
      // Require ALL 5 criteria: 8+ chars, uppercase, lowercase, number, special
      if (!strength.meets.minLength || !strength.meets.uppercase || !strength.meets.lowercase || !strength.meets.numbers || !strength.meets.special) {
        setErrorMsg("Password must meet ALL requirements: 8+ characters, uppercase letter, lowercase letter, number, and special character (!@#$%^&*).");
        return;
      }
    }

    // For editing, password change is optional but if provided must be strong
    if (editUser && password && password.trim().length > 0) {
      const strength = validatePasswordStrength(password);
      // Require ALL 5 criteria: 8+ chars, uppercase, lowercase, number, special
      if (!strength.meets.minLength || !strength.meets.uppercase || !strength.meets.lowercase || !strength.meets.numbers || !strength.meets.special) {
        setErrorMsg("New password must meet ALL requirements: 8+ characters, uppercase letter, lowercase letter, number, and special character (!@#$%^&*).");
        return;
      }
    }

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

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    try {
      setDeleting(true);
      const res = await fetch(`/api/users?id=${userToDelete.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      const json = await res.json();
      if (!res.ok) {
        alert(json.error || "Failed to delete user");
        return;
      }

      setDeleteModalOpen(false);
      setUserToDelete(null);
      fetchUsers();
    } catch (err) {
      alert("Network error deleting user account.");
    } finally {
      setDeleting(false);
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
            <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700 sticky top-0">
              <tr>
                <th className="px-4 py-3">Full Name</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Email Address</th>
                <th className="px-4 py-3">Assigned Role</th>
                <th className="px-4 py-3">Store Branch</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last Login</th>
                <th className="px-4 py-3 text-right sticky right-0 bg-slate-50">Actions</th>
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
                    <td className="px-4 py-3 text-right sticky right-0 bg-white border-l border-slate-100">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenEdit(u)}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 shadow-xs whitespace-nowrap"
                        >
                          <Edit2 className="h-3.5 w-3.5 inline mr-1 text-slate-500" />
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setUserToDelete(u);
                            setDeleteModalOpen(true);
                          }}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 shadow-xs whitespace-nowrap"
                        >
                          <Trash2 className="h-3.5 w-3.5 inline mr-1 text-rose-500" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
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
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (e.target.value) {
                      setPasswordStrength(validatePasswordStrength(e.target.value));
                    } else {
                      setPasswordStrength(null);
                    }
                  }}
                  placeholder={editUser ? "New password..." : "••••••••"}
                  className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-slate-900 focus:border-rose-500"
                />

                {/* Password Strength Indicator */}
                {password && passwordStrength && (
                  <div className="mt-3 space-y-2">
                    {/* Strength Bar */}
                    <div className="flex gap-1">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={`h-1.5 flex-1 rounded-full transition-colors ${
                            i < passwordStrength.score
                              ? passwordStrength.level === "WEAK"
                                ? "bg-red-500"
                                : passwordStrength.level === "FAIR"
                                ? "bg-orange-500"
                                : passwordStrength.level === "GOOD"
                                ? "bg-yellow-500"
                                : passwordStrength.level === "STRONG"
                                ? "bg-emerald-500"
                                : "bg-emerald-600"
                              : "bg-slate-200"
                          }`}
                        />
                      ))}
                    </div>

                    {/* Strength Level & Message */}
                    <div className="flex items-start gap-2">
                      <div
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap ${
                          passwordStrength.level === "WEAK"
                            ? "bg-red-50 text-red-700"
                            : passwordStrength.level === "FAIR"
                            ? "bg-orange-50 text-orange-700"
                            : passwordStrength.level === "GOOD"
                            ? "bg-yellow-50 text-yellow-700"
                            : passwordStrength.level === "STRONG"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {passwordStrength.level === "VERY_STRONG" ? "VERY STRONG" : passwordStrength.level}
                      </div>
                      <p className="text-[11px] text-slate-600 flex-1">{passwordStrength.message}</p>
                    </div>

                    {/* Requirements Checklist */}
                    <div className="space-y-1.5 bg-slate-50 p-2 rounded-lg border border-slate-200">
                      <p className="text-[10px] font-semibold text-slate-700 uppercase tracking-wider">Requirements:</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-1.5">
                          {passwordStrength.meets.minLength ? (
                            <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <AlertCircle className="h-3.5 w-3.5 text-slate-300" />
                          )}
                          <span className={`text-[10px] ${passwordStrength.meets.minLength ? "text-emerald-700 font-medium" : "text-slate-500"}`}>
                            8+ characters
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {passwordStrength.meets.uppercase ? (
                            <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <AlertCircle className="h-3.5 w-3.5 text-slate-300" />
                          )}
                          <span className={`text-[10px] ${passwordStrength.meets.uppercase ? "text-emerald-700 font-medium" : "text-slate-500"}`}>
                            Uppercase (A-Z)
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {passwordStrength.meets.lowercase ? (
                            <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <AlertCircle className="h-3.5 w-3.5 text-slate-300" />
                          )}
                          <span className={`text-[10px] ${passwordStrength.meets.lowercase ? "text-emerald-700 font-medium" : "text-slate-500"}`}>
                            Lowercase (a-z)
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {passwordStrength.meets.numbers ? (
                            <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <AlertCircle className="h-3.5 w-3.5 text-slate-300" />
                          )}
                          <span className={`text-[10px] ${passwordStrength.meets.numbers ? "text-emerald-700 font-medium" : "text-slate-500"}`}>
                            Number (0-9)
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 col-span-2">
                          {passwordStrength.meets.special ? (
                            <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <AlertCircle className="h-3.5 w-3.5 text-slate-300" />
                          )}
                          <span className={`text-[10px] ${passwordStrength.meets.special ? "text-emerald-700 font-medium" : "text-slate-500"}`}>
                            Special character (!@#$%^&*)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
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

      {/* DELETE USER CONFIRMATION MODAL */}
      {deleteModalOpen && userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Delete User Account</h3>
              <button onClick={() => setDeleteModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="rounded-xl bg-rose-50 p-4 border border-rose-200">
                <p className="text-sm font-semibold text-rose-900">
                  ⚠️ This action cannot be undone!
                </p>
              </div>

              <div className="space-y-2 text-xs text-slate-700">
                <p>
                  You are about to permanently delete the user account:
                </p>
                <div className="rounded-lg bg-slate-100 p-3 border border-slate-200">
                  <p className="font-bold text-slate-900">{userToDelete.fullName}</p>
                  <p className="text-slate-600">@{userToDelete.username}</p>
                  <p className="text-slate-500">{userToDelete.email}</p>
                </div>
                <p className="font-semibold text-slate-800">
                  All associated data, audit logs, and assignments will be preserved for historical records, but this account cannot be used to log in.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(false)}
                  disabled={deleting}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteUser}
                  disabled={deleting}
                  className="rounded-xl bg-rose-600 px-5 py-2 font-bold text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {deleting ? "Deleting..." : "Delete Account"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
