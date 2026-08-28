"use client";

import React, { useState } from "react";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Sidebar, NavSection } from "@/components/Navigation/Sidebar";
import { Header } from "@/components/Navigation/Header";
import { LoginView } from "@/components/Auth/LoginView";
import { DashboardView } from "@/components/Dashboard/DashboardView";
import { CountingTerminal } from "@/components/Counting/CountingTerminal";
import { MyTasksView } from "@/components/MyTasks/MyTasksView";
import { StockTakesView } from "@/components/StockTakes/StockTakesView";
import { RecountsView } from "@/components/Recounts/RecountsView";
import { ItemMasterView } from "@/components/ItemMaster/ItemMasterView";
import { ImportWizard } from "@/components/ItemMaster/ImportWizard";
import { LocationsView } from "@/components/Locations/LocationsView";
import { ReportsView } from "@/components/Reports/ReportsView";
import { AuditView } from "@/components/Audit/AuditView";
import { UsersView } from "@/components/Users/UsersView";
import { SettingsView } from "@/components/Settings/SettingsView";
import { RefreshCw } from "lucide-react";

function AppContent() {
  const { user, loading } = useAuth();
  const [activeSection, setActiveSection] = useState<NavSection>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [importWizardOpen, setImportWizardOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-rose-600" />
          <p className="text-xs font-semibold tracking-wider uppercase text-slate-400">
            Initializing MetroCount PRO...
          </p>
        </div>
      </div>
    );
  }

  // Not authenticated: render Login
  if (!user) {
    return <LoginView />;
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      {/* Responsive Sidebar */}
      <Sidebar
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        isOpen={sidebarOpen}
        onCloseMobile={() => setSidebarOpen(false)}
      />

      {/* Main Layout Container (Offset by Sidebar width on lg screens) */}
      <div className="flex min-h-screen flex-col lg:pl-72">
        {/* Top Header */}
        <Header
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onSelectSection={setActiveSection}
        />

        {/* Dynamic Section Body */}
        <main className="flex-1 p-4 lg:p-8">
          {activeSection === "dashboard" && (
            <DashboardView onSelectSection={setActiveSection} />
          )}

          {activeSection === "counting-terminal" && <CountingTerminal />}

          {activeSection === "my-tasks" && (
            <MyTasksView onSelectSection={setActiveSection} />
          )}

          {activeSection === "stock-takes" && <StockTakesView />}

          {activeSection === "recounts" && <RecountsView />}

          {activeSection === "items" && (
            <ItemMasterView onOpenImportWizard={() => setImportWizardOpen(true)} />
          )}

          {activeSection === "import-items" && (
            <div className="p-4 bg-white rounded-2xl border border-slate-200">
              <button
                onClick={() => setImportWizardOpen(true)}
                className="rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm"
              >
                Launch Import Wizard
              </button>
            </div>
          )}

          {activeSection === "locations" && <LocationsView />}

          {activeSection === "reports" && <ReportsView />}

          {activeSection === "audit-logs" && <AuditView />}

          {activeSection === "users" && <UsersView />}

          {activeSection === "settings" && <SettingsView />}
        </main>
      </div>

      {/* Multi-step Import Wizard Modal */}
      {importWizardOpen && (
        <ImportWizard
          onClose={() => setImportWizardOpen(false)}
          onSuccess={() => {
            setImportWizardOpen(false);
            setActiveSection("items");
          }}
        />
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
