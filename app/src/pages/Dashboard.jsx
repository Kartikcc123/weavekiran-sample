import React from 'react';
import HeroBanner from '../components/HeroBanner';
import KpiCards from '../components/KpiCards';
import LiveInspection from '../components/LiveInspection';
import CurrentDetectionCard from '../components/CurrentDetectionCard';
import DefectClassesCard from '../components/DefectClassesCard';
import RecentInspectionGallery from '../components/RecentInspectionGallery';

export default function Dashboard() {
  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 flex flex-col gap-5 bg-[#F5F6F8]">
      {/* 1. Top Hero Banner */}
      <HeroBanner />

      {/* 2. Live Camera Feed (Large) + Right Column Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left: Live Inspection Feed (Spans 8 cols on large screens) */}
        <div className="lg:col-span-8 flex flex-col">
          <LiveInspection />
        </div>

        {/* Right: Current Detection + Defect Classes (Spans 4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-5 justify-between">
          <div className="flex-1">
            <CurrentDetectionCard />
          </div>
          <div className="flex-1">
            <DefectClassesCard />
          </div>
        </div>
      </div>

      {/* 3. Four KPI Metric Cards Strip (Below Camera Screen) */}
      <KpiCards />

      {/* 4. Bottom Section: Recent Inspection Gallery */}
      <RecentInspectionGallery />
    </div>
  );
}
