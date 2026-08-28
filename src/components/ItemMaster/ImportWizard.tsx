"use client";

import React, { useState } from "react";
import * as XLSX from "xlsx";
import {
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  X,
  Download,
  RotateCcw,
  Check,
} from "lucide-react";
import { exportToExcel } from "@/lib/exportUtils";

interface ValidatedRow {
  rowIndex: number;
  itemName?: string;
  itemCode?: string;
  eanCode?: string;
  brand?: string;
  costPrice?: string | number;
  sellingPrice?: string | number;
  openingStock?: string | number;
  errors?: string[];
  status?: "VALID" | "INVALID" | "DUPLICATE";
}

interface ImportSummary {
  total: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
}

interface ImportWizardProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function ImportWizard({ onClose, onSuccess }: ImportWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [fileName, setFileName] = useState("");
  const [parsedRawRows, setParsedRawRows] = useState<Record<string, unknown>[]>([]);

  // Validation State
  const [validating, setValidating] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [validRows, setValidRows] = useState<ValidatedRow[]>([]);
  const [invalidRows, setInvalidRows] = useState<ValidatedRow[]>([]);
  const [duplicateRows, setDuplicateRows] = useState<ValidatedRow[]>([]);

  // Confirm options
  const [updateExisting, setUpdateExisting] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    updated: number;
    rejected: number;
  } | null>(null);

  // Step 1: File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

        setParsedRawRows(rows);
        setStep(2); // Proceed to Step 2 Validate
        triggerValidation(rows, file.name);
      } catch (err) {
        alert("Failed to parse file. Please upload a valid .xlsx or .csv file.");
      }
    };

    reader.readAsBinaryString(file);
  };

  // Step 2: Trigger Validation via Backend API
  const triggerValidation = async (rows: Record<string, unknown>[], fName: string) => {
    setValidating(true);
    try {
      const res = await fetch("/api/items/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "validate",
          rows,
          fileName: fName,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setSummary(json.summary);
        setValidRows(json.validRows || []);
        setInvalidRows(json.invalidRows || []);
        setDuplicateRows(json.duplicateRows || []);
        setStep(3); // Go to Preview
      } else {
        alert(json.error || "Validation failed.");
        setStep(1);
      }
    } catch (err) {
      alert("Network error during validation.");
      setStep(1);
    } finally {
      setValidating(false);
    }
  };

  // Step 5: Commit Transaction
  const handleCommitImport = async () => {
    setImporting(true);
    try {
      const res = await fetch("/api/items/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "commit",
          rows: parsedRawRows,
          fileName,
          updateExisting,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setImportResult(json.summary);
        setStep(5);
        onSuccess();
      } else {
        alert(json.error || "Import transaction failed.");
      }
    } catch (err) {
      alert("Network error committing import.");
    } finally {
      setImporting(false);
    }
  };

  // Download Rejected / Invalid rows as CSV
  const handleDownloadRejected = () => {
    if (invalidRows.length === 0) return;
    const exportData = invalidRows.map((r) => ({
      "Row": r.rowIndex,
      "Item Name": r.itemName,
      "Item Code": r.itemCode,
      "EAN Code": r.eanCode,
      "Errors": r.errors?.join("; "),
    }));
    exportToExcel(exportData, `${fileName}-Rejected-Rows`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="flex h-[85vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden animate-in zoom-in-95">
        {/* Wizard Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Item Master Multi-Step Import Wizard</h3>
            <p className="text-xs text-slate-500">
              Bulk upload products from Excel (.xlsx) or CSV (.csv) with strict database validation
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Wizard Steps Indicator */}
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-3">
          <div className="flex items-center justify-between text-xs">
            {[
              { num: 1, label: "Upload File" },
              { num: 2, label: "Validate Data" },
              { num: 3, label: "Preview & Review" },
              { num: 4, label: "Confirm Options" },
              { num: 5, label: "Complete" },
            ].map((s) => (
              <div key={s.num} className="flex items-center gap-2">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
                    step === s.num
                      ? "bg-rose-600 text-white"
                      : step > s.num
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {step > s.num ? <Check className="h-3.5 w-3.5" /> : s.num}
                </span>
                <span
                  className={`hidden sm:inline font-semibold ${
                    step === s.num ? "text-rose-600" : "text-slate-600"
                  }`}
                >
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Wizard Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* STEP 1: UPLOAD */}
          {step === 1 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                <UploadCloud className="h-8 w-8" />
              </div>
              <h4 className="mt-4 text-base font-bold text-slate-900">Upload Item Master Spreadsheet</h4>
              <p className="mt-1 text-xs text-slate-500 max-w-md">
                Supported formats: Microsoft Excel (.xlsx, .xls) and Comma-Separated Values (.csv).
                Records will not be inserted immediately until validation passes.
              </p>

              <label className="mt-6 flex cursor-pointer items-center gap-2 rounded-xl bg-rose-600 px-5 py-3 text-xs font-bold text-white shadow-md hover:bg-rose-700 active:scale-95 transition-all">
                <FileSpreadsheet className="h-4 w-4" />
                <span>Select Excel or CSV File</span>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {/* STEP 2: VALIDATING SPINNER */}
          {step === 2 && validating && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <RotateCcw className="h-10 w-10 animate-spin text-rose-600" />
              <h4 className="mt-4 text-base font-bold text-slate-900">Validating Data Integrity...</h4>
              <p className="mt-1 text-xs text-slate-500">
                Checking for missing names, duplicate item codes, barcode formats, and valid numerical prices...
              </p>
            </div>
          )}

          {/* STEP 3: PREVIEW & REVIEW REPORT */}
          {step === 3 && summary && (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-3 text-center text-xs">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <span className="text-slate-500">Total Rows</span>
                  <p className="mt-1 text-xl font-bold text-slate-900">{summary.total}</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
                  <span className="text-emerald-600">Valid Rows</span>
                  <p className="mt-1 text-xl font-bold">{summary.validCount}</p>
                </div>
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-rose-800">
                  <span className="text-rose-600">Invalid Rows</span>
                  <p className="mt-1 text-xl font-bold">{summary.invalidCount}</p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800">
                  <span className="text-amber-600">Duplicates</span>
                  <p className="mt-1 text-xl font-bold">{summary.duplicateCount}</p>
                </div>
              </div>

              {/* Invalid Rows Warning Table */}
              {invalidRows.length > 0 && (
                <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4">
                  <div className="flex items-center justify-between pb-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-rose-800">
                      <AlertTriangle className="h-4 w-4" />
                      <span>{invalidRows.length} Invalid Rows Detected (Will be rejected)</span>
                    </div>
                    <button
                      onClick={handleDownloadRejected}
                      className="flex items-center gap-1 text-[11px] font-semibold text-rose-700 hover:underline"
                    >
                      <Download className="h-3 w-3" />
                      <span>Download Rejected List (.xlsx)</span>
                    </button>
                  </div>

                  <div className="max-h-40 overflow-y-auto space-y-1 text-xs">
                    {invalidRows.slice(0, 10).map((r, idx) => (
                      <div key={idx} className="flex justify-between border-b border-rose-100 py-1 text-rose-900">
                        <span>
                          Row #{r.rowIndex}: {r.itemName || "(Empty Name)"} [{r.itemCode || "No Code"}]
                        </span>
                        <span className="font-semibold text-rose-700">{r.errors?.join(", ")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Valid Sample Rows Preview */}
              <div>
                <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Valid Rows Preview ({validRows.length} ready)
                </h5>
                <div className="mt-2 max-h-52 overflow-y-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                      <tr>
                        <th className="px-3 py-2">Row</th>
                        <th className="px-3 py-2">Item Name</th>
                        <th className="px-3 py-2">Item Code</th>
                        <th className="px-3 py-2">EAN Code</th>
                        <th className="px-3 py-2">Cost (Ksh)</th>
                        <th className="px-3 py-2">Selling (Ksh)</th>
                        <th className="px-3 py-2">Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {validRows.slice(0, 15).map((r, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 font-mono text-slate-400">#{r.rowIndex}</td>
                          <td className="px-3 py-2 font-semibold text-slate-900">{r.itemName}</td>
                          <td className="px-3 py-2 font-mono">{r.itemCode}</td>
                          <td className="px-3 py-2 font-mono">{r.eanCode}</td>
                          <td className="px-3 py-2">Ksh {r.costPrice}</td>
                          <td className="px-3 py-2">Ksh {r.sellingPrice}</td>
                          <td className="px-3 py-2">{r.openingStock}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: CONFIRM OPTIONS */}
          {step === 4 && (
            <div className="space-y-4 max-w-lg mx-auto py-6">
              <h4 className="text-base font-bold text-slate-900 text-center">Confirm Import Settings</h4>
              <p className="text-xs text-slate-500 text-center">
                Configure database transaction behavior for existing items
              </p>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3 text-xs">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={updateExisting}
                    onChange={(e) => setUpdateExisting(e.target.checked)}
                    className="mt-0.5 rounded text-rose-600"
                  />
                  <div>
                    <span className="font-semibold text-slate-900">
                      Update existing products if Item Code exists in Item Master
                    </span>
                    <p className="text-slate-500 text-[11px]">
                      If unchecked, existing item codes will be skipped to prevent overwriting.
                    </p>
                  </div>
                </label>
              </div>

              <div className="rounded-xl bg-amber-50 p-3.5 text-xs text-amber-900 border border-amber-200">
                <p className="font-bold">Transaction Safety:</p>
                <p className="mt-0.5 text-[11px] text-amber-800">
                  Data is imported within a PostgreSQL transaction. If any database constraint fails,
                  all changes are rolled back.
                </p>
              </div>
            </div>
          )}

          {/* STEP 5: COMPLETED */}
          {step === 5 && importResult && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h4 className="mt-4 text-lg font-bold text-slate-900">Import Process Completed!</h4>
              <p className="mt-1 text-xs text-slate-500">
                Item Master catalog has been successfully updated in PostgreSQL.
              </p>

              <div className="mt-6 grid grid-cols-3 gap-4 text-xs w-full max-w-md">
                <div className="rounded-xl bg-slate-50 p-3 text-center border border-slate-200">
                  <span className="text-slate-500">New Items</span>
                  <p className="text-xl font-bold text-emerald-600">+{importResult.imported}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 text-center border border-slate-200">
                  <span className="text-slate-500">Updated</span>
                  <p className="text-xl font-bold text-blue-600">{importResult.updated}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 text-center border border-slate-200">
                  <span className="text-slate-500">Rejected</span>
                  <p className="text-xl font-bold text-rose-600">{importResult.rejected}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Navigation */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-4 text-xs">
          {step > 1 && step < 5 ? (
            <button
              onClick={() => setStep((s) => (s - 1) as typeof step)}
              className="flex items-center gap-1 rounded-xl border border-slate-300 px-3.5 py-2 font-semibold text-slate-700 hover:bg-slate-100"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </button>
          ) : (
            <div></div>
          )}

          <div className="flex gap-2">
            {step === 3 && (
              <button
                onClick={() => setStep(4)}
                className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 font-bold text-white hover:bg-rose-700"
              >
                <span>Proceed to Confirmation</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            )}

            {step === 4 && (
              <button
                onClick={handleCommitImport}
                disabled={importing}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {importing ? "Importing to PostgreSQL..." : "Confirm & Import Records"}
              </button>
            )}

            {step === 5 && (
              <button
                onClick={onClose}
                className="rounded-xl bg-slate-900 px-5 py-2.5 font-bold text-white hover:bg-slate-800"
              >
                Close Wizard
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
