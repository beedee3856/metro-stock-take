"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Package,
  Plus,
  Search,
  UploadCloud,
  Download,
  Filter,
  Eye,
  Edit2,
  CheckCircle,
  AlertCircle,
  X,
  History,
  Barcode,
  Layers,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from "lucide-react";
import * as XLSX from "xlsx";

interface Item {
  id: string;
  itemName: string;
  itemCode: string;
  eanCode: string;
  sku?: string | null;
  brand?: string | null;
  uom: string;
  packSize: string;
  costPrice: string;
  sellingPrice: string;
  taxRate: string;
  currentSystemStock: number;
  isActive: boolean;
  departmentName?: string;
  categoryName?: string;
  defaultLocationCode?: string;
}

interface CountHistory {
  id: string;
  createdAt: string;
  systemQuantity: number;
  physicalQuantity: number;
  varianceQuantity: number;
  varianceValue: string;
  countStatus: string;
  stockTakeNumber?: string;
  locationCode?: string;
  countedBy?: string;
}

interface ItemMasterViewProps {
  onOpenImportWizard: () => void;
}

export function ItemMasterView({ onOpenImportWizard }: ItemMasterViewProps) {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentId, setDepartmentId] = useState("ALL");
  const [departmentsList, setDepartmentsList] = useState<{ id: string; name: string }[]>([]);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [historyItem, setHistoryItem] = useState<Item | null>(null);
  const [historyRows, setHistoryRows] = useState<CountHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Form State
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formEan, setFormEan] = useState("");
  const [formSku, setFormSku] = useState("");
  const [formBrand, setFormBrand] = useState("");
  const [formUom, setFormUom] = useState("PCS");
  const [formPackSize, setFormPackSize] = useState("1");
  const [formCost, setFormCost] = useState("0.00");
  const [formSelling, setFormSelling] = useState("0.00");
  const [formTax, setFormTax] = useState("16.00");
  const [formStock, setFormStock] = useState("0");
  const [formDeptId, setFormDeptId] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Fetch departments
  useEffect(() => {
    fetch("/api/departments")
      .then((r) => r.json())
      .then((d) => {
        if (d.departments) setDepartmentsList(d.departments);
      })
      .catch(() => {});
  }, []);

  // Fetch items list
  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        query: searchQuery,
        departmentId,
        page: String(page),
        limit: "20",
      });

      const res = await fetch(`/api/items?${queryParams}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setSelectedItemIds([]);
        if (data.pagination) {
          setTotalPages(data.pagination.totalPages || 1);
          setTotalItems(data.pagination.total || 0);
        }
      }
    } catch (err) {
      console.error("Failed to fetch items", err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, departmentId, page]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleDeleteItems = async (deleteAll = false) => {
    const count = deleteAll ? totalItems : selectedItemIds.length;
    if (count === 0) return;
    const confirmed = window.confirm(
      deleteAll
        ? `Delete all ${count} items from Items & Barcodes? This cannot be undone.`
        : `Delete ${count} selected item${count === 1 ? "" : "s"}? This cannot be undone.`
    );
    if (!confirmed) return;

    try {
      setDeleting(true);
      const res = await fetch("/api/items", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(deleteAll ? { deleteAll: true } : { ids: selectedItemIds }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error || "Unable to delete items.");
        return;
      }
      setErrorMsg("");
      await fetchItems();
    } catch {
      setErrorMsg("Network error deleting items.");
    } finally {
      setDeleting(false);
    }
  };

  const visibleItemIds = items.map((item) => item.id);
  const allVisibleSelected = visibleItemIds.length > 0 && visibleItemIds.every((id) => selectedItemIds.includes(id));

  // Open history modal
  const handleOpenHistory = async (item: Item) => {
    setHistoryItem(item);
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/items/${item.id}`);
      if (res.ok) {
        const json = await res.json();
        setHistoryRows(json.history || []);
      }
    } catch (err) {
      console.error("Failed to load history", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Open edit modal
  const handleOpenEdit = (item: Item) => {
    setEditItem(item);
    setFormName(item.itemName);
    setFormCode(item.itemCode);
    setFormEan(item.eanCode);
    setFormSku(item.sku || "");
    setFormBrand(item.brand || "");
    setFormUom(item.uom);
    setFormPackSize(item.packSize);
    setFormCost(item.costPrice);
    setFormSelling(item.sellingPrice);
    setFormTax(item.taxRate);
    setFormStock(String(item.currentSystemStock));
    setErrorMsg("");
    setCreateModalOpen(true);
  };

  // Open create modal
  const handleOpenCreate = () => {
    setEditItem(null);
    setFormName("");
    setFormCode("");
    setFormEan("");
    setFormSku("");
    setFormBrand("");
    setFormUom("PCS");
    setFormPackSize("1");
    setFormCost("1.00");
    setFormSelling("1.50");
    setFormTax("16.00");
    setFormStock("20");
    setFormDeptId(departmentsList[0]?.id || "");
    setErrorMsg("");
    setCreateModalOpen(true);
  };

  // Save Item (Create or Update)
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!formName.trim() || !formCode.trim() || !formEan.trim()) {
      setErrorMsg("Item Name, Item Code, and EAN Code are required.");
      return;
    }

    try {
      setSaving(true);
      const url = editItem ? `/api/items/${editItem.id}` : "/api/items";
      const method = editItem ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemName: formName.trim(),
          itemCode: formCode.trim(),
          eanCode: formEan.trim(),
          sku: formSku.trim() || null,
          brand: formBrand.trim() || null,
          uom: formUom,
          packSize: formPackSize,
          costPrice: formCost,
          sellingPrice: formSelling,
          taxRate: formTax,
          currentSystemStock: parseInt(formStock, 10) || 0,
          departmentId: formDeptId || null,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error || "Failed to save item.");
        return;
      }

      setCreateModalOpen(false);
      fetchItems();
    } catch (err) {
      setErrorMsg("Network error saving item.");
    } finally {
      setSaving(false);
    }
  };

  // Download Sample Import Template
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        "Item Name": "Fresh Dairy Milk 500ml",
        "Item Code": "DAIRY-MILK-500",
        "EAN Code": "6161109990011",
        "SKU": "SKU-MILK-500",
        "Department": "Beverages",
        "Category": "Dairy",
        "Subcategory": "Fresh Milk",
        "Brand": "Brookside",
        "Unit of Measure": "PCS",
        "Pack Size": "1",
        "Cost Price": 0.55,
        "Selling Price": 0.85,
        "Tax": 16,
        "Reorder Level": 25,
        "Supplier": "Brookside Dairy Ltd",
        "Opening Stock": 100,
      },
      {
        "Item Name": "Whole Grain Cornflakes 500g",
        "Item Code": "GROC-CORN-500",
        "EAN Code": "6161109990028",
        "SKU": "SKU-CORN-500",
        "Department": "Packaged Groceries",
        "Category": "Breakfast Cereals",
        "Subcategory": "Cereals",
        "Brand": "Kellogg's",
        "Unit of Measure": "BOX",
        "Pack Size": "1",
        "Cost Price": 2.80,
        "Selling Price": 4.10,
        "Tax": 16,
        "Reorder Level": 15,
        "Supplier": "Bidco Africa",
        "Opening Stock": 45,
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Item_Master_Template");
    XLSX.writeFile(workbook, "Item_Master_Import_Template.xlsx");
  };

  return (
    <div className="space-y-4">
      {/* Top Actions & Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Items & Barcodes</h2>
          <p className="text-xs text-slate-500">
            Maintain catalog of products, barcodes, EAN codes, pricing, and system stock levels
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Download Template */}
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
          >
            <Download className="h-4 w-4 text-slate-500" />
            <span>Download Template</span>
          </button>

          {/* Import Wizard Button */}
          {user?.role === "ADMINISTRATOR" && (
            <button
              onClick={onOpenImportWizard}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
            >
              <UploadCloud className="h-4 w-4 text-rose-600" />
              <span>Import Master</span>
            </button>
          )}

          {/* Add Item */}
          {user?.role === "ADMINISTRATOR" && (
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-700 active:scale-98 transition-all"
            >
              <Plus className="h-4 w-4" />
              <span>Add Product</span>
            </button>
          )}
          {user?.role === "ADMINISTRATOR" && (
            <>
              <button
                onClick={() => handleDeleteItems(false)}
                disabled={deleting || selectedItemIds.length === 0}
                className="flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-xs font-semibold text-rose-700 shadow-xs hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete Selected ({selectedItemIds.length})</span>
              </button>
              <button
                onClick={() => handleDeleteItems(true)}
                disabled={deleting || totalItems === 0}
                className="flex items-center gap-1.5 rounded-xl bg-rose-700 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" />
                <span>Delete All</span>
              </button>
            </>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
          {errorMsg}
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search by Item Name, Code, EAN, or SKU..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-xs text-slate-800 focus:border-rose-500 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500">Department:</label>
          <select
            value={departmentId}
            onChange={(e) => {
              setDepartmentId(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-rose-500 focus:outline-hidden"
          >
            <option value="ALL">All Departments</option>
            {departmentsList.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Item Master Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(event) => setSelectedItemIds(event.target.checked ? [...new Set([...selectedItemIds, ...visibleItemIds])] : selectedItemIds.filter((id) => !visibleItemIds.includes(id)))}
                    aria-label="Select all visible items"
                  />
                </th>
                <th className="px-4 py-3">Product Name</th>
                <th className="px-4 py-3">Item Code</th>
                <th className="px-4 py-3">EAN-13 Barcode</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3">Cost Price</th>
                <th className="px-4 py-3">Selling Price</th>
                <th className="px-4 py-3">System Stock</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    Loading items from PostgreSQL...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    No matching items found in Item Master.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedItemIds.includes(item.id)}
                        onChange={(event) => setSelectedItemIds((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))}
                        aria-label={`Select ${item.itemName}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{item.itemName}</p>
                      {item.brand && <span className="text-[10px] text-slate-400">{item.brand}</span>}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">{item.itemCode}</td>
                    <td className="px-4 py-3 font-mono text-slate-600 flex items-center gap-1.5">
                      <Barcode className="h-3.5 w-3.5 text-slate-400" />
                      <span>{item.eanCode}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{item.departmentName || "General"}</td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                        {item.uom}
                      </span>
                    </td>
                    <td className="px-4 py-3">Ksh {item.costPrice}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">Ksh {item.sellingPrice}</td>
                    <td className="px-4 py-3">
                      <span className="font-bold text-slate-900">{item.currentSystemStock}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* History */}
                        <button
                          onClick={() => handleOpenHistory(item)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          title="View Past Count History"
                        >
                          <History className="h-4 w-4" />
                        </button>

                        {/* Edit */}
                        {user?.role === "ADMINISTRATOR" && (
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            title="Edit Item"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
          <span>
            Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalItems} total items)
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* CREATE / EDIT ITEM MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editItem ? "Edit Product Details" : "Add New Supermarket Item"}
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

            <form onSubmit={handleSaveItem} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700">Item Name *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Coca-Cola 500ml PET"
                  className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-rose-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700">Item Code *</label>
                  <input
                    type="text"
                    required
                    disabled={!!editItem}
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="e.g. BEV-CC-500"
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-rose-500 focus:outline-hidden font-mono disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700">EAN Code (Barcode) *</label>
                  <input
                    type="text"
                    required
                    value={formEan}
                    onChange={(e) => setFormEan(e.target.value)}
                    placeholder="e.g. 5449000000996"
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-rose-500 focus:outline-hidden font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700">Cost Price (Ksh)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formCost}
                    onChange={(e) => setFormCost(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700">Selling Price (Ksh)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formSelling}
                    onChange={(e) => setFormSelling(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-rose-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700">System Stock</label>
                  <input
                    type="number"
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-rose-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700">Unit of Measure</label>
                  <select
                    value={formUom}
                    onChange={(e) => setFormUom(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-rose-500"
                  >
                    <option value="PCS">PCS (Pieces)</option>
                    <option value="PACK">PACK</option>
                    <option value="BOX">BOX</option>
                    <option value="BTL">BTL (Bottle)</option>
                    <option value="CAN">CAN</option>
                    <option value="KG">KG (Kilograms)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700">Department</label>
                  <select
                    value={formDeptId}
                    onChange={(e) => setFormDeptId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-rose-500"
                  >
                    {departmentsList.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

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
                  {saving ? "Saving..." : "Save Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRODUCT COUNT HISTORY DRAWER (Requirement 39) */}
      {historyItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Product Count History</h3>
                <p className="text-xs text-slate-500">
                  {historyItem.itemName} ({historyItem.itemCode})
                </p>
              </div>
              <button onClick={() => setHistoryItem(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 rounded-xl bg-slate-50 p-3 flex justify-between text-xs">
              <span>Current System Stock:</span>
              <strong className="text-slate-900">{historyItem.currentSystemStock} {historyItem.uom}</strong>
            </div>

            <div className="mt-4 max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Stock Take</th>
                    <th className="px-3 py-2">Location</th>
                    <th className="px-3 py-2">Physical</th>
                    <th className="px-3 py-2">Variance</th>
                    <th className="px-3 py-2">Counted By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingHistory ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400">
                        Loading past counts...
                      </td>
                    </tr>
                  ) : historyRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400">
                        No previous audit counts found for this item.
                      </td>
                    </tr>
                  ) : (
                    historyRows.map((h) => (
                      <tr key={h.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-500">
                          {new Date(h.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-2 font-mono font-semibold">{h.stockTakeNumber}</td>
                        <td className="px-3 py-2">{h.locationCode}</td>
                        <td className="px-3 py-2 font-bold text-slate-900">{h.physicalQuantity}</td>
                        <td className="px-3 py-2 font-semibold">
                          <span className={h.varianceQuantity > 0 ? "text-emerald-600" : h.varianceQuantity < 0 ? "text-rose-600" : "text-slate-500"}>
                            {h.varianceQuantity > 0 ? `+${h.varianceQuantity}` : h.varianceQuantity}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-700">{h.countedBy}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
