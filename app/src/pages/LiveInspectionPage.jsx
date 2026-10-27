import React from 'react';
import LiveInspection from '../components/LiveInspection';
import CurrentDetectionCard from '../components/CurrentDetectionCard';
import DefectClassesCard from '../components/DefectClassesCard';
import KpiCards from '../components/KpiCards';

export default function LiveInspectionPage() {
  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 flex flex-col gap-5 bg-[#F5F6F8]">
      {/* 1. Main Live Camera Feed + Side Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-8 flex flex-col min-h-[460px]">
          <LiveInspection />
        </div>

        <div className="lg:col-span-4 flex flex-col gap-5 justify-between">
          <div className="flex-1">
            <CurrentDetectionCard />
          </div>
          <div className="flex-1">
            <DefectClassesCard />
          </div>
        </div>
      </div>

      {/* 2. KPI Metric Strip Below Camera Screen */}
      <KpiCards />
    </div>
  );
}
