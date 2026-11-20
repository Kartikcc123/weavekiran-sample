import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Camera, BarChart3, Clock, FileCheck2, Sparkles, Leaf } from 'lucide-react';
import WeaveKiranLogo from './WeaveKiranLogo';
import sidebarBg from '../assets/sidebar_bg.jpg';

export default function Sidebar({ className = "" }) {
  const navItems = [
    {
      to: '/',
      label: 'Home',
      sublabel: null,
      icon: Home,
      end: true
    },
    {
      to: '/live',
      label: 'Inspection',
      sublabel: 'Live Inspection',
      icon: Camera,
      end: false
    },
    {
      to: '/production',
      label: 'Production Data',
      sublabel: null,
      icon: BarChart3,
      end: false
    },
    {
      to: '/history',
      label: 'History',
      sublabel: null,
      icon: Clock,
      end: false
    },
    {
      to: '/report',
      label: 'Report',
      sublabel: 'Final Quality Report',
      icon: FileCheck2,
      end: false
    }
  ];

  return (
    <aside
      className={`w-64 flex-shrink-0 flex flex-col justify-between border-r border-[#EBECEF] relative overflow-hidden select-none bg-[#FCFBF7] ${className}`}
      style={{
        backgroundImage: `url(${sidebarBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'left center'
      }}
    >
      {/* Soft translucent wash over background to keep text high-contrast */}
      <div className="absolute inset-0 bg-[#FCFBF7]/85 backdrop-blur-[0.5px] pointer-events-none" />

      {/* Main Content */}
      <div className="relative z-10 p-5 flex flex-col">
        {/* Brand Header */}
        <div className="flex items-center gap-3 mb-8">
          <WeaveKiranLogo size={46} className="flex-shrink-0 shadow-sm rounded-full" />
          <div className="flex flex-col">
            <div className="text-xl font-extrabold tracking-tight leading-tight">
              <span className="text-[#0F172A]">Weave</span>
              <span className="text-[#EA580C]">Kiran</span>
            </div>
            <span className="text-[10px] font-semibold text-[#64748B] tracking-wide leading-tight mt-0.5">
              AI Powered<br />Fabric Defect Detector
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-col gap-2.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `
                  group flex items-center gap-3.5 px-4 py-3 rounded-xl font-bold transition-all duration-200
                  ${isActive
                    ? 'bg-gradient-to-r from-[#EA580C] to-[#F97316] text-white shadow-md shadow-orange-500/20'
                    : 'text-[#1E293B] hover:bg-white/80 hover:text-[#EA580C]'
                  }
                `}
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={`w-5 h-5 flex-shrink-0 transition-transform group-hover:scale-105 ${
                        isActive ? 'text-white' : 'text-[#64748B] group-hover:text-[#EA580C]'
                      }`}
                    />
                    <div className="flex flex-col leading-tight">
                      <span className="text-sm">{item.label}</span>
                      {item.sublabel && (
                        <span
                          className={`text-[10px] font-medium ${
                            isActive ? 'text-white/85' : 'text-[#64748B]'
                          }`}
                        >
                          {item.sublabel}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Bottom Heritage / Mission Tag */}
      <div className="relative z-10 p-5 pt-0">
        <div className="p-3.5 rounded-xl bg-white/70 border border-[#E2E8F0]/80 shadow-xs backdrop-blur-xs flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#0F172A]">
            <Sparkles className="w-3.5 h-3.5 text-[#EA580C]" />
            <span>Sustainable Textiles</span>
          </div>
          <div className="text-[11px] font-bold text-[#15803D]">
            Stronger Bharat
          </div>
          <div className="w-full h-1 rounded-full bg-gradient-to-r from-[#FF7A00] via-white to-[#10B981] my-0.5 border border-black/5" />
          <div className="flex items-center gap-1 text-[9px] text-[#64748B] font-medium leading-tight">
            <Leaf className="w-2.5 h-2.5 text-[#15803D] flex-shrink-0" />
            <span>AI for Quality, Sustainability & Aatmanirbhar Bharat</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
