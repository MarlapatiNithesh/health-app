import React, { useState } from 'react';

export default function FoodOcrScannerScreen({ onOpenScreen, onMealLogged }) {
  const [flashOn, setFlashOn] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isCaptured, setIsCaptured] = useState(false);

  const showNotification = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleCapture = () => {
    setIsCaptured(true);
    showNotification('AI Vision: Grilled Chicken Quinoa Bowl identified (584 kcal)');
  };

  const handleConfirmLog = () => {
    showNotification('Logged 584 kcal, 48g Protein to Lunch Diary');
    setTimeout(() => {
      if (onMealLogged) {
        onMealLogged();
      } else if (onOpenScreen) {
        onOpenScreen('nutrition_dashboard');
      }
    }, 1200);
  };

  return (
    <div className="relative w-full max-w-[430px] mx-auto min-h-screen bg-[#faf8ff] text-[#131b2e] flex flex-col justify-between font-sans select-none overflow-x-hidden">
      {/* Header */}
      <header className="w-full z-50 bg-white/90 backdrop-blur-xl shadow-xs flex-shrink-0 border-b border-slate-100">
        <div className="flex items-center justify-between px-4 h-16">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenScreen?.('home')}
              aria-label="Back"
              className="w-10 h-10 rounded-full flex items-center justify-center bg-white shadow-xs border border-slate-100 text-slate-800"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
            <h1 className="text-[17px] font-bold text-slate-900 tracking-tight ml-1">Smart Food Scanner</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-3 py-1 rounded-full bg-[#f7fee7] border border-[#bef264] flex items-center gap-1.5 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-[#84cc16] animate-pulse"></span>
              <span className="text-[11px] font-bold text-[#3f6212]">AI Active</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Viewfinder and Analysis Body */}
      <main className="flex-1 flex flex-col relative w-full overflow-hidden bg-[#0d1512]">
        <div className="flex-1 flex flex-col w-full overflow-y-auto pb-32">
          {/* Camera Viewfinder Box */}
          <div className="relative w-full aspect-[4/4.5] flex items-center justify-center overflow-hidden bg-slate-950">
            {/* Viewfinder visual backdrop */}
            <div
              className="absolute inset-0 bg-cover bg-center opacity-90 scale-105"
              style={{
                backgroundImage: `url("https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=900&auto=format&fit=crop&q=80")`,
              }}
            ></div>
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/80 pointer-events-none"></div>

            {/* Scanning line animation */}
            <div className="absolute inset-x-8 top-[35%] h-[2px] bg-gradient-to-r from-transparent via-[#a3e635] to-transparent shadow-[0_0_14px_#a3e635] animate-pulse pointer-events-none"></div>

            {/* Viewfinder Top Controls */}
            <div className="absolute top-4 inset-x-4 flex items-center justify-between z-20 pointer-events-auto">
              <button
                type="button"
                onClick={() => setFlashOn(!flashOn)}
                className={`w-10 h-10 rounded-full backdrop-blur-md flex items-center justify-center text-slate-900 shadow-sm transition-transform ${
                  flashOn ? 'bg-yellow-300 text-yellow-900 ring-2 ring-yellow-400' : 'bg-white/80'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">
                  {flashOn ? 'flash_on' : 'flash_off'}
                </span>
              </button>

              <div className="px-3 py-1 rounded-full bg-white/90 backdrop-blur-md shadow-md flex items-center gap-1.5 border border-white/60">
                <span className="w-2 h-2 rounded-full bg-[#84cc16] animate-ping"></span>
                <span className="text-[11px] text-slate-900 font-bold tracking-wide">Vision 4.2 • Plate Locked</span>
              </div>

              <button
                type="button"
                onClick={() => showNotification('Select plate image from gallery')}
                className="w-10 h-10 rounded-full bg-white/80 backdrop-blur-md flex items-center justify-center text-slate-900 shadow-sm"
              >
                <span className="material-symbols-outlined text-[20px]">photo_library</span>
              </button>
            </div>

            {/* Corner Viewfinder Targeting Guides */}
            <div className="absolute inset-8 pointer-events-none flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div className="w-8 h-8 rounded-tl-2xl border-t-2 border-l-2 border-[#bef264] shadow-[0_0_8px_#a3e635]"></div>
                <div className="w-8 h-8 rounded-tr-2xl border-t-2 border-r-2 border-[#bef264] shadow-[0_0_8px_#a3e635]"></div>
              </div>
              <div className="self-center flex flex-col items-center gap-1">
                <div className="w-12 h-12 rounded-full border border-dashed border-[#bef264]/80 flex items-center justify-center animate-spin">
                  <div className="w-3 h-3 rounded-full bg-[#bef264] shadow-[0_0_10px_#a3e635]"></div>
                </div>
              </div>
              <div className="flex justify-between items-end">
                <div className="w-8 h-8 rounded-bl-2xl border-b-2 border-l-2 border-[#bef264] shadow-[0_0_8px_#a3e635]"></div>
                <div className="w-8 h-8 rounded-br-2xl border-b-2 border-r-2 border-[#bef264] shadow-[0_0_8px_#a3e635]"></div>
              </div>
            </div>

            {/* Detected Tag Badge overlay */}
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between z-20">
              <div className="px-3 py-1.5 bg-black/75 backdrop-blur-md rounded-xl border border-white/20 text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-lime-400"></span>
                <span className="text-xs font-bold">Mediterranean Quinoa & Herb Bowl</span>
              </div>
              <span className="text-xs font-bold text-lime-300 bg-black/70 px-2.5 py-1 rounded-lg">
                98.4% Match
              </span>
            </div>
          </div>

          {/* Real-time Macro Diagnostics Bottom Card */}
          <div className="p-4 bg-white rounded-t-3xl shadow-xl -mt-4 relative z-30 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Recognized Dish</span>
                <h3 className="text-[18px] font-black text-slate-900 leading-tight">
                  Grilled Chicken & Quinoa Plate
                </h3>
              </div>
              <div className="text-right">
                <span className="text-[20px] font-black text-[#15803d]">584</span>
                <span className="text-xs font-bold text-slate-500 ml-1">kcal</span>
              </div>
            </div>

            {/* Macros 3 Grid */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-[#f0fdf4] p-2.5 rounded-2xl flex flex-col gap-1 border border-[#bbf7d0]">
                <div className="flex justify-between items-center text-[#15803d]">
                  <span className="text-[11px] font-bold">Protein</span>
                  <span className="text-[11px] font-black text-slate-900">48g</span>
                </div>
                <div className="w-full bg-[#bbf7d0] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-[#16a34a] h-full rounded-full" style={{ width: '80%' }}></div>
                </div>
              </div>

              <div className="bg-[#e0f2fe] p-2.5 rounded-2xl flex flex-col gap-1 border border-[#bae6fd]">
                <div className="flex justify-between items-center text-[#0369a1]">
                  <span className="text-[11px] font-bold">Carbs</span>
                  <span className="text-[11px] font-black text-slate-900">26g</span>
                </div>
                <div className="w-full bg-[#bae6fd] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-[#0284c7] h-full rounded-full" style={{ width: '38%' }}></div>
                </div>
              </div>

              <div className="bg-[#ede9fe] p-2.5 rounded-2xl flex flex-col gap-1 border border-[#ddd6fe]">
                <div className="flex justify-between items-center text-[#6d28d9]">
                  <span className="text-[11px] font-bold">Fats</span>
                  <span className="text-[11px] font-black text-slate-900">24g</span>
                </div>
                <div className="w-full bg-[#ddd6fe] h-1.5 rounded-full overflow-hidden">
                  <div className="bg-[#7c3aed] h-full rounded-full" style={{ width: '50%' }}></div>
                </div>
              </div>
            </div>

            {/* Telemetry Clinical Safety Banner */}
            <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-[#f7fee7] border border-[#ecfccb]">
              <span className="material-symbols-outlined text-[#65a30d] text-[18px]">favorite</span>
              <p className="text-[11px] text-[#3f6212] leading-tight">
                Optimal for telemetry (BP 120/80 · Fasting Glucose 98 mg/dL · Safe)
              </p>
            </div>

            {/* Shutter Trigger Button */}
            <div className="flex items-center justify-center py-1">
              <button
                type="button"
                onClick={handleCapture}
                aria-label="Capture plate"
                className="w-14 h-14 rounded-full bg-white shadow-md border border-slate-200 flex items-center justify-center p-1 active:scale-95 transition-transform"
              >
                <div className="w-full h-full rounded-full bg-[#84cc16] flex items-center justify-center text-slate-950 shadow-sm">
                  <span className="material-symbols-outlined text-[24px]">camera</span>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Sticky Actions Footer */}
        <div className="absolute bottom-0 inset-x-0 bg-white/95 backdrop-blur-xl border-t border-slate-100 p-4 pb-5 flex flex-col gap-2 z-40 shadow-lg">
          <button
            type="button"
            onClick={handleConfirmLog}
            className="w-full py-3.5 px-4 rounded-full bg-[#84cc16] hover:bg-[#8edb29] text-[#152907] font-extrabold text-[14px] shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            <span>Confirm & Log Meal</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenScreen?.('calorie_counter')}
            className="w-full py-2.5 px-4 rounded-full bg-white text-slate-700 font-bold text-[13px] border border-slate-200 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px] text-slate-500">tune</span>
            <span>Open Calorie Counter & Macro Partitioning</span>
          </button>
        </div>

        {/* Floating Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-28 inset-x-6 z-50 transition-all">
            <div className="bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center justify-between text-xs font-semibold">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-lime-400 text-[18px]">task_alt</span>
                <span>{toastMessage}</span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

