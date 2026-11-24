import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export function MobileShell({
  currentTab,
  setCurrentTab,
  openSosModal,
  openNotificationsModal,
  children,
}) {
  const { member } = useAuth();
  const [isSimulatorFrame, setIsSimulatorFrame] = useState(true);

  const getTitle = () => {
    switch (currentTab) {
      case 'today':
      case 'home':
        return 'Today';
      case 'records':
        return 'Records Vault';
      case 'care':
        return 'Care Plan';
      case 'vitals':
        return 'Vitals & Telemetry';
      case 'medibot':
        return 'Dr. MediBot';
      case 'more':
        return 'More & Safety';
      default:
        return 'Today';
    }
  };

  const isTodayActive = currentTab === 'today' || currentTab === 'home';

  return (
    <div className="min-h-screen bg-[#ECEEF2] flex flex-col items-center justify-center p-0 sm:py-6 select-none font-sans text-charcoal">
      {/* Desktop Helper Toggle */}
      <div className="hidden sm:flex items-center justify-between w-full max-w-[430px] mb-2 px-3 py-1 bg-white/90 backdrop-blur-md rounded-xl border border-slate-200 text-xs text-slate-700 shadow-sm">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-[#97E432] animate-pulse"></span>
          <span className="font-bold text-slate-800">FITsure Mobile Viewport</span>
        </div>
        <button
          onClick={() => setIsSimulatorFrame(!isSimulatorFrame)}
          className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 transition cursor-pointer"
        >
          {isSimulatorFrame ? 'Expand Full View' : 'Frame View'}
        </button>
      </div>

      {/* Mobile Device Viewport Chassis */}
      <main
        className={`w-full max-w-[430px] bg-appBg flex flex-col overflow-hidden relative shadow-2xl transition-all duration-300 ${
          isSimulatorFrame
            ? 'min-h-screen sm:min-h-0 sm:h-[874px] sm:max-h-[94vh] rounded-none sm:rounded-[36px] border-x border-[#e2e8f0] sm:border-2 sm:border-slate-300'
            : 'min-h-screen rounded-none sm:rounded-[36px] border-x border-[#e2e8f0] sm:border-2 sm:border-slate-300'
        }`}
      >
        {/* Global Header Bar with Patient Context & SOS Trigger */}
        <section className="px-4 py-2 border-b border-neutral-100 bg-white/80 backdrop-blur-md z-20 shrink-0 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div 
              onClick={() => setCurrentTab('more')}
              className="relative cursor-pointer"
            >
              <img
                alt="Patient Avatar"
                className="w-9 h-9 rounded-full object-cover ring-2 ring-emerald-500/30"
                src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&q=80"
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-limeAccent border border-white rounded-full animate-pulse"></span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center space-x-1.5">
                <h1 className="text-sm font-bold text-neutral-900 leading-tight">
                  {getTitle()}
                </h1>
                <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-wide bg-emerald-50 px-1.5 py-0.5 rounded-full">
                  FITSURE
                </span>
              </div>
              <span className="text-[10px] text-neutral-500 leading-none">
                Connected · Apple Watch Synced 1m ago
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Notifications Alert Center Button */}
            <button
              onClick={openNotificationsModal}
              className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-700 flex items-center justify-center relative active:scale-95 transition cursor-pointer"
              title="Health Notifications & Alarms"
            >
              <span className="material-symbols-outlined text-[18px]">notifications</span>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 border border-white"></span>
            </button>

            {/* SOS Emergency Trigger Button */}
            <button
              onClick={openSosModal}
              className="px-2.5 py-1 rounded-full bg-red-500 hover:bg-red-600 text-white font-bold text-[11px] shadow-sm flex items-center space-x-1 active:scale-95 transition cursor-pointer animate-pulse"
              title="Emergency SOS Beacon"
            >
              <span className="material-symbols-outlined text-[13px]">emergency</span>
              <span>SOS</span>
            </button>
          </div>
        </section>

        {/* Scrollable Screen Content Container */}
        <div className="flex-1 overflow-y-auto relative no-scrollbar">
          {children}
        </div>

        {/* Pinned Interactive Bottom Navigation Dock with 6 Tabs */}
        <div className="w-full bg-white/95 backdrop-blur-md border-t border-neutral-100/90 pt-1 pb-3 px-2 z-30 shrink-0 select-none">
          <nav className="flex items-center justify-between relative">
            
            {/* Tab 1: Today */}
            <button
              onClick={() => setCurrentTab('today')}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition cursor-pointer ${
                isTodayActive ? 'text-emerald-800 font-bold' : 'text-neutral-400 hover:text-neutral-700'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">home</span>
              <span className="text-[9px] mt-0.5 font-bold">Today</span>
            </button>

            {/* Tab 2: Records */}
            <button
              onClick={() => setCurrentTab('records')}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition cursor-pointer ${
                currentTab === 'records' ? 'text-emerald-800 font-bold' : 'text-neutral-400 hover:text-neutral-700'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">folder_shared</span>
              <span className="text-[9px] mt-0.5">Records</span>
            </button>

            {/* Tab 3: Care */}
            <button
              onClick={() => setCurrentTab('care')}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition cursor-pointer ${
                currentTab === 'care' ? 'text-emerald-800 font-bold' : 'text-neutral-400 hover:text-neutral-700'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">medication</span>
              <span className="text-[9px] mt-0.5">Care</span>
            </button>

            {/* Tab 4: Vitals */}
            <button
              onClick={() => setCurrentTab('vitals')}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition cursor-pointer ${
                currentTab === 'vitals' ? 'text-emerald-800 font-bold' : 'text-neutral-400 hover:text-neutral-700'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">vital_signs</span>
              <span className="text-[9px] mt-0.5">Vitals</span>
            </button>

            {/* Tab 5: MediBot (Center Floating Accent) */}
            <div className="flex-1 flex flex-col items-center -mt-5">
              <button
                onClick={() => setCurrentTab('medibot')}
                className="w-11 h-11 p-1 bg-[#97E432] hover:bg-limeAccent text-neutral-900 rounded-full shadow-glow-lime flex items-center justify-center transition-transform active:scale-95 border-2 border-white cursor-pointer"
                title="Dr. MediBot AI Clinical Specialist"
              >
                <span className="material-symbols-outlined text-[22px]">smart_toy</span>
              </button>
              <span className="text-[9px] font-bold text-neutral-800 mt-0.5">MediBot</span>
            </div>

            {/* Tab 6: More */}
            <button
              onClick={() => setCurrentTab('more')}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition cursor-pointer ${
                currentTab === 'more' ? 'text-emerald-800 font-bold' : 'text-neutral-400 hover:text-neutral-700'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">more_horiz</span>
              <span className="text-[9px] mt-0.5">More</span>
            </button>

          </nav>
          {/* iOS Home Indicator */}
          <div className="w-28 h-1 bg-neutral-900 rounded-full mx-auto mt-2"></div>
        </div>
      </main>
    </div>
  );
}
