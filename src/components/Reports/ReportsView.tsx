"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  FileBarChart,
  FileSpreadsheet,
  FileText,
  Printer,
  Download,
  Filter,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { exportToExcel, exportDetailedPDF } from "@/lib/exportUtils";

export function ReportsView() {
  const { user } = useAuth();
  const [reportType, setReportType] = useState<
    "SUMMARY" | "DETAILED" | "VARIANCE" | "LOCATIONS" | "PERFORMANCE" | "RECOUNTS" | "AUDIT"
  >("SUMMARY");

  const [stockTakes, setStockTakes] = useState<{ id: string; stockTakeNumber: string; name: string }[]>([]);
  const [selectedSTId, setSelectedSTId] = useState("");
  const [reportData, setReportData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch available stock takes for dropdown
  useEffect(() => {
    fetch("/api/stock-takes")
      .then((r) => r.json())
      .then((d) => {
        if (d.stockTakes && d.stockTakes.length > 0) {
          setStockTakes(d.stockTakes);
          setSelectedSTId(d.stockTakes[0].id);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch report data
  const fetchReport = useCallback(async () => {
    if (!selectedSTId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/reports?type=${reportType}&stockTakeId=${selectedSTId}`);
      if (res.ok) {
        const json = await res.json();
        setReportData(json);
      }
    } catch (err) {
      console.error("Failed to load report data", err);
    } finally {
      setLoading(false);
    }
  }, [reportType, selectedSTId]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // Export to Excel handler
  const handleExportExcel = () => {
    if (!reportData) return;
    const stNumber = (reportData.stockTake as { stockTakeNumber?: string })?.stockTakeNumber || "ST-REPORT";

    let rows: Record<string, unknown>[] = [];
    if (reportType === "SUMMARY") {
      const d = reportData.data as Record<string, unknown>;
      rows = [d];
    } else if (Array.isArray(reportData.rows)) {
      rows = reportData.rows as Record<string, unknown>[];
    }

    if (rows.length === 0) {
      alert("No data available to export.");
      return;
    }

    exportToExcel(rows, `${stNumber}-${reportType}-Report`);
  };

  // Export to PDF handler
  const handleExportPDF = () => {
    if (!reportData) return;
    const st = (reportData.stockTake as Record<string, string>) || {};
    const stNumber = st.stockTakeNumber || "ST-REPORT";
    const storeName = st.storeName || "Metro Grand Hypermarket";

    let columns: string[] = [];
    let rows: (string | number)[][] = [];

    if (reportType === "SUMMARY") {
      const d = (reportData.data as Record<string, unknown>) || {};
      columns = ["Metric", "Value"];
      rows = [
        ["Total Locations", String(d.totalLocations || 0)],
        ["Completed Locations", String(d.completedLocations || 0)],
        ["Total Expected Items", String(d.totalExpected || 0)],
        ["Total Physical Counted", String(d.totalCounted || 0)],
        ["Total Uncounted Items", String(d.totalNotCounted || 0)],
        ["Net Variance Units", String(d.totalVarianceQty || 0)],
        ["Total Variance Valuation (Ksh)", `Ksh ${d.totalVarianceVal || "0.00"}`],
        ["Positive Surplus (Ksh)", `+Ksh ${d.positiveVarianceVal || "0.00"}`],
        ["Negative Shortage (Ksh)", `-Ksh ${d.negativeVarianceVal || "0.00"}`],
      ];
    } else if (reportType === "DETAILED" && Array.isArray(reportData.rows)) {
      columns = ["Date & Time", "Location", "Item Name", "Item Code", "EAN", "System", "Physical", "Variance", "Cost (Ksh)", "Value (Ksh)", "Stock Taker"];
      rows = (reportData.rows as Record<string, unknown>[]).map((r) => {
        const dateStr = r.date ? new Date(String(r.date)).toLocaleString() : "N/A";
        return [
          dateStr,
          String(r.locationCode || ""),
          String(r.itemName || ""),
          String(r.itemCode || ""),
          String(r.eanCode || ""),
          String(r.systemQuantity || 0),
          String(r.physicalQuantity || 0),
          String(r.varianceQuantity || 0),
          `Ksh ${r.costPrice || "0.00"}`,
          `Ksh ${r.varianceValue || "0.00"}`,
          String(r.stockTaker || ""),
        ];
      });
    } else if (reportType === "VARIANCE" && Array.isArray(reportData.rows)) {
      columns = ["Item Name", "Item Code", "EAN", "Total System Stock", "Total Counted (All Locations)", "Counting Records", "Total Variance Qty", "Unit Cost (Ksh)", "Total Variance Value (Ksh)"];
      rows = (reportData.rows as Record<string, unknown>[]).map((r) => [
        String(r.itemName || ""),
        String(r.itemCode || ""),
        String(r.eanCode || ""),
        String(r.totalSystemStock || 0),
        String(r.totalCountedUnits || 0),
        String(r.totalCountRecords || 0),
        String(r.totalVarianceQty || 0),
        `Ksh ${r.costPrice || "0.00"}`,
        `Ksh ${r.totalVarianceValue || "0.00"}`,
      ]);
    } else if (reportType === "LOCATIONS" && Array.isArray(reportData.rows)) {
      columns = ["Location Code", "Location Name", "Staff", "Expected", "Counted", "Remaining", "Progress", "Status"];
      rows = (reportData.rows as Record<string, unknown>[]).map((r) => [
        String(r.locationCode || ""),
        String(r.locationName || ""),
        String(r.assignedStockTaker || "Unassigned"),
        String(r.expectedItems || 0),
        String(r.countedItems || 0),
        String(r.remaining || 0),
        `${r.progress || 0}%`,
        String(r.status || ""),
      ]);
    } else if (reportType === "PERFORMANCE" && Array.isArray(reportData.rows)) {
      columns = ["Stock Taker", "Locations Assigned", "Completed", "Items Counted", "Recounts", "Accuracy %"];
      rows = (reportData.rows as Record<string, unknown>[]).map((r) => [
        String(r.stockTaker || ""),
        String(r.locationsAssigned || 0),
        String(r.locationsCompleted || 0),
        String(r.itemsCounted || 0),
        String(r.recountsAssigned || 0),
        `${r.accuracyPercentage || 0}%`,
      ]);
    } else {
      columns = ["Record ID", "Details"];
      rows = [["Summary Data", "Processed"]];
    }

    exportDetailedPDF({
      title: `${reportType} INVENTORY REPORT`,
      stockTakeNumber: stNumber,
      storeName,
      date: new Date().toLocaleDateString(),
      status: st.status || "FINALIZED",
      preparedBy: user?.fullName || "Audit Team",
      columns,
      rows,
      fileName: `${stNumber}-${reportType}-Report`,
    });
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Stock Taking & Variance Reports</h2>
          <p className="text-xs text-slate-500">
            Generate printable operational audits, sign-off summaries, and export to Excel (.xlsx) and PDF
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
          >
            <Printer className="h-4 w-4 text-slate-500" />
            <span>Print Report</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span>Export Excel</span>
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-rose-700 shadow-sm"
          >
            <FileText className="h-4 w-4" />
            <span>Download PDF</span>
          </button>
        </div>
      </div>

      {/* Report Type Selector & Stock Take Filters */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs lg:flex-row lg:items-center lg:justify-between">
        {/* Report Types */}
        <div className="flex flex-wrap gap-1.5 text-xs">
          {[
            { id: "SUMMARY", label: "Executive Summary" },
            { id: "DETAILED", label: "Detailed Count Log" },
            { id: "VARIANCE", label: "Variance Report" },
            { id: "LOCATIONS", label: "Location Progress" },
            { id: "PERFORMANCE", label: "Staff Performance" },
            { id: "RECOUNTS", label: "Recounts Audit" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setReportType(t.id as typeof reportType)}
              className={`rounded-xl px-3 py-1.5 font-semibold transition-colors ${
                reportType === t.id ? "bg-slate-900 text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Session Filter */}
        <div className="flex items-center gap-2 text-xs">
          <label className="font-semibold text-slate-600">Stock Take:</label>
          <select
            value={selectedSTId}
            onChange={(e) => setSelectedSTId(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 focus:border-rose-500"
          >
            {stockTakes.map((st) => (
              <option key={st.id} value={st.id}>
                {st.stockTakeNumber} — {st.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* REPORT CONTENT VIEW (Formatted for screen and printing) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs print:border-none print:shadow-none">
        {/* Printable Report Header */}
        <div className="border-b border-slate-200 pb-4 mb-4 flex justify-between items-start">
          <div>
            <p className="text-xs font-bold text-rose-600 tracking-wider uppercase">
              {(reportData?.stockTake as { name?: string })?.name || "STOCK TAKE REPORT"}
            </p>
            <h3 className="text-lg font-bold text-slate-900">
              {reportType.replace("_", " ")} REPORT
            </h3>
            <p className="text-xs text-slate-500">
              Reference: {(reportData?.stockTake as { stockTakeNumber?: string })?.stockTakeNumber || "ST-2026-00001"} | Generated on {new Date().toLocaleString()}
            </p>
          </div>
          <div className="text-right text-xs">
            <span className="rounded-full bg-slate-100 px-3 py-1 font-bold text-slate-700">
              Status: {(reportData?.stockTake as { status?: string })?.status || "ACTIVE"}
            </span>
          </div>
        </div>

        {/* 1. EXECUTIVE SUMMARY VIEW */}
        {reportType === "SUMMARY" && Boolean(reportData?.data) && (
          <div className="space-y-6">
            {/* KPI Cards */}
            {(() => {
              const d = (reportData?.data || {}) as Record<string, unknown>;
              return (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-center">
                    <span className="text-xs text-slate-500">Expected Items</span>
                    <p className="mt-1 text-2xl font-bold text-slate-900">{String(d.totalExpected || 0)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-center">
                    <span className="text-xs text-slate-500">Counted Items</span>
                    <p className="mt-1 text-2xl font-bold text-emerald-600">{String(d.totalCounted || 0)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-center">
                    <span className="text-xs text-slate-500">Uncounted Items</span>
                    <p className="mt-1 text-2xl font-bold text-amber-600">{String(d.totalNotCounted || 0)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-center">
                    <span className="text-xs text-slate-500">Net Variance Value</span>
                    <p className="mt-1 text-2xl font-bold text-rose-600">Ksh {String(d.totalVarianceVal || "0.00")}</p>
                  </div>
                </div>
              );
            })()}

            {/* Financial Summary Table */}
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">Inventory Valuation Category</th>
                    <th className="px-4 py-3 text-right">Figure</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(() => {
                    const d = (reportData?.data || {}) as Record<string, unknown>;
                    return (
                      <>
                        <tr>
                          <td className="px-4 py-2.5 font-medium">Total Book/System Units in Counted Lines</td>
                          <td className="px-4 py-2.5 text-right font-bold">{String(d.totalSystem || 0)} units</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2.5 font-medium">Total Physical Counted Units</td>
                          <td className="px-4 py-2.5 text-right font-bold text-slate-900">{String(d.totalPhysical || 0)} units</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2.5 font-medium">Net Unit Discrepancy (Physical - System)</td>
                          <td className="px-4 py-2.5 text-right font-bold text-rose-600">{String(d.totalVarianceQty || 0)} units</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2.5 font-medium">Positive Surplus Value (Physical &gt; System)</td>
                          <td className="px-4 py-2.5 text-right font-bold text-emerald-600">+Ksh {String(d.positiveVarianceVal || "0.00")}</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2.5 font-medium">Negative Shortage Value (Physical &lt; System)</td>
                          <td className="px-4 py-2.5 text-right font-bold text-rose-600">-Ksh {String(d.negativeVarianceVal || "0.00")}</td>
                        </tr>
                      </>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 2. DETAILED COUNTS TABLE */}
        {reportType === "DETAILED" && Array.isArray(reportData?.rows) && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                <tr>
                  <th className="px-3 py-2.5">Date & Time</th>
                  <th className="px-3 py-2.5">Location</th>
                  <th className="px-3 py-2.5">Product Name</th>
                  <th className="px-3 py-2.5">Item Code</th>
                  <th className="px-3 py-2.5">EAN</th>
                  <th className="px-3 py-2.5">System</th>
                  <th className="px-3 py-2.5">Physical</th>
                  <th className="px-3 py-2.5">Variance</th>
                  <th className="px-3 py-2.5">Cost</th>
                  <th className="px-3 py-2.5">Value (Ksh)</th>
                  <th className="px-3 py-2.5">Stock Taker</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(reportData.rows as Record<string, unknown>[]).map((r, idx) => {
                  const dateStr = r.date ? new Date(String(r.date)).toLocaleString() : "N/A";
                  return (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-500 font-mono text-[11px]">{dateStr}</td>
                      <td className="px-3 py-2 font-mono font-semibold">{String(r.locationCode || "")}</td>
                      <td className="px-3 py-2 font-semibold text-slate-900">{String(r.itemName || "")}</td>
                      <td className="px-3 py-2 font-mono">{String(r.itemCode || "")}</td>
                      <td className="px-3 py-2 font-mono text-slate-400">{String(r.eanCode || "")}</td>
                      <td className="px-3 py-2">{String(r.systemQuantity || 0)}</td>
                      <td className="px-3 py-2 font-bold text-slate-900">{String(r.physicalQuantity || 0)}</td>
                      <td className="px-3 py-2 font-bold">
                        <span className={Number(r.varianceQuantity) > 0 ? "text-emerald-600" : Number(r.varianceQuantity) < 0 ? "text-rose-600" : "text-slate-500"}>
                          {Number(r.varianceQuantity) > 0 ? `+${r.varianceQuantity}` : String(r.varianceQuantity || 0)}
                        </span>
                      </td>
                      <td className="px-3 py-2">Ksh {String(r.costPrice || "0.00")}</td>
                      <td className="px-3 py-2 font-bold">Ksh {String(r.varianceValue || "0.00")}</td>
                      <td className="px-3 py-2 text-slate-700">{String(r.stockTaker || "")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 3. VARIANCE REPORT TABLE */}
        {reportType === "VARIANCE" && Array.isArray(reportData?.rows) && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                <tr>
                  <th className="px-3 py-2.5">Product Name</th>
                  <th className="px-3 py-2.5">Item Code</th>
                  <th className="px-3 py-2.5">EAN</th>
                  <th className="px-3 py-2.5">Total System Stock</th>
                  <th className="px-3 py-2.5">Total Counted (All Locations)</th>
                  <th className="px-3 py-2.5">Counting Records</th>
                  <th className="px-3 py-2.5">Total Variance Qty</th>
                  <th className="px-3 py-2.5">Unit Cost</th>
                  <th className="px-3 py-2.5">Total Variance Value (Ksh)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(reportData.rows as Record<string, unknown>[]).map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-bold text-slate-900">{String(r.itemName || "")}</td>
                    <td className="px-3 py-2 font-mono">{String(r.itemCode || "")}</td>
                    <td className="px-3 py-2 font-mono text-slate-400">{String(r.eanCode || "")}</td>
                    <td className="px-3 py-2 font-semibold text-center bg-slate-50 rounded">{String(r.totalSystemStock || 0)}</td>
                    <td className="px-3 py-2 font-semibold text-center text-emerald-700 bg-emerald-50 rounded">{String(r.totalCountedUnits || 0)}</td>
                    <td className="px-3 py-2 font-semibold text-center bg-blue-50 rounded text-blue-700">{String(r.totalCountRecords || 0)}</td>
                    <td className="px-3 py-2 font-bold text-center">
                      <span className={Number(r.totalVarianceQty) > 0 ? "text-emerald-600" : "text-rose-600"}>
                        {Number(r.totalVarianceQty) > 0 ? `+${r.totalVarianceQty}` : String(r.totalVarianceQty || 0)}
                      </span>
                    </td>
                    <td className="px-3 py-2">Ksh {String(r.costPrice || "0.00")}</td>
                    <td className="px-3 py-2 font-bold text-rose-600">Ksh {String(r.totalVarianceValue || "0.00")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 4. LOCATION REPORT TABLE */}
        {reportType === "LOCATIONS" && Array.isArray(reportData?.rows) && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                <tr>
                  <th className="px-3 py-2.5">Location Code</th>
                  <th className="px-3 py-2.5">Location Description</th>
                  <th className="px-3 py-2.5">Assigned Staff</th>
                  <th className="px-3 py-2.5">Expected Items</th>
                  <th className="px-3 py-2.5">Counted Items</th>
                  <th className="px-3 py-2.5">Remaining</th>
                  <th className="px-3 py-2.5">Progress</th>
                  <th className="px-3 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(reportData.rows as Record<string, unknown>[]).map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono font-bold text-slate-900">{String(r.locationCode || "")}</td>
                    <td className="px-3 py-2 font-medium">{String(r.locationName || "")}</td>
                    <td className="px-3 py-2 font-semibold text-slate-800">{String(r.assignedStockTaker || "Unassigned")}</td>
                    <td className="px-3 py-2">{String(r.expectedItems || 0)}</td>
                    <td className="px-3 py-2 font-bold text-emerald-600">{String(r.countedItems || 0)}</td>
                    <td className="px-3 py-2 text-amber-600 font-semibold">{String(r.remaining || 0)}</td>
                    <td className="px-3 py-2 font-bold text-rose-600">{String(r.progress || 0)}%</td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold">
                        {String(r.status || "")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 5. STAFF PERFORMANCE TABLE */}
        {reportType === "PERFORMANCE" && Array.isArray(reportData?.rows) && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                <tr>
                  <th className="px-3 py-2.5">Stock Taker</th>
                  <th className="px-3 py-2.5">Locations Assigned</th>
                  <th className="px-3 py-2.5">Locations Completed</th>
                  <th className="px-3 py-2.5">Items Scanned</th>
                  <th className="px-3 py-2.5">Recounts Assigned</th>
                  <th className="px-3 py-2.5">Counting Accuracy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(reportData.rows as Record<string, unknown>[]).map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-bold text-slate-900">{String(r.stockTaker || "")}</td>
                    <td className="px-3 py-2.5">{String(r.locationsAssigned || 0)}</td>
                    <td className="px-3 py-2.5 font-semibold text-emerald-600">{String(r.locationsCompleted || 0)}</td>
                    <td className="px-3 py-2.5 font-bold text-slate-900">{String(r.itemsCounted || 0)}</td>
                    <td className="px-3 py-2.5">{String(r.recountsAssigned || 0)}</td>
                    <td className="px-3 py-2.5 font-bold text-emerald-700">{String(r.accuracyPercentage || 0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 6. RECOUNTS AUDIT TABLE */}
        {reportType === "RECOUNTS" && Array.isArray(reportData?.rows) && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                <tr>
                  <th className="px-3 py-2.5">Product Name</th>
                  <th className="px-3 py-2.5">Location</th>
                  <th className="px-3 py-2.5">System Qty</th>
                  <th className="px-3 py-2.5">1st Count</th>
                  <th className="px-3 py-2.5">2nd Count</th>
                  <th className="px-3 py-2.5">Delta</th>
                  <th className="px-3 py-2.5">Final Qty</th>
                  <th className="px-3 py-2.5">Reason</th>
                  <th className="px-3 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(reportData.rows as Record<string, unknown>[]).map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-bold text-slate-900">{String(r.itemName || "")}</td>
                    <td className="px-3 py-2 font-mono">{String(r.locationCode || "")}</td>
                    <td className="px-3 py-2">{String(r.systemStock || 0)}</td>
                    <td className="px-3 py-2 font-semibold text-rose-600">{String(r.firstCount || 0)}</td>
                    <td className="px-3 py-2 font-semibold text-slate-900">{r.secondCount !== null ? String(r.secondCount) : "Pending"}</td>
                    <td className="px-3 py-2 font-bold">{r.difference !== null ? String(r.difference) : "-"}</td>
                    <td className="px-3 py-2 font-bold text-emerald-600">{r.finalQuantity !== null ? String(r.finalQuantity) : "-"}</td>
                    <td className="px-3 py-2">{String(r.reason || "")}</td>
                    <td className="px-3 py-2 font-semibold">{String(r.status || "")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* SIGN-OFF SECTION (Requirement 66) */}
        <div className="mt-12 border-t border-slate-300 pt-8 print:block">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-6">
            Physical Stock Audit Verification & Sign-Off
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-xs text-slate-700">
            <div className="space-y-4 rounded-xl border border-slate-200 p-4 bg-slate-50/50">
              <p className="font-bold text-slate-900 uppercase text-[11px]">1. COUNTED BY (STOCK TAKER)</p>
              <div className="space-y-2">
                <p>Name: _______________________________</p>
                <p>Signature: __________________________</p>
                <p>Date: _______________________________</p>
              </div>
            </div>

            <div className="space-y-4 rounded-xl border border-slate-200 p-4 bg-slate-50/50">
              <p className="font-bold text-slate-900 uppercase text-[11px]">2. VERIFIED BY (SUPERVISOR)</p>
              <div className="space-y-2">
                <p>Name: _______________________________</p>
                <p>Signature: __________________________</p>
                <p>Date: _______________________________</p>
              </div>
            </div>

            <div className="space-y-4 rounded-xl border border-slate-200 p-4 bg-slate-50/50">
              <p className="font-bold text-slate-900 uppercase text-[11px]">3. APPROVED BY (STORE MANAGER / AUDIT)</p>
              <div className="space-y-2">
                <p>Name: _______________________________</p>
                <p>Signature: __________________________</p>
                <p>Date: _______________________________</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
