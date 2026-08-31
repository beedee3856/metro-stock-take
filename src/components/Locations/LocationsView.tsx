"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  MapPin,
  Plus,
  Search,
  Store,
  Layers,
  Barcode,
  Printer,
  X,
  CheckCircle,
} from "lucide-react";

interface LocationItem {
  id: string;
  locationCode: string;
  locationName: string;
  aisle?: string | null;
  shelfSection?: string | null;
  barcode?: string | null;
  description?: string | null;
  status: string;
  storeName?: string;
  departmentName?: string;
}

export function LocationsView() {
  const { user } = useAuth();
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Create Modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [locationCode, setLocationCode] = useState("");
  const [locationName, setLocationName] = useState("");
  const [aisle, setAisle] = useState("");
  const [shelfSection, setShelfSection] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // Barcode Tag Print Modal
  const [printTagLoc, setPrintTagLoc] = useState<LocationItem | null>(null);

  const fetchLocations = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/locations?query=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        const json = await res.json();
        setLocations(json.locations || []);
      }
    } catch (err) {
      console.error("Failed to load locations", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, [searchQuery]);

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationCode.trim() || !locationName.trim()) return;

    try {
      setSaving(true);
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationCode,
          locationName,
          aisle,
          shelfSection,
          description,
        }),
      });

      if (res.ok) {
        setCreateModalOpen(false);
        setLocationCode("");
        setLocationName("");
        setAisle("");
        setShelfSection("");
        setDescription("");
        fetchLocations();
      }
    } catch (err) {
      console.error("Failed to create location", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Supermarket Locations & Aisles</h2>
          <p className="text-xs text-slate-500">
            Define hierarchical store zones, aisles, shelf bays, cold rooms and bulk storage
          </p>
        </div>

        {user?.role === "ADMINISTRATOR" && (
          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-700 active:scale-98 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>Add Location</span>
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="flex items-center rounded-2xl border border-slate-200 bg-white p-3 shadow-xs max-w-md">
        <Search className="h-4 w-4 text-slate-400 mr-2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by location code or aisle..."
          className="w-full text-xs text-slate-800 focus:outline-hidden"
        />
      </div>

      {/* Locations Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
              <tr>
                <th className="px-4 py-3">Location Code</th>
                <th className="px-4 py-3">Location Description</th>
                <th className="px-4 py-3">Aisle / Shelf</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Barcode Label</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Loading locations...
                  </td>
                </tr>
              ) : locations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No locations defined.
                  </td>
                </tr>
              ) : (
                locations.map((loc) => (
                  <tr key={loc.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">{loc.locationCode}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{loc.locationName}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {loc.aisle ? `Aisle ${loc.aisle}` : ""} {loc.shelfSection ? `(${loc.shelfSection})` : ""}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{loc.departmentName || "Storewide"}</td>
                    <td className="px-4 py-3 font-mono text-slate-500 flex items-center gap-1">
                      <Barcode className="h-3.5 w-3.5 text-slate-400" />
                      <span>{loc.barcode || `LOC-${loc.locationCode}`}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                        {loc.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setPrintTagLoc(loc)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-slate-700 hover:bg-slate-50 text-[11px] font-semibold"
                        title="Print Barcode Tag"
                      >
                        <Printer className="h-3.5 w-3.5 text-rose-600" />
                        <span>Print Tag</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE LOCATION MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Add New Location</h3>
              <button onClick={() => setCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLocation} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700">Location Code *</label>
                <input
                  type="text"
                  required
                  value={locationCode}
                  onChange={(e) => setLocationCode(e.target.value)}
                  placeholder="e.g. AISLE-09"
                  className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-rose-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700">Location Name *</label>
                <input
                  type="text"
                  required
                  value={locationName}
                  onChange={(e) => setLocationName(e.target.value)}
                  placeholder="e.g. Aisle 09 — Bakery & Fresh Breads"
                  className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700">Aisle Number</label>
                  <input
                    type="text"
                    value={aisle}
                    onChange={(e) => setAisle(e.target.value)}
                    placeholder="09"
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700">Shelf / Section</label>
                  <input
                    type="text"
                    value={shelfSection}
                    onChange={(e) => setShelfSection(e.target.value)}
                    placeholder="Bay A to C"
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Physical placement details..."
                  className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-rose-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
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
                  {saving ? "Creating..." : "Create Location"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINTABLE LOCATION BARCODE TAG MODAL */}
      {printTagLoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95 text-center">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-500">AISLE BARCODE TAG</span>
              <button onClick={() => setPrintTagLoc(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 border-2 border-dashed border-slate-800 rounded-xl p-4 bg-slate-50">
              <p className="text-[11px] font-bold tracking-wider text-rose-600 uppercase">
                METRO GRAND HYPERMARKET
              </p>
              <h3 className="mt-1 text-2xl font-black font-mono tracking-tight text-slate-900">
                {printTagLoc.locationCode}
              </h3>
              <p className="mt-1 text-xs text-slate-700 font-medium">{printTagLoc.locationName}</p>

              <div className="my-3 flex justify-center">
                <div className="border border-slate-300 bg-white p-2 rounded">
                  <div className="h-12 w-48 bg-repeating-linear-gradient flex items-center justify-center font-mono text-[10px] text-slate-600 tracking-widest border-t-2 border-b-2 border-slate-900">
                    ||||| | |||| ||| || |||| |||
                  </div>
                </div>
              </div>
              <p className="text-xs font-mono font-bold text-slate-900">
                {printTagLoc.barcode || `LOC-${printTagLoc.locationCode}`}
              </p>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setPrintTagLoc(null)}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white hover:bg-slate-800 flex items-center justify-center gap-1.5"
              >
                <Printer className="h-4 w-4" />
                <span>Print Tag</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
