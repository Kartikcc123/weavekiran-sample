import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SimulationProvider } from './context/SimulationContext';
import Sidebar from './components/Sidebar';
import Header from './components/Header';

// Pages
import Dashboard from './pages/Dashboard';
import LiveInspectionPage from './pages/LiveInspectionPage';
import ProductionPage from './pages/ProductionPage';
import HistoryPage from './pages/HistoryPage';
import ReportPage from './pages/ReportPage';

function App() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <SimulationProvider>
      <Router>
        <div className="flex h-screen w-screen overflow-hidden bg-[#F5F6F8] text-[#0F172A] font-sans">
          {/* Desktop Left Sidebar */}
          <Sidebar className="hidden md:flex" />

          {/* Mobile Overlay & Sidebar Drawer */}
          {mobileSidebarOpen && (
            <div
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs md:hidden flex"
              onClick={() => setMobileSidebarOpen(false)}
            >
              <div
                className="w-64 h-full shadow-2xl relative"
                onClick={(e) => e.stopPropagation()}
              >
                <Sidebar className="flex h-full w-full" />
              </div>
            </div>
          )}

          {/* Main App Content Area */}
          <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
            <Header onToggleSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)} />
            
            <main className="flex-1 overflow-hidden relative">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/live" element={<LiveInspectionPage />} />
                <Route path="/production" element={<ProductionPage />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/report" element={<ReportPage />} />
                <Route path="/visitor-question" element={<Dashboard />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </div>
      </Router>
    </SimulationProvider>
  );
}

export default App;
