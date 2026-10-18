import React, { useState } from 'react';
import { 
  LayoutGrid, 
  CheckCircle2, 
  PlayCircle, 
  Trophy, 
  Star, 
  User, 
  Bell, 
  Bot, 
  FolderLock, 
  FileHeart, 
  Watch, 
  Smartphone, 
  Maximize2, 
  Minimize2,
  Sparkles,
  Stethoscope,
  Activity
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { isNative } from '../../native/nativeBridge';

export function MobileShell({ 
  currentTab, 
  setCurrentTab, 
  openMediBotModal, 
  openVaultModal, 
  openPatient360Modal,
  openPhoneHealthModal,
  children 
}) {
  const { member, livaPoints } = useAuth();
  const [isSimulatorFrame, setIsSimulatorFrame] = useState(true);
  const [showExpoQr, setShowExpoQr] = useState(false);
  const [copied, setCopied] = useState(false);

  const firstName = member?.firstName || member?.fullName?.split(' ')[0] || 'Member';

  const copyUrl = (text) => {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#050811] flex flex-col items-center justify-center p-0 md:p-6 transition-colors duration-300 relative overflow-hidden select-none">
      {/* Ambient Cyber Auroras for Pitch Visual Impact */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-cyan-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute -bottom-32 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Desktop Helper Toolbar */}
      <div className="hidden md:flex items-center justify-between w-full max-w-[430px] mb-3 px-3.5 py-1.5 bg-slate-900/85 backdrop-blur-xl rounded-2xl border border-white/10 text-xs text-slate-300 shadow-xl">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
          </span>
          <span className="font-semibold text-slate-200 tracking-wide">Fitsure Platform Active</span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowExpoQr(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 hover:opacity-95 text-slate-950 font-black rounded-lg shadow-sm transition active:scale-95 cursor-pointer"
            title="Scan with Expo Go or Phone Camera"
          >
            <Smartphone size={13} />
            <span>Mobile Preview</span>
          </button>
          <button 
            onClick={() => setIsSimulatorFrame(!isSimulatorFrame)}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-200 border border-white/5 transition active:scale-95 cursor-pointer"
            title="Toggle Phone Frame"
          >
            {isSimulatorFrame ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
            <span>{isSimulatorFrame ? 'Full' : 'Frame'}</span>
          </button>
        </div>
      </div>

      {/* Mobile QR & Telemetry Modal */}
      {showExpoQr && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-xl z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="glass-card max-w-sm w-full p-6 text-slate-100 flex flex-col items-center text-center relative border border-white/15">
            <button 
              onClick={() => setShowExpoQr(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 transition"
            >
              ✕
            </button>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center text-white mb-3 shadow-lg shadow-cyan-500/25">
              <Smartphone size={24} />
            </div>
            <h3 className="text-lg font-black text-white tracking-tight">Real-Time Mobile Device Sync</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-[280px]">
              Access full hardware BLE telemetry, Google Health Connect & Apple HealthKit syncing.
            </p>

            {/* QR Image */}
            <div className="my-4 p-3 bg-white rounded-2xl shadow-inner border border-white/20">
              <img 
                src="/expo-qr.png" 
                alt="Expo Go QR Code" 
                className="w-52 h-52 object-contain rounded-xl"
              />
            </div>

            <div className="w-full glass-subcard p-3 rounded-2xl text-left space-y-2 text-xs">
              <div>
                <p className="font-bold text-cyan-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                  Option 1: Native Mobile (Expo Go)
                </p>
                <p className="text-[11px] text-slate-400 ml-3.5">
                  Scan QR with <b>Expo Go</b> on Android or Camera app on iPhone.
                </p>
                <div className="ml-3.5 mt-1 font-mono text-[10px] text-cyan-200 bg-slate-950/60 p-1 rounded border border-white/10">
                  exp://192.168.1.43:8081
                </div>
              </div>

              <div className="border-t border-white/10 pt-2">
                <p className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  Option 2: Direct Phone Browser
                </p>
                <p className="text-[11px] text-slate-400 ml-3.5">
                  Open Chrome / Safari on your phone (same Wi-Fi):
                </p>
                <div className="ml-3.5 mt-1 flex items-center justify-between font-mono text-[10px] text-slate-300 bg-slate-950/60 p-1.5 rounded border border-white/10">
                  <span>http://10.81.228.214:5173/</span>
                  <button 
                    onClick={() => copyUrl('http://10.81.228.214:5173/')}
                    className="text-cyan-400 hover:text-cyan-300 font-sans font-bold text-[10px] ml-2"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowExpoQr(false)}
              className="mt-4 w-full py-2.5 bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 hover:opacity-95 text-slate-950 font-black rounded-xl text-xs transition shadow-lg shadow-cyan-500/20"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Main Container / Mobile Frame with Glassmorphic Chassis */}
      <div 
        className={`w-full bg-[#080c14] text-slate-100 flex flex-col overflow-hidden transition-all duration-300 relative glass-canvas ${
          isSimulatorFrame 
            ? 'max-w-[430px] h-[920px] max-h-[96vh] phone-case relative border-[8px] border-[#0f172a] shadow-2xl' 
            : 'max-w-[500px] min-h-screen md:min-h-[900px] md:rounded-3xl shadow-2xl border border-white/10'
        }`}
      >
        {/* Dynamic Island / Status Bar in High-Contrast Obsidian */}
        {!isNative && (
          <div className="bg-[#080c14]/85 backdrop-blur-xl sticky top-0 z-40 px-6 pt-3 pb-2 flex items-center justify-between border-b border-white/[0.06]">
            <span className="text-[13px] font-bold text-slate-100 tracking-tight">9:41</span>
            
            {/* Dynamic Island Pill */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-slate-900/90 border border-white/10 rounded-full text-[11px] text-white shadow-inner">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
              <span className="text-[10px] font-semibold text-cyan-200 tracking-wider">FITSURE LIVE</span>
            </div>

            <div className="flex items-center gap-1.5 text-slate-200">
              <span className="text-[11px] font-bold tracking-wider">5G</span>
              <div className="w-5 h-2.5 border border-slate-400 rounded-sm p-[1px] flex items-center">
                <div className="w-full h-full bg-cyan-400 rounded-[1px]"></div>
              </div>
            </div>
          </div>
        )}

        {/* Global Clinical Ecosystem Header Strip */}
        <div className="bg-slate-950/70 backdrop-blur-xl px-4 py-2.5 flex items-center justify-between text-white border-b border-white/[0.08]">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full justify-between">
            {/* Dr. MediBot */}
            <button
              onClick={openMediBotModal}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 rounded-full text-[11px] font-semibold transition active:scale-95 shadow-sm"
            >
              <Stethoscope size={13} className="text-cyan-400 animate-pulse" />
              <span>Dr. MediBot</span>
            </button>

            {/* Health Locker */}
            <button
              onClick={openVaultModal}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 rounded-full text-[11px] font-semibold transition active:scale-95"
            >
              <FolderLock size={13} className="text-purple-400" />
              <span>Health Locker</span>
            </button>

            {/* Patient 360 */}
            <button
              onClick={openPatient360Modal}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 rounded-full text-[11px] font-semibold transition active:scale-95"
            >
              <FileHeart size={13} className="text-emerald-400" />
              <span>Patient 360</span>
            </button>

            {/* Phone health telemetry */}
            <button
              onClick={openPhoneHealthModal}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/30 rounded-full text-[11px] font-semibold transition active:scale-95"
            >
              <Watch size={13} className="text-blue-400" />
              <span>Vitals Sync</span>
            </button>
          </div>
        </div>

        {/* Scrollable Screen Content */}
        <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
          {children}
        </div>

        {/* Floating Glassmorphic Bottom Navigation Dock */}
        <nav className="absolute bottom-3 left-3 right-3 glass-dock px-3 py-2 flex items-center justify-around z-30">
          {/* Home */}
          <button
            onClick={() => setCurrentTab('home')}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all duration-200 relative cursor-pointer ${
              currentTab === 'home' ? 'text-cyan-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutGrid size={20} strokeWidth={currentTab === 'home' ? 2.5 : 2} className={currentTab === 'home' ? 'drop-shadow-[0_0_8px_rgba(6,182,212,0.7)]' : ''} />
            <span className={`text-[10px] mt-1 font-bold ${currentTab === 'home' ? 'text-cyan-300' : 'text-slate-400'}`}>
              Home
            </span>
            {currentTab === 'home' && (
              <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full mt-0.5 shadow-[0_0_6px_rgba(6,182,212,0.9)]"></span>
            )}
          </button>

          {/* Dr. MediBot Center Action Button */}
          <button
            onClick={openMediBotModal}
            className="flex flex-col items-center justify-center -mt-3 py-1 px-2.5 rounded-xl transition-all duration-200 relative cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-500 via-blue-600 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-cyan-500/35 border-2 border-white/20 group-hover:scale-105 active:scale-95 transition-transform">
              <Stethoscope size={18} strokeWidth={2.4} />
            </div>
            <span className="text-[10px] mt-1 font-bold text-cyan-300">
              Dr. MediBot
            </span>
          </button>

          {/* Wearables Hub */}
          <button
            onClick={openPhoneHealthModal}
            className="flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all duration-200 relative cursor-pointer text-slate-400 hover:text-cyan-400"
          >
            <Watch size={20} strokeWidth={2} />
            <span className="text-[10px] mt-1 font-bold text-slate-400 hover:text-cyan-400">
              Wearables
            </span>
          </button>

          {/* Profile */}
          <button
            onClick={() => setCurrentTab('profile')}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all duration-200 relative cursor-pointer ${
              currentTab === 'profile' ? 'text-cyan-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <User size={20} strokeWidth={currentTab === 'profile' ? 2.5 : 2} className={currentTab === 'profile' ? 'drop-shadow-[0_0_8px_rgba(6,182,212,0.7)]' : ''} />
            <span className={`text-[10px] mt-1 font-bold ${currentTab === 'profile' ? 'text-cyan-300' : 'text-slate-400'}`}>
              Profile
            </span>
            {currentTab === 'profile' && (
              <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full mt-0.5 shadow-[0_0_6px_rgba(6,182,212,0.9)]"></span>
            )}
          </button>
        </nav>
      </div>
    </div>
  );
}
