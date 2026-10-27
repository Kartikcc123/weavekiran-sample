import React from 'react';
import heroBannerBg from '../assets/hero_banner.jpg';

export default function HeroBanner() {
  return (
    <div
      className="relative rounded-2xl overflow-hidden shadow-xs border border-[#E5E7EB] bg-cover bg-center min-h-[150px] md:min-h-[165px] flex items-center px-6 md:px-8 py-5"
      style={{
        backgroundImage: `url(${heroBannerBg})`,
        backgroundPosition: 'right 25%'
      }}
    >
      {/* Soft gradient overlay on left for optimal text contrast */}
      <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/80 to-transparent pointer-events-none" />

      {/* Content wrapper */}
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between w-full gap-4">
        {/* Left Headline */}
        <div className="flex flex-col max-w-xl">
          <div className="flex flex-wrap items-baseline gap-x-2 text-2xl md:text-3xl font-extrabold tracking-tight">
            <span className="text-[#0F172A]">AI for</span>
            <span className="text-[#EA580C]">Cleaner Fabrics</span>
          </div>
          <div className="text-2xl md:text-3xl font-black text-[#15803D] tracking-tight leading-tight">
            A Stronger Bharat
          </div>
          
          <div className="flex items-center flex-wrap gap-2 text-xs md:text-sm font-semibold text-[#475569] mt-2 tracking-wide">
            <span>Detect</span>
            <span className="text-[#EA580C]">•</span>
            <span>Analyze</span>
            <span className="text-[#EA580C]">•</span>
            <span>Ensure Quality</span>
            <span className="text-[#15803D]">•</span>
            <span>Promote Sustainable Textiles</span>
          </div>
        </div>

        {/* Right Cursive Callout Quote */}
        <div className="hidden lg:flex flex-col items-end text-right select-none pr-4">
          <div
            className="text-lg md:text-xl font-bold text-[#1E293B] italic tracking-wide"
            style={{ fontFamily: 'Georgia, serif' }}
          >
            "From Farms to Fabrics
          </div>
          <div
            className="text-lg md:text-xl font-bold text-[#1E293B] italic tracking-wide -mt-1"
            style={{ fontFamily: 'Georgia, serif' }}
          >
            For a Sustainable India"
          </div>
          {/* Mini Tricolor wave ribbon */}
          <div className="w-24 h-1.5 rounded-full bg-gradient-to-r from-[#FF7A00] via-white to-[#10B981] shadow-xs mt-1 border border-black/10" />
        </div>
      </div>
    </div>
  );
}
