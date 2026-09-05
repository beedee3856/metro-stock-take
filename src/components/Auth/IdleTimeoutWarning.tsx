"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { AlertCircle, Clock } from "lucide-react";

const IDLE_TIMEOUT_SECONDS = 3 * 60; // 3 minutes
const WARNING_BEFORE_LOGOUT_SECONDS = 30; // Warn 30 seconds before logout

export function IdleTimeoutWarning() {
  const { user, logout } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(WARNING_BEFORE_LOGOUT_SECONDS);
  const [lastActivityTime, setLastActivityTime] = useState<number>(Date.now());

  // Update activity time on user interaction
  useEffect(() => {
    if (!user) return;

    const updateActivity = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-idle-timeout-warning]")) return;

      setLastActivityTime(Date.now());
      setShowWarning(false);
      setSecondsLeft(WARNING_BEFORE_LOGOUT_SECONDS);
    };

    const events = ["mousedown", "keydown", "scroll", "touchstart", "click"];
    events.forEach((event) => {
      window.addEventListener(event, updateActivity);
    });

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, updateActivity);
      });
    };
  }, [user]);

  // Monitor idle time and show warning
  useEffect(() => {
    if (!user) return;

    const checkIdleInterval = setInterval(() => {
      const elapsedSeconds = (Date.now() - lastActivityTime) / 1000;
      const warningThreshold = IDLE_TIMEOUT_SECONDS - WARNING_BEFORE_LOGOUT_SECONDS;

      if (elapsedSeconds > IDLE_TIMEOUT_SECONDS) {
        // Auto logout
        logout();
      } else if (elapsedSeconds > warningThreshold) {
        // Show warning
        setShowWarning(true);
        setSecondsLeft(Math.ceil(IDLE_TIMEOUT_SECONDS - elapsedSeconds));
      } else {
        setShowWarning(false);
      }
    }, 1000); // Check every second

    return () => clearInterval(checkIdleInterval);
  }, [user, lastActivityTime, logout]);

  if (!user || !showWarning) {
    return null;
  }

  const handleStayActive = () => {
    setLastActivityTime(Date.now());
    setShowWarning(false);
  };

  const handleLogoutNow = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    await logout();
  };

  return (
    <div
      data-idle-timeout-warning
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
    >
      <div className="flex max-w-sm flex-col rounded-2xl bg-white shadow-2xl animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-amber-100 bg-amber-50 px-6 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-200 text-amber-700">
            <AlertCircle className="h-5 w-5" />
          </div>
          <h3 className="text-base font-bold text-amber-900">Session Expiring Soon</h3>
        </div>

        {/* Content */}
        <div className="space-y-4 px-6 py-4">
          <p className="text-sm text-slate-600">
            Your session will expire due to inactivity in <span className="font-bold text-amber-600">{secondsLeft} seconds</span>.
          </p>

          <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <Clock className="h-4 w-4 flex-shrink-0" />
            <span>Click below to continue working or you'll be logged out.</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 border-t border-slate-200 px-6 py-4">
          <button
            onClick={handleLogoutNow}
            className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Logout
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation();
              handleStayActive();
            }}
            className="flex-1 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          >
            Stay Active
          </button>
        </div>
      </div>
    </div>
  );
}
