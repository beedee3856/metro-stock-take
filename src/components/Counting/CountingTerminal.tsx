"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  ScanLine,
  Search,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Camera,
  Plus,
  Minus,
  Save,
  CheckSquare,
  Wifi,
  WifiOff,
  Package,
  Layers,
  ArrowRight,
  EyeOff,
  Edit,
  History,
  X,
  Sparkles,
} from "lucide-react";

interface TaskLocation {
  id: string;
  stockTakeId: string;
  locationId: string;
  locationCode: string;
  locationName: string;
  departmentName?: string;
  stockTakeNumber: string;
  stockTakeName: string;
  isBlindCount: boolean;
  expectedItemsCount: number;
  countedItemsCount: number;
  progress: number;
  status: string;
}

interface FoundItem {
  id: string;
  itemName: string;
  itemCode: string;
  eanCode: string;
  sku?: string;
  brand?: string;
  uom: string;
  packSize: string;
  costPrice: string;
  currentSystemStock: number;
}

interface CountRecord {
  id: string;
  itemId: string;
  itemName?: string;
  itemCode?: string;
  eanCode?: string;
  physicalQuantity: number;
  systemQuantity?: number | null;
  varianceQuantity?: number | null;
  countedBy?: string;
  createdAt: string;
}

interface BarcodeDetectorResult {
  rawValue: string;
}

interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<BarcodeDetectorResult[]>;
}

interface BarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
}

interface CountingTerminalProps {
  /** Task (stock_take_locations id) chosen on the Dashboard / My Tasks board */
  initialTaskId?: string | null;
  /** Called when the taker closes a submitted count and returns to My Tasks */
  onCloseCount?: () => void;
}

export function CountingTerminal({ initialTaskId = null, onCloseCount }: CountingTerminalProps) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskLocation[]>([]);
  const [selectedTask, setSelectedTask] = useState<TaskLocation | null>(null);
  const [loadingTasks, setLoadingTasks] = useState(true);

  // Search & Barcode state
  const [barcodeInput, setBarcodeInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FoundItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeItem, setActiveItem] = useState<FoundItem | null>(null);

  // Quantity input
  const [quantity, setQuantity] = useState<number | string>(1);
  const [countNotes, setCountNotes] = useState("");
  const [savingCount, setSavingCount] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" | "warning" } | null>(null);

  // Recount context (from MyTasks selection)
  const [recountContext, setRecountContext] = useState<any | null>(null);

  // Duplicate modal state
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<{
    existingCountId: string;
    existingQty: number;
    createdAt: string;
  } | null>(null);

  // Location completion modal
  const [completionModalOpen, setCompletionModalOpen] = useState(false);
  const [locationSummary, setLocationSummary] = useState<{
    expected: number;
    counted: number;
    uncounted: number;
  } | null>(null);
  const [submittingLocation, setSubmittingLocation] = useState(false);
    // True once the taker has submitted (closed) this location — blocks further edits
  const [locationSubmitted, setLocationSubmitted] = useState(false);

  // Recent counts in this session
  const [recentCounts, setRecentCounts] = useState<CountRecord[]>([]);

  // Camera scanner
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Hardware barcode scanner auto-focus
  const scanInputRef = useRef<HTMLInputElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const barcodeLookupRef = useRef<(code: string) => Promise<void>>(() => Promise.resolve());
  const activeLookupAbortRef = useRef<AbortController | null>(null);

  // Fetch tasks assigned to this user
  const fetchTasks = useCallback(async () => {
    try {
      setLoadingTasks(true);
      const res = await fetch("/api/my-tasks", { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        const tList = json.tasks || [];
        setTasks(tList);
        setSelectedTask((current) => {
          if (tList.length === 0) return null;
          if (current) {
            // Refresh the open task so its status/progress stay live after submit
            const refreshed = tList.find((task: TaskLocation) => task.id === current.id);
            if (refreshed) return refreshed;
          }
          return tList[0] as TaskLocation;
        });
      }
    } catch (err) {
      console.error("Failed to fetch tasks", err);
    } finally {
      setLoadingTasks(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Deep link: open the exact assignment the taker clicked on Dashboard / My Tasks
  useEffect(() => {
    if (!initialTaskId) return;
    const found = tasks.find((t) => t.id === initialTaskId);
    if (found) {
      setSelectedTask(found);
      setLocationSubmitted(["SUBMITTED", "APPROVED", "COMPLETED"].includes(found.status));
    }
  }, [initialTaskId, tasks]);

  // Load recount context from sessionStorage if available
  useEffect(() => {
    const recount = sessionStorage.getItem("selectedRecount");
    if (recount) {
      try {
        const recountData = JSON.parse(recount);
        setRecountContext(recountData);
        // Auto-select the task for this recount's location
        if (tasks.length > 0) {
          const matchingTask = tasks.find(
            (t) => t.id === recountData.stockTakeLocationId
          );
          if (matchingTask) {
            setSelectedTask(matchingTask);
          }
        }
      } catch (err) {
        console.error("Failed to load recount context", err);
      }
    }
  }, [tasks]);

  // Fetch counts when selectedTask changes
  const fetchLocationCounts = useCallback(async () => {
    if (!selectedTask) return;
    try {
      const res = await fetch(
        `/api/stock-counts?stockTakeLocationId=${selectedTask.id}&stockTakeId=${selectedTask.stockTakeId}`
      );
      if (res.ok) {
        const json = await res.json();
        setRecentCounts(json.counts || []);
      }
    } catch (err) {
      console.error("Failed to load counts", err);
    }
  }, [selectedTask]);

  useEffect(() => {
    if (selectedTask) {
      fetchLocationCounts();
      setLocationSubmitted(
        ["SUBMITTED", "APPROVED", "COMPLETED"].includes(selectedTask.status)
      );
      // Auto-focus barcode input

      setTimeout(() => scanInputRef.current?.focus(), 150);
    }
  }, [selectedTask, fetchLocationCounts]);

  const stopCamera = useCallback(() => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    if (!cameraActive) return;

    let cancelled = false;
    let detectionTimer: ReturnType<typeof setInterval> | undefined;

    const startCamera = async () => {
      setCameraError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("Camera access requires a secure HTTPS connection and a supported browser.");
        return;
      }

      const detectorConstructor = (window as Window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        cameraStreamRef.current = stream;
        if (!cameraVideoRef.current) return;
        cameraVideoRef.current.srcObject = stream;
        await cameraVideoRef.current.play();

        if (detectorConstructor) {
          const supportedFormats = detectorConstructor.getSupportedFormats
            ? await detectorConstructor.getSupportedFormats()
            : [];
          const formats = supportedFormats.length > 0
            ? supportedFormats.filter((format) => format.includes("ean") || format.includes("upc") || format === "code_128")
            : ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"];
          const detector = new detectorConstructor({ formats });

          detectionTimer = setInterval(async () => {
            if (!cameraVideoRef.current || cameraVideoRef.current.readyState < 2) return;
            try {
              const detected = await detector.detect(cameraVideoRef.current);
              const barcode = detected.find((result) => result.rawValue.trim())?.rawValue.trim();
              if (barcode) {
                stopCamera();
                await barcodeLookupRef.current(barcode);
              }
            } catch {
              // Detection can fail while the camera is refocusing; the next frame retries.
            }
          }, 300);
        } else {
          setCameraError("Live camera is on, but this browser cannot read barcodes automatically. Use the barcode field below.");
        }
      } catch (error) {
        setCameraError(error instanceof DOMException && error.name === "NotAllowedError"
          ? "Camera permission was denied. Allow camera access or use the barcode field."
          : "Unable to start the camera. Use the barcode field or a hardware scanner.");
      }
    };

    startCamera();
    return () => {
      cancelled = true;
      if (detectionTimer) clearInterval(detectionTimer);
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    };
  }, [cameraActive, stopCamera]);

  useEffect(() => () => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  // Debounced search
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        const res = await fetch(`/api/items?query=${encodeURIComponent(searchQuery)}&limit=8`, {
          cache: "no-store",
        });
        if (res.ok) {
          const json = await res.json();
          setSearchResults(json.items || []);
        }
      } catch (err) {
        console.error("Search error", err);
      } finally {
        setSearching(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Handle barcode submission
  const handleBarcodeLookup = async (codeToLookup?: string) => {
    const code = (codeToLookup || barcodeInput).trim();
    if (!code || !selectedTask) return;

    setMessage(null);

    activeLookupAbortRef.current?.abort();
    const controller = new AbortController();
    activeLookupAbortRef.current = controller;

    try {
      const res = await fetch(
        `/api/items/lookup?barcode=${encodeURIComponent(code)}&stockTakeLocationId=${selectedTask.id}`,
        {
          cache: "no-store",
          signal: controller.signal,
        }
      );
      const json = await res.json();

      if (controller.signal.aborted) {
        return;
      }

      if (!res.ok || !json.found) {
        setMessage({
          text: "Barcode not found in Items & Barcodes. Upload or add this product before scanning it.",
          type: "error",
        });
        setActiveItem(null);
        return;
      }

      const item = json.item as FoundItem;
      setActiveItem(item);
      setBarcodeInput("");

      // Check if already counted in this location
      if (json.alreadyCounted && json.existingCount) {
        setDuplicateInfo({
          existingCountId: json.existingCount.id,
          existingQty: json.existingCount.physicalQuantity,
          createdAt: json.existingCount.createdAt,
        });
        setDuplicateModalOpen(true);
      } else {
        // Default quantity to 1 for quick count
        setQuantity(1);
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setMessage({ text: "Network error looking up barcode", type: "error" });
    }
  };

  barcodeLookupRef.current = (code) => handleBarcodeLookup(code);

  // Submit physical count
  const handleSaveCount = async (duplicateAction: "ERROR_IF_EXISTS" | "EDIT_EXISTING" | "ADD_ADDITIONAL" = "ERROR_IF_EXISTS") => {
    if (!selectedTask || !activeItem) {
      setMessage({ text: "Select an assigned location and scan an item before saving.", type: "error" });
      return;
    }

    // A submitted (closed) location is read-only for the stock taker
    if (locationSubmitted || ["SUBMITTED", "APPROVED", "COMPLETED", "LOCKED"].includes(selectedTask.status)) {
      setMessage({
        text: "This location has already been submitted and closed. Counts can no longer be edited.",
        type: "error",
      });
      return;
    }
    const numQty = typeof quantity === "string" ? parseInt(quantity, 10) : quantity;
    if (isNaN(numQty) || numQty < 0) {
      setMessage({ text: "Please enter a valid non-negative physical count", type: "error" });
      return;
    }

    try {
      setSavingCount(true);
      const clientUuid = `count-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const res = await fetch("/api/stock-counts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stockTakeId: selectedTask.stockTakeId,
          stockTakeLocationId: selectedTask.id,
          itemId: activeItem.id,
          physicalQuantity: numQty,
          notes: countNotes,
          duplicateAction,
          clientUuid,
        }),
      });

      const json = await res.json();

      if (res.status === 409 && json.isDuplicate) {
        setDuplicateInfo({
          existingCountId: json.existingCount.id,
          existingQty: json.existingCount.physicalQuantity,
          createdAt: json.existingCount.createdAt,
        });
        setDuplicateModalOpen(true);
        return;
      }

      if (!res.ok) {
        setMessage({ text: json.error || "Failed to record count", type: "error" });
        return;
      }

      setMessage({
        text: `Count saved: ${activeItem.itemName} — ${numQty} ${activeItem.uom}`,
        type: "success",
      });

      const savedCount = json.count || {};
      setRecentCounts((current) => [
        {
          ...savedCount,
          itemId: activeItem.id,
          itemName: activeItem.itemName,
          itemCode: activeItem.itemCode,
          eanCode: activeItem.eanCode,
          physicalQuantity: numQty,
          countedBy: user?.fullName || "Current user",
          createdAt: savedCount.createdAt || new Date().toISOString(),
        },
        ...current.filter((count) => count.id !== savedCount.id),
      ]);

      // Clear input and focus back on scan input
      setActiveItem(null);
      setQuantity(1);
      setCountNotes("");
      setDuplicateModalOpen(false);

      // Refresh location progress and list
      fetchLocationCounts();
      fetchTasks();

      setTimeout(() => scanInputRef.current?.focus(), 100);
    } catch (err) {
      setMessage({ text: "Unable to save count. Check your connection and try again.", type: "error" });
    } finally {
      setSavingCount(false);
    }
  };

  // Open location summary & check completion
  const handleOpenCompletionModal = () => {
    if (!selectedTask) return;
    const expected = selectedTask.expectedItemsCount;
    const counted = recentCounts.length;
    const uncounted = Math.max(0, expected - counted);

    setLocationSummary({ expected, counted, uncounted });
    setCompletionModalOpen(true);
  };

  // Confirm submit location
  const handleConfirmSubmitLocation = async () => {
    if (!selectedTask) return;

    try {
      setSubmittingLocation(true);
      const res = await fetch(`/api/stock-take-locations/${selectedTask.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrideIncomplete: true }),
      });

      const json = await res.json();
      if (!res.ok) {
        setMessage({ text: json.error || "Failed to submit location", type: "error" });
        return;
      }

      setMessage({
        text: `Location ${selectedTask.locationCode} submitted successfully for supervisor review!`,
        type: "success",
      });

      setCompletionModalOpen(false);
      setLocationSubmitted(true);
      setActiveItem(null);
      fetchTasks();
    } catch (err) {
      setMessage({ text: "Network error submitting location", type: "error" });
    } finally {
      setSubmittingLocation(false);
    }
  };

  const isBlind = selectedTask?.isBlindCount && user?.role === "STOCK_TAKER";

  return (
    <div className="space-y-6">
      {/* Recount Context Banner */}
      {recountContext && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-xs">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 flex-shrink-0 mt-0.5">
                <RotateCcw className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-emerald-900 uppercase tracking-wider mb-1">Recount Mode Active</p>
                <div className="text-sm font-semibold text-slate-900">{recountContext.itemName}</div>
                <div className="text-xs text-slate-600 mt-1">
                  <span className="font-medium">Location:</span> {recountContext.locationCode} | 
                  <span className="font-medium ml-1">Original Count:</span> {recountContext.originalPhysicalQty} units |
                  <span className="font-medium ml-1">Reason:</span> {recountContext.reason}
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                setRecountContext(null);
                sessionStorage.removeItem("selectedRecount");
              }}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 px-3 py-1 rounded-lg hover:bg-emerald-100 transition-colors"
            >
              Cancel Recount
            </button>
          </div>
        </div>
      )}

      {/* Location Work Queue Selector Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <ScanLine className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Active Stock Take: {selectedTask?.stockTakeNumber || "ST-2026-00001"}
                </span>
                {isBlind && (
                  <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                    <EyeOff className="h-3 w-3 text-slate-500" />
                    Blind Count Mode
                  </span>
                )}
              </div>
              <h2 className="text-lg font-bold text-slate-900">
                {selectedTask?.locationName || "Select Assigned Location to Count"}
              </h2>
            </div>
          </div>

          {/* Location Switcher */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-500">Location:</label>
            <select
              value={selectedTask?.id || ""}
              onChange={(e) => {
                const found = tasks.find((t) => t.id === e.target.value);
                if (found) setSelectedTask(found);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 shadow-xs focus:border-rose-500 focus:outline-hidden"
            >
              {tasks.length === 0 ? (
                <option value="">No Assigned Tasks Found</option>
              ) : (
                tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.locationCode} ({t.countedItemsCount}/{t.expectedItemsCount} counted) — {t.status}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Selected Location Progress Bar */}
        {selectedTask && (
          <div className="mt-4 border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>
                Progress: <strong className="text-slate-900">{selectedTask.countedItemsCount}</strong> of{" "}
                <strong>{selectedTask.expectedItemsCount}</strong> expected items counted
              </span>
              <span className="font-bold text-rose-600">{selectedTask.progress}%</span>
            </div>
            <div className="mt-1.5 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-rose-600 transition-all duration-300"
                style={{ width: `${selectedTask.progress}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>
      {/* Count closed / submitted banner */}
      {locationSubmitted && selectedTask && (
        <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-xs sm:flex-row sm:items-center sm:justify-between animate-in fade-in zoom-in-95">
          <div className="flex items-start gap-3">
            <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div>
              <p className="text-sm font-bold text-emerald-900">
                Location {selectedTask.locationCode} submitted — your count is closed
              </p>
              <p className="text-xs text-emerald-700">
                Counts are locked and now awaiting supervisor review. It will appear on the
                administrator dashboard for approval or recount.
              </p>
            </div>
          </div>
          {onCloseCount && (
            <button
              type="button"
              onClick={onCloseCount}
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-95"
            >
              <CheckSquare className="h-4 w-4" />
              <span>Close Count & Return to My Tasks</span>
            </button>
          )}
        </div>
      )}
      {/* Main Counting Terminal Interface */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Barcode Scanner & Search & Entry (7 cols) */}
        <div className="space-y-4 lg:col-span-7">
          {/* Notification Alert Banner */}
          {message && (
            <div
              className={`flex items-center justify-between rounded-xl p-3.5 text-xs font-medium ${
                message.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : message.type === "error"
                  ? "bg-rose-50 text-rose-800 border border-rose-200"
                  : "bg-amber-50 text-amber-800 border border-amber-200"
              }`}
            >
              <div className="flex items-center gap-2">
                {message.type === "success" && <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />}
                {message.type === "error" && <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />}
                {message.type === "warning" && <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />}
                <span>{message.text}</span>
              </div>
              <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Dedicated Barcode Scanner Box */}
          <div className="rounded-2xl border-2 border-dashed border-rose-200 bg-rose-50/40 p-5 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-600 text-white shadow-md shadow-rose-900/20">
              <ScanLine className="h-6 w-6" />
            </div>
            <h3 className="mt-2 text-base font-bold text-slate-900">Scan Barcode / EAN-13</h3>
            <p className="text-xs text-slate-500">
              Use a physical Bluetooth/USB scanner, or enter barcode below
            </p>

            {/* Large Scanner Input Field */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleBarcodeLookup();
              }}
              className="mt-4 flex gap-2"
            >
              <input
                ref={scanInputRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                placeholder="Scan EAN barcode or type code..."
                className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-mono font-semibold tracking-wider text-slate-900 shadow-inner focus:border-rose-500 focus:outline-hidden focus:ring-2 focus:ring-rose-500/20"
              />
              <button
                type="submit"
                className="rounded-xl bg-rose-600 px-5 py-3 text-sm font-bold text-white shadow-md hover:bg-rose-700 active:scale-95 transition-all"
              >
                Scan
              </button>
              <button
                type="button"
                onClick={() => {
                  setCameraError(null);
                  setCameraActive(true);
                }}
                className="rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-slate-700 hover:bg-slate-50 active:scale-95 transition-all"
                title="Open camera barcode scanner"
                aria-label="Open camera barcode scanner"
              >
                <Camera className="h-5 w-5 text-rose-600" />
              </button>
            </form>

            {/* Live camera barcode scanner */}
            {cameraActive && (
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 p-4 text-white">
                <div className="flex items-center justify-between text-xs text-slate-300 mb-2">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Point camera at the product barcode
                  </span>
                  <button onClick={stopCamera} className="hover:text-white" aria-label="Close camera scanner">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="relative aspect-video border-2 border-rose-500 rounded-lg flex items-center justify-center bg-slate-950 overflow-hidden">
                  <video
                    ref={cameraVideoRef}
                    className="h-full w-full object-cover"
                    muted
                    playsInline
                    autoPlay
                  />
                  <div className="absolute inset-x-0 h-0.5 bg-rose-500 animate-pulse shadow-lg shadow-rose-500"></div>
                  {cameraError && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 p-4 text-center text-xs text-amber-200">
                      {cameraError}
                    </div>
                  )}
                </div>
                <p className="mt-2 text-left text-xs text-slate-400">
                  The barcode will be looked up automatically in Items & Barcodes after detection.
                </p>
              </div>
            )}

            {/* Fast Search Fallback */}
            <div className="mt-3 relative">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Or search by Item Name / Code / SKU..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-800 focus:border-rose-500 focus:outline-hidden"
                />
              </div>

              {/* Live Search Dropdown */}
              {searchResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl z-30 text-left">
                  {searchResults.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveItem(item);
                        setSearchQuery("");
                        setSearchResults([]);
                        setQuantity(1);
                      }}
                      className="flex w-full items-center justify-between rounded-lg p-2 text-xs hover:bg-slate-50 transition-colors"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">{item.itemName}</p>
                        <p className="text-[11px] text-slate-500">
                          Code: {item.itemCode} | EAN: {item.eanCode}
                        </p>
                      </div>
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                        {item.uom}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ACTIVE ITEM DETAILS & PHYSICAL QUANTITY ENTRY */}
          {activeItem ? (
            <div className="rounded-2xl border-2 border-rose-500 bg-white p-5 shadow-lg animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                    IDENTIFIED PRODUCT
                  </span>
                  <h3 className="mt-1 text-lg font-bold text-slate-900">{activeItem.itemName}</h3>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>
                      Item Code: <strong className="text-slate-800">{activeItem.itemCode}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      EAN: <strong className="text-slate-800">{activeItem.eanCode}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Unit: <strong className="text-slate-800">{activeItem.uom}</strong> (Pack:{" "}
                      {activeItem.packSize})
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setActiveItem(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* System Stock display if NOT blind count */}
              {!isBlind && (
                <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 p-3 text-xs">
                  <span className="text-slate-600">Current System Stock (Book Stock):</span>
                  <span className="text-sm font-bold text-slate-900">
                    {activeItem.currentSystemStock} {activeItem.uom}
                  </span>
                </div>
              )}

              {/* LARGE PHYSICAL QUANTITY INPUT PAD */}
              <div className="mt-4 space-y-3">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Enter Physical Counted Quantity:
                </label>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setQuantity((prev) => Math.max(0, Number(prev) - 1))}
                    className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 active:scale-95"
                  >
                    <Minus className="h-5 w-5" />
                  </button>

                  <input
                    type="number"
                    min="0"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="flex-1 h-14 rounded-xl border-2 border-slate-300 bg-white text-center text-3xl font-bold text-slate-900 focus:border-rose-500 focus:outline-hidden"
                  />

                  <button
                    type="button"
                    onClick={() => setQuantity((prev) => Number(prev) + 1)}
                    className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 active:scale-95"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>

                {/* Quick Increment Buttons */}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setQuantity((prev) => Number(prev) + 5)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
                  >
                    +5
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuantity((prev) => Number(prev) + 10)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
                  >
                    +10
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuantity((prev) => Number(prev) + 24)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
                  >
                    +24 (Case)
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuantity(0)}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
                  >
                    Set 0 (Out of Stock)
                  </button>
                </div>

                {/* Optional Notes */}
                <input
                  type="text"
                  value={countNotes}
                  onChange={(e) => setCountNotes(e.target.value)}
                  placeholder="Optional notes (e.g., damaged pack, top shelf overflow)..."
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-rose-500 focus:outline-hidden"
                />

                {/* Save Count Button */}
                <button
                  type="button"
                  onClick={() => handleSaveCount("ERROR_IF_EXISTS")}
                  disabled={savingCount}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-rose-900/30 hover:bg-rose-700 active:scale-98 transition-all disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  <span>{savingCount ? "Saving Count..." : "SAVE PHYSICAL COUNT"}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-400">
              <Package className="mx-auto h-12 w-12 text-slate-300" />
              <p className="mt-2 text-sm font-semibold text-slate-600">No Item Selected</p>
              <p className="text-xs text-slate-400">
                Scan product barcode or search by name to record physical counts.
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Location Work Queue & Recent Count Lines (5 cols) */}
        <div className="space-y-4 lg:col-span-5">
          {/* Complete Location Submission Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Location Status</h4>
                <p className="text-xs text-slate-500">
                  {selectedTask?.locationCode} — {selectedTask?.status}
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenCompletionModal}
                disabled={!selectedTask || recentCounts.length === 0 || locationSubmitted}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 active:scale-95 disabled:opacity-40"
              >
                <CheckSquare className="h-3.5 w-3.5" />
                <span>Submit Location</span>
              </button>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center text-xs">
              <div className="rounded-lg bg-slate-50 p-2">
                <span className="text-[10px] text-slate-500">Expected</span>
                <p className="font-bold text-slate-900">{selectedTask?.expectedItemsCount || 0}</p>
              </div>
              <div className="rounded-lg bg-emerald-50 p-2 text-emerald-800">
                <span className="text-[10px] text-emerald-600">Counted</span>
                <p className="font-bold">{recentCounts.length}</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-2 text-amber-800">
                <span className="text-[10px] text-amber-600">Remaining</span>
                <p className="font-bold">
                  {Math.max(0, (selectedTask?.expectedItemsCount || 0) - recentCounts.length)}
                </p>
              </div>
            </div>
          </div>

          {/* Counts Recorded in this Location */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900">Counted Items in Location</h4>
                <p className="text-xs text-slate-500">{recentCounts.length} lines recorded</p>
              </div>
              <span className="text-[11px] font-semibold text-rose-600">Live Log</span>
            </div>

            <div className="mt-3 max-h-96 space-y-2.5 overflow-y-auto pr-1">
              {recentCounts.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No counts recorded yet for this location.
                </div>
              ) : (
                recentCounts.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-800">{c.itemName || "Item"}</p>
                      <p className="text-[11px] text-slate-500">
                        Code: {c.itemCode} | Counted by: {c.countedBy || "Unknown user"} | {new Date(c.createdAt).toLocaleTimeString()}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="inline-block rounded-lg bg-rose-100 px-2.5 py-1 text-xs font-bold text-rose-800">
                        {c.physicalQuantity} counted
                      </span>
                      {!isBlind && c.systemQuantity !== undefined && c.systemQuantity !== null && (
                        <p className="mt-0.5 text-[10px] text-slate-500">
                          Sys: {c.systemQuantity} |{" "}
                          <span
                            className={
                              (c.varianceQuantity || 0) >= 0
                                ? "text-emerald-600 font-semibold"
                                : "text-rose-600 font-semibold"
                            }
                          >
                            Var: {(c.varianceQuantity || 0) > 0 ? `+${c.varianceQuantity}` : c.varianceQuantity}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* DUPLICATE COUNT MODAL (Requirement 16) */}
      {duplicateModalOpen && duplicateInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
              <AlertTriangle className="h-6 w-6" />
            </div>

            <h3 className="mt-3 text-lg font-bold text-slate-900">
              This item has already been counted in this location.
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Product: <strong>{activeItem?.itemName}</strong>
              <br />
              Previous count: <strong>{duplicateInfo.existingQty} units</strong> (recorded at{" "}
              {new Date(duplicateInfo.createdAt).toLocaleTimeString()})
            </p>

            <div className="mt-5 space-y-2">
              <button
                type="button"
                onClick={() => handleSaveCount("EDIT_EXISTING")}
                className="flex w-full items-center justify-between rounded-xl bg-slate-900 px-4 py-3 text-xs font-semibold text-white hover:bg-slate-800"
              >
                <span>Edit Existing Count</span>
                <span className="text-[10px] text-slate-300">
                  Overwrite with {quantity} units
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveCount("ADD_ADDITIONAL")}
                className="flex w-full items-center justify-between rounded-xl bg-rose-600 px-4 py-3 text-xs font-semibold text-white hover:bg-rose-700"
              >
                <span>Add Additional Count</span>
                <span className="text-[10px] text-rose-200">
                  New Total: {duplicateInfo.existingQty + Number(quantity)} units
                </span>
              </button>

              <button
                type="button"
                onClick={() => setDuplicateModalOpen(false)}
                className="w-full rounded-xl border border-slate-200 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LOCATION COMPLETION & SUBMISSION MODAL (Requirement 19) */}
      {completionModalOpen && locationSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
              <CheckSquare className="h-6 w-6" />
            </div>

            <h3 className="mt-3 text-lg font-bold text-slate-900">
              Location Summary & Submission
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Confirm physical count completion for location <strong>{selectedTask?.locationCode}</strong>.
            </p>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600">Expected Items:</span>
                <strong className="text-slate-900">{locationSummary.expected}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Counted Items:</span>
                <strong className="text-emerald-600">{locationSummary.counted}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Uncounted Items:</span>
                <strong className={locationSummary.uncounted > 0 ? "text-amber-600" : "text-slate-900"}>
                  {locationSummary.uncounted}
                </strong>
              </div>
            </div>

            {locationSummary.uncounted > 0 && (
              <div className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <span>
                  Warning: {locationSummary.uncounted} expected item(s) have not been counted in this aisle.
                </span>
              </div>
            )}

            <p className="mt-4 text-xs font-semibold text-slate-800">
              Are you sure you want to submit this location for supervisor review?
            </p>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setCompletionModalOpen(false)}
                className="flex-1 rounded-xl border border-slate-300 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Continue Counting
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmitLocation}
                disabled={submittingLocation}
                className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {submittingLocation ? "Submitting..." : "Submit Location"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
