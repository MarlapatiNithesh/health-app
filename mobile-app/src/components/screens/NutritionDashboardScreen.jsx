import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';

export default function NutritionDashboardScreen({ onOpenScreen, onOpenScanner }) {
  const [glasses, setGlasses] = useState(7);
  const [metabolicData, setMetabolicData] = useState(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loggedAlert, setLoggedAlert] = useState(false);

  useEffect(() => {
    api.getMetabolicSummary()
      .then((res) => {
        if (res?.data) {
          setMetabolicData(res.data);
          if (res.data.waterIntakeMl) {
            setGlasses(Math.round(res.data.waterIntakeMl / 250));
          }
        }
      })
      .catch((err) => {
        console.warn('Could not load metabolic summary from backend:', err.message);
      });
  }, []);

  const handleAddWater = () => {
    const nextGlasses = glasses < 10 ? glasses + 1 : glasses;
    setGlasses(nextGlasses);
    api.logWater(250).catch((e) => console.warn('Water log deferred:', e.message));
  };

  const handleMockScan = () => {
    setIsAnalyzing(true);
    setTimeout(() => {
      setIsAnalyzing(false);
      setLoggedAlert(true);
      setTimeout(() => {
        setIsScannerOpen(false);
        setLoggedAlert(false);
      }, 1000);
    }, 1200);
  };

  return (
    <div className="relative w-full max-w-[430px] mx-auto min-h-screen bg-[#f8f9fa] text-[#131b2e] flex flex-col justify-between font-sans select-none overflow-x-hidden">
      {/* Top Header */}
      <header className="sticky top-0 w-full z-40 bg-white/90 backdrop-blur-md border-b border-neutral-100 shadow-xs">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => onOpenScreen?.('home')}
              className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            </button>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-neutral-900 leading-tight">Food & Metabolic Intake</span>
                <span className="px-1.5 py-0.2 rounded-full bg-[#dff2be] text-[10px] font-bold text-emerald-950">
                  94 A+
                </span>
              </div>
              <span className="text-[11px] text-neutral-400 font-medium">Metabolic health pacing</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onOpenScreen?.('calorie_counter')}
              className="px-2.5 py-1 rounded-full bg-lime-100 text-lime-900 text-xs font-bold"
            >
              Macros
            </button>
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="w-8 h-8 rounded-xl bg-[#97E432] text-neutral-900 flex items-center justify-center shadow-xs"
            >
              <span className="material-symbols-outlined text-[18px]">photo_camera</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-4 pt-3 pb-24 space-y-3.5">
        {/* Caloric Intake Gauge Banner */}
        <div className="p-4 rounded-3xl bg-white border border-slate-100 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Today's Caloric Pacing</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-2xl font-black text-slate-900">1,430</span>
                <span className="text-xs font-bold text-slate-400">/ 1,920 kcal</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                490 kcal left
              </span>
            </div>
          </div>

          <div className="w-full bg-slate-100 h-2.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-[#84cc16] h-full rounded-full" style={{ width: '74%' }}></div>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100">
            <div className="text-center">
              <span className="text-[10px] font-semibold text-slate-400">Protein</span>
              <p className="text-xs font-black text-slate-800 mt-0.5">92g / 120g</p>
            </div>
            <div className="text-center">
              <span className="text-[10px] font-semibold text-slate-400">Carbs</span>
              <p className="text-xs font-black text-slate-800 mt-0.5">140g / 180g</p>
            </div>
            <div className="text-center">
              <span className="text-[10px] font-semibold text-slate-400">Fat</span>
              <p className="text-xs font-black text-slate-800 mt-0.5">48g / 65g</p>
            </div>
          </div>
        </div>

        {/* Quick Food OCR Scanner Trigger Banner */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#f7fee7] to-[#ecfccb] border border-[#d9f99d] flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#84cc16] text-black flex items-center justify-center font-bold shadow-xs">
              <span className="material-symbols-outlined text-[20px]">document_scanner</span>
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-900">Scan Meal Plate or Barcode</h4>
              <p className="text-[11px] text-[#365314]">Instant AI micro-nutrient breakdown</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenScanner || (() => onOpenScreen?.('food_ocr_scanner'))}
            className="px-3 py-1.5 rounded-full bg-[#1e3a07] text-[#cbf492] text-xs font-bold shadow-xs"
          >
            Launch Camera
          </button>
        </div>

        {/* Chrono-Meal Timeline */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black text-slate-900">Today's Chrono-Meals</h3>
            <button
              type="button"
              onClick={() => onOpenScreen?.('food_ocr_scanner')}
              className="text-xs font-bold text-lime-700 hover:underline"
            >
              + Log Food
            </button>
          </div>

          {/* Breakfast */}
          <div className="p-3 rounded-2xl bg-white border border-slate-100 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                🍳
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-bold text-slate-900">Avocado Toast & Poached Egg</h4>
                  <span className="text-[10px] text-slate-400">8:15 AM</span>
                </div>
                <p className="text-[11px] text-slate-500">380 kcal · 18g P · Low Glycemic</p>
              </div>
            </div>
            <span className="text-xs font-black text-slate-800">380 kcal</span>
          </div>

          {/* Lunch */}
          <div className="p-3 rounded-2xl bg-white border border-slate-100 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                🥗
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-bold text-slate-900">Grilled Chicken Quinoa Bowl</h4>
                  <span className="text-[10px] text-slate-400">1:10 PM</span>
                </div>
                <p className="text-[11px] text-slate-500">584 kcal · 48g P · AI Verified</p>
              </div>
            </div>
            <span className="text-xs font-black text-slate-800">584 kcal</span>
          </div>

          {/* Snack */}
          <div className="p-3 rounded-2xl bg-white border border-slate-100 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
                🫐
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-bold text-slate-900">Greek Yogurt & Berries</h4>
                  <span className="text-[10px] text-slate-400">4:45 PM</span>
                </div>
                <p className="text-[11px] text-slate-500">190 kcal · 15g P · GI 15</p>
              </div>
            </div>
            <span className="text-xs font-black text-slate-800">190 kcal</span>
          </div>
        </div>

        {/* Hydration Widget */}
        <div className="p-4 rounded-3xl bg-white border border-slate-100 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">water_drop</span>
              </div>
              <h3 className="text-xs font-bold text-slate-900">Hydration Pacing</h3>
            </div>
            <span className="text-xs font-black text-sky-700">{glasses} / 10 glasses</span>
          </div>

          <div className="w-full bg-sky-100 h-2 rounded-full overflow-hidden">
            <div className="bg-sky-500 h-full rounded-full transition-all" style={{ width: `${glasses * 10}%` }}></div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-slate-500">Target: 2.5 Liters daily</span>
            <button
              type="button"
              onClick={handleAddWater}
              disabled={glasses >= 10}
              className="px-3 py-1 bg-sky-100 hover:bg-sky-200 text-sky-800 text-xs font-bold rounded-full transition-colors"
            >
              {glasses >= 10 ? 'Goal Met' : '+ 1 Glass (250ml)'}
            </button>
          </div>
        </div>
      </main>

      {/* Slide-up Mini Scanner Drawer */}
      {isScannerOpen && (
        <div className="fixed inset-x-0 bottom-0 z-50 p-4 bg-white rounded-t-3xl shadow-2xl max-w-md mx-auto flex flex-col gap-3 border-t border-slate-200">
          <div className="w-10 h-1 rounded-full bg-slate-300 mx-auto"></div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#006c49] text-[20px]">view_in_ar</span>
              <h3 className="text-sm font-bold text-slate-900">Food & Barcode Scanner</h3>
            </div>
            <button
              type="button"
              onClick={() => setIsScannerOpen(false)}
              className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-600"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>

          <div className="relative w-full h-36 rounded-2xl bg-neutral-900 overflow-hidden flex items-center justify-center border border-neutral-800">
            <div className="border-2 border-dashed border-[#84cc16] w-3/4 h-24 rounded-lg flex items-center justify-center text-center px-2">
              <span className="text-xs text-white font-medium animate-pulse">
                Position food plate or barcode in viewfinder
              </span>
            </div>
            <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded-full text-[10px] text-white">
              Vision AI 4.2 • Live
            </div>
          </div>

          <button
            type="button"
            onClick={handleMockScan}
            disabled={isAnalyzing}
            className="w-full h-11 rounded-full bg-[#84cc16] text-neutral-900 font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-transform"
          >
            {isAnalyzing ? (
              <>
                <span className="material-symbols-outlined text-[18px] animate-spin">refresh</span>
                <span>Analyzing Plate...</span>
              </>
            ) : loggedAlert ? (
              <>
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                <span>Plate Logged!</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">lens_blur</span>
                <span>Analyze & Log Nutrients</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

