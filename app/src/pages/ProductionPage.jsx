import React from 'react';
import ProductionStatus from '../components/ProductionStatus';
import DefectSummary from '../components/DefectSummary';
import RecentInspectionGallery from '../components/RecentInspectionGallery';

export default function ProductionPage() {
  return (
    <div className="h-full overflow-y-auto p-4 md:p-6 flex flex-col gap-5 bg-[#F5F6F8]">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
        <ProductionStatus />
        <DefectSummary />
      </div>

      <RecentInspectionGallery />
    </div>
  );
}
