import React, { useState } from 'react';

export default function DeviceDiagnosticsScreen({ onOpenScreen }) {
  const [toastText, setToastText] = useState('');
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calValue, setCalValue] = useState('106');
  const [bpSyncing, setBpSyncing] = useState(false);
  const [antennaTesting, setAntennaTesting] = useState(false);
  const [antennaStatus, setAntennaStatus] = useState('4x Antennas OK');
  const [hapticAlerts, setHapticAlerts] = useState(true);

  const showToast = (msg) => {
    setToastText(msg);
    setTimeout(() => setToastText(''), 2500);
  };

  const handleBpSync = () => {
    setBpSyncing(true);
    setTimeout(() => {
      setBpSyncing(false);
      showToast('Omron BP telemetry stream saved: 120/78 mmHg');
    }, 1800);
  };

  const handleAntennaTest = () => {
    setAntennaTesting(true);
    setTimeout(() => {
      setAntennaTesting(false);
      setAntennaStatus('All 4x Antennas Optimal (2.4 GHz)');
      showToast('All BLE radio channels operating at peak gain');
    }, 1500);
  };

  return (
    <div className="relative w-full max-w-[430px] mx-auto min-h-screen bg-[#faf8ff] text-[#131b2e] flex flex-col justify-between font-sans select-none overflow-x-hidden">
      {/* Header */}
      <header className="fixed top-0 w-full max-w-[430px] z-50 bg-[#faf8ff]/90 backdrop-blur-xl border-b border-slate-100 shadow-xs">
        <div className="h-16 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenScreen?.('wearable_sync')}
              aria-label="Go back"
              className="w-10 h-10 rounded-full flex items-center justify-center text-slate-800 hover:bg-slate-100"
            >
              <span className="material-symbols-outlined text-[24px]">arrow_back</span>
            </button>
            <div className="flex flex-col">
              <h1 className="text-[16px] font-bold text-slate-900 leading-tight">Device Diagnostics</h1>
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Clinical Session Active
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenScreen?.('profile')}
            className="w-8 h-8 rounded-full bg-lime-500 text-slate-950 font-bold flex items-center justify-center shadow-xs"
          >
            <span className="material-symbols-outlined text-[18px]">person</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full pt-20 pb-28 px-4 space-y-3.5 overflow-y-auto">
        {/* Signal Diagnostics Hero Banner */}
        <div className="p-4 rounded-3xl bg-white border border-slate-100 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">BLE Mesh Signal Integrity</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
              99.8% Uptime
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2.5 rounded-2xl bg-slate-50">
              <span className="text-[10px] text-slate-500 font-semibold">Latency</span>
              <p className="text-sm font-black text-slate-900 mt-0.5">14 ms</p>
            </div>
            <div className="p-2.5 rounded-2xl bg-slate-50">
              <span className="text-[10px] text-slate-500 font-semibold">Signal RSSI</span>
              <p className="text-sm font-black text-emerald-700 mt-0.5">-58 dBm</p>
            </div>
            <div className="p-2.5 rounded-2xl bg-slate-50">
              <span className="text-[10px] text-slate-500 font-semibold">Packet Loss</span>
              <p className="text-sm font-black text-slate-900 mt-0.5">0.02%</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleAntennaTest}
            disabled={antennaTesting}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 transition-colors"
          >
            {antennaTesting ? (
              <>
                <span className="material-symbols-outlined text-[16px] animate-spin">autorenew</span>
                <span>Testing Spectrum...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[16px] text-emerald-600">network_check</span>
                <span>{antennaStatus}</span>
              </>
            )}
          </button>
        </div>

        {/* Connected Sensors Diagnostics */}
        <div className="space-y-2.5">
          <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider px-1">Active Medical Peripherals</h2>

          {/* Dexcom CGM */}
          <div className="p-3.5 rounded-2xl bg-white border border-slate-100 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-lime-100 text-lime-800 flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-[20px]">water_drop</span>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-bold text-slate-900">Dexcom G7 Continuous Glucose</h4>
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                </div>
                <p className="text-[11px] text-slate-500">Stream: 94 mg/dL · Calibrated 2h ago</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsCalibrating(true)}
              className="px-2.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-800"
            >
              Calibrate
            </button>
          </div>

          {/* Omron Blood Pressure */}
          <div className="p-3.5 rounded-2xl bg-white border border-slate-100 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-[20px]">favorite</span>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-bold text-slate-900">Omron Evolv BP Cuff</h4>
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                </div>
                <p className="text-[11px] text-slate-500">Last reading: 120/78 mmHg</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleBpSync}
              disabled={bpSyncing}
              className="px-2.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-800 flex items-center gap-1"
            >
              {bpSyncing && <span className="material-symbols-outlined text-[14px] animate-spin">sync</span>}
              <span>{bpSyncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>
          </div>

          {/* Apple Watch */}
          <div className="p-3.5 rounded-2xl bg-white border border-slate-100 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-[20px]">watch</span>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-bold text-slate-900">Apple Watch Series 9</h4>
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                </div>
                <p className="text-[11px] text-slate-500">Optical PPG 72 BPM · 88% Recovery</p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
              Live
            </span>
          </div>
        </div>

        {/* Haptic Triage Settings */}
        <div className="p-4 rounded-3xl bg-white border border-slate-100 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[18px]">vibration</span>
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900">Watch Haptic Crisis Triage</h4>
              <p className="text-[11px] text-slate-500">Vibrate wrist on arrhythmia or severe spike</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setHapticAlerts(!hapticAlerts);
              showToast(hapticAlerts ? 'Haptic triage muted' : 'Watch haptic triage alerts enabled');
            }}
            className={`w-11 h-6 rounded-full p-0.5 flex items-center transition-colors ${
              hapticAlerts ? 'bg-[#84cc16]' : 'bg-slate-300'
            }`}
          >
            <div className={`w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform ${
              hapticAlerts ? 'translate-x-5' : 'translate-x-0'
            }`}></div>
          </button>
        </div>
      </main>

      {/* Calibration Modal */}
      {isCalibrating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-5 w-full max-w-xs shadow-2xl flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Fingerstick Test Calibration</h3>
              <button
                type="button"
                onClick={() => setIsCalibrating(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Input the blood glucose test value from your handheld glucometer to compute the telemetry offset.
            </p>
            <div className="flex items-center gap-2 bg-slate-100 rounded-2xl p-3">
              <input
                type="number"
                value={calValue}
                onChange={(e) => setCalValue(e.target.value)}
                className="w-full bg-transparent text-2xl font-black text-slate-900 outline-none text-center"
              />
              <span className="text-xs font-bold text-slate-500">mg/dL</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsCalibrating(false);
                showToast(`Calibrated! Offset synced: ${calValue} mg/dL`);
              }}
              className="w-full py-3 rounded-full bg-[#84cc16] text-black font-extrabold text-xs shadow-md"
            >
              Calibrate Sensor
            </button>
          </div>
        </div>
      )}

      {/* Floating Toast */}
      {toastText && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-slate-900 text-white text-xs font-bold shadow-xl flex items-center gap-2 z-50">
          <span className="material-symbols-outlined text-lime-400 text-[18px]">info</span>
          <span>{toastText}</span>
        </div>
      )}
    </div>
  );
}

