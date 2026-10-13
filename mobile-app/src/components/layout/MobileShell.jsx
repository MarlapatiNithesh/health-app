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
  Stethoscope
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

  const tabs = [
    { id: 'home', label: 'Home', icon: LayoutGrid },
    /*
    { id: 'habits', label: 'Habits', icon: CheckCircle2 },
    { id: 'learn', label: 'Play', icon: PlayCircle },
    { id: 'challenges', label: 'Challenges', icon: Trophy },
    { id: 'rewards', label: 'Store', icon: Star },
    */
    { id: 'profile', label: 'Profile', icon: User },
  ];

  const firstName = member?.firstName || member?.fullName?.split(' ')[0] || 'Member';

  const copyUrl = (text) => {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-0 md:p-6 transition-colors duration-300">
      {/* Desktop Helper Toolbar */}
      <div className="hidden md:flex items-center justify-between w-full max-w-[430px] mb-3 px-3 py-1.5 bg-slate-800/80 backdrop-blur rounded-2xl border border-slate-700/60 text-xs text-slate-300">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="font-semibold text-slate-200">:4000 Connected</span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowExpoQr(true)}
            className="flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold rounded-lg shadow-sm transition"
            title="Scan with Expo Go or Phone Camera"
          >
            <Smartphone size={13} />
            <span>Open on Phone</span>
          </button>
          <button 
            onClick={() => setIsSimulatorFrame(!isSimulatorFrame)}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-200 transition"
            title="Toggle Phone Frame"
          >
            {isSimulatorFrame ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
            <span>{isSimulatorFrame ? 'Full' : 'Frame'}</span>
          </button>
        </div>
      </div>

      {/* Expo Go & Mobile QR Modal */}
      {showExpoQr && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-slate-800 shadow-2xl border border-slate-100 flex flex-col items-center text-center relative">
            <button 
              onClick={() => setShowExpoQr(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition"
            >
              ✕
            </button>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center text-white mb-3 shadow-md shadow-orange-500/30">
              <Smartphone size={24} />
            </div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">Open on Mobile Device</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-[280px]">
              Scan to run with native hardware pedometer, Google Health Connect & Apple HealthKit syncing!
            </p>

            {/* QR Image */}
            <div className="my-4 p-2 bg-white rounded-2xl border-2 border-slate-200 shadow-inner">
              <img 
                src="/expo-qr.png" 
                alt="Expo Go QR Code" 
                className="w-52 h-52 object-contain rounded-xl"
              />
            </div>

            <div className="w-full bg-slate-50 p-3 rounded-2xl border border-slate-200 text-left space-y-2 text-xs">
              <div>
                <p className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                  Option 1: Expo Go App
                </p>
                <p className="text-[11px] text-slate-500 ml-3.5">
                  Scan QR with <b>Expo Go</b> on Android or Camera app on iPhone.
                </p>
                <div className="ml-3.5 mt-1 font-mono text-[10px] text-slate-600 bg-white p-1 rounded border">
                  exp://192.168.1.43:8081
                </div>
              </div>

              <div className="border-t border-slate-200 pt-2">
                <p className="font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Option 2: Direct Phone Browser
                </p>
                <p className="text-[11px] text-slate-500 ml-3.5">
                  Open Chrome / Safari on your phone (same Wi-Fi):
                </p>
                <div className="ml-3.5 mt-1 flex items-center justify-between font-mono text-[10px] text-slate-600 bg-white p-1 rounded border">
                  <span>http://192.168.1.43:5173/</span>
                  <button 
                    onClick={() => copyUrl('http://192.168.1.43:5173/')}
                    className="text-emerald-600 hover:text-emerald-700 font-sans font-bold text-[10px]"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowExpoQr(false)}
              className="mt-4 w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Main Container / Mobile Frame */}
      <div 
        className={`w-full bg-[#f8fafc] text-slate-800 flex flex-col overflow-hidden transition-all duration-300 ${
          isSimulatorFrame 
            ? 'max-w-[430px] h-[920px] max-h-[96vh] phone-case relative border-[7px] border-slate-800 shadow-2xl' 
            : 'max-w-[500px] min-h-screen md:min-h-[900px] md:rounded-3xl shadow-2xl'
        }`}
      >
        {/* Dynamic Island / iPhone Status Bar — hidden on real phone (native shell has its own) */}
        {!isNative && (
          <div className="bg-white/90 backdrop-blur-md sticky top-0 z-40 px-6 pt-3 pb-2 flex items-center justify-between border-b border-slate-100">
            <span className="text-[13px] font-bold text-slate-900 tracking-tight">9:41</span>
            
            {/* Dynamic Island Pill */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-black rounded-full text-[11px] text-white shadow-sm">
              <span className="w-2 h-2 rounded-full bg-[#ED1C24] animate-pulse"></span>
              <span className="text-[10px] font-medium text-slate-300">GOQii Health OS Active</span>
            </div>

            <div className="flex items-center gap-1.5 text-slate-800">
              <span className="text-[11px] font-bold">5G</span>
              <div className="w-5 h-2.5 border border-slate-800 rounded-sm p-[1px] flex items-center">
                <div className="w-full h-full bg-slate-800 rounded-[1px]"></div>
              </div>
            </div>
          </div>
        )}

        {/* Global GOQii Health Ecosystem Strip */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-4 py-2 flex items-center justify-between text-white border-b border-slate-800/80">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full justify-between">
            {/* GOQii Doctor */}
            <button
              onClick={openMediBotModal}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-[#ED1C24]/20 hover:bg-[#ED1C24]/30 text-rose-300 border border-[#ED1C24]/40 rounded-full text-[11px] font-semibold transition"
            >
              <Stethoscope size={13} className="text-[#ED1C24] animate-pulse" />
              <span>GOQii Doctor</span>
            </button>

            {/* Health Locker */}
            <button
              onClick={openVaultModal}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 rounded-full text-[11px] font-semibold transition"
            >
              <FolderLock size={13} className="text-sky-300" />
              <span>Health Locker</span>
            </button>

            {/* Patient 360 */}
            <button
              onClick={openPatient360Modal}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-full text-[11px] font-semibold transition"
            >
              <FileHeart size={13} className="text-emerald-300" />
              <span>Patient 360</span>
            </button>

            {/* Phone health data */}
            <button
              onClick={openPhoneHealthModal}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 rounded-full text-[11px] font-semibold transition"
            >
              <Watch size={13} className="text-purple-300" />
              <span>Phone Health</span>
            </button>
          </div>
        </div>

        {/* Scrollable Screen Content */}
        <div className="flex-1 overflow-y-auto no-scrollbar pb-20">
          {children}
        </div>

        {/* Clean Bottom Tab Navigation Bar (No Overlapping Elements) */}
        <nav className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-100 px-3 py-2 flex items-center justify-around z-30 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
          {/* Home */}
          <button
            onClick={() => setCurrentTab('home')}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all duration-200 relative cursor-pointer ${
              currentTab === 'home' ? 'text-[#ED1C24]' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <LayoutGrid size={21} strokeWidth={currentTab === 'home' ? 2.5 : 2} />
            <span className={`text-[10px] mt-1 font-bold ${currentTab === 'home' ? 'text-[#ED1C24]' : 'text-slate-500'}`}>
              Home
            </span>
            {currentTab === 'home' && (
              <span className="w-1.5 h-1.5 bg-[#ED1C24] rounded-full mt-0.5"></span>
            )}
          </button>

          {/* Dr. MediBot Action */}
          <button
            onClick={openMediBotModal}
            className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all duration-200 relative cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#ED1C24] to-rose-600 text-white flex items-center justify-center shadow-md shadow-rose-500/25 group-hover:scale-105 active:scale-95 transition-transform">
              <Stethoscope size={16} strokeWidth={2.4} />
            </div>
            <span className="text-[10px] mt-0.5 font-bold text-rose-600">
              Dr. MediBot
            </span>
          </button>

          {/* Wearables Hub */}
          <button
            onClick={openPhoneHealthModal}
            className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all duration-200 relative cursor-pointer text-slate-400 hover:text-indigo-600"
          >
            <Watch size={21} strokeWidth={2} />
            <span className="text-[10px] mt-1 font-bold text-slate-500 hover:text-indigo-600">
              Wearables
            </span>
          </button>

          {/* Profile */}
          <button
            onClick={() => setCurrentTab('profile')}
            className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all duration-200 relative cursor-pointer ${
              currentTab === 'profile' ? 'text-[#ED1C24]' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <User size={21} strokeWidth={currentTab === 'profile' ? 2.5 : 2} />
            <span className={`text-[10px] mt-1 font-bold ${currentTab === 'profile' ? 'text-[#ED1C24]' : 'text-slate-500'}`}>
              Profile
            </span>
            {currentTab === 'profile' && (
              <span className="w-1.5 h-1.5 bg-[#ED1C24] rounded-full mt-0.5"></span>
            )}
          </button>
        </nav>
      </div>
    </div>
  );
}
