import React from 'react';

export default function LandingScreen({ onGetStarted, onOpenScreen }) {
  return (
    <div className="relative w-full max-w-[430px] mx-auto h-screen max-h-screen bg-[#f7fee7] flex flex-col justify-between overflow-hidden font-sans select-none border-x sm:border-2 border-lime-300/80 sm:border-slate-300 sm:rounded-[36px] shadow-2xl">
      {/* Organic soft ambient glow gradients matching reference artwork */}
      <div aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-16 -right-16 w-60 h-60 bg-lime-300/35 rounded-full blur-2xl"></div>
        <div className="absolute top-1/3 -left-20 w-64 h-64 bg-lime-200/40 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-10 right-0 w-72 h-72 bg-lime-300/30 rounded-full blur-2xl"></div>
        
        {/* Subtle ripple / resonance concentric circles */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] rounded-full border-[1.5px] border-lime-500/20 opacity-40"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] rounded-full border-[1.5px] border-lime-500/20 opacity-30"></div>

        {/* Ambient organic particle dots */}
        <div className="absolute top-[44%] left-[12%] w-3 h-3 rounded-full bg-emerald-700/40"></div>
        <div className="absolute top-[40%] right-[16%] w-2.5 h-2.5 rounded-full bg-emerald-800/30"></div>
        <div className="absolute top-[32%] left-[22%] w-3 h-3 rounded-full bg-lime-400/50"></div>
        <div className="absolute top-[56%] right-[20%] w-3 h-3 rounded-full bg-lime-300/60"></div>
      </div>

      {/* Top Header */}
      <header className="relative z-20 pt-3 px-5 flex-shrink-0">
        <div className="flex items-center justify-between py-1">
          <button 
            type="button" 
            onClick={() => onOpenScreen?.('auth')} 
            className="w-9 h-9 rounded-full bg-white/80 border border-lime-200 flex items-center justify-center text-slate-800 hover:bg-white transition-all shadow-xs"
            aria-label="Back to login"
          >
            <span className="material-symbols-outlined text-[20px]">login</span>
          </button>
          
          <div className="px-3.5 py-1 rounded-full bg-white/80 border border-lime-200/80 shadow-xs flex items-center gap-1.5 text-xs font-bold text-lime-950">
            <span className="w-2 h-2 rounded-full bg-lime-500 animate-pulse"></span>
            <span>FITsure</span>
          </div>

          <button 
            type="button" 
            onClick={() => onOpenScreen?.('signup_dedicated')} 
            className="w-9 h-9 rounded-full bg-white/80 border border-lime-200 flex items-center justify-center text-slate-800 hover:bg-white transition-all shadow-xs"
            aria-label="Get started"
          >
            <span className="material-symbols-outlined text-[20px]">person_add</span>
          </button>
        </div>
      </header>

      {/* Main Content - Strictly fits viewport without scroll */}
      <main className="relative z-10 flex-1 flex flex-col px-5 justify-between pt-1 pb-4 overflow-hidden">
        {/* Headline & Subtitle Block */}
        <section className="text-center pt-1">
          <h1 className="text-[26px] sm:text-[30px] leading-[1.12] font-black text-[#14532d] tracking-tight">
            Empower Your<br />Daily Health.
          </h1>
          <p className="mt-1.5 text-[12px] sm:text-[13px] leading-snug text-slate-700 font-medium px-2">
            All your medical vitals, doctor schedules, and wellness goals in one smart view.
          </p>
        </section>

        {/* Center Brand Emblem with Heart Pulse */}
        <section className="flex flex-col items-center justify-center py-1 my-auto">
          <div className="relative flex items-center justify-center">
            {/* Pulsing ambient glow aura */}
            <div className="absolute w-36 h-36 rounded-full bg-lime-400/30 blur-2xl pointer-events-none -z-10 animate-pulse"></div>
            <div className="absolute w-44 h-44 rounded-full bg-emerald-400/20 blur-3xl pointer-events-none -z-10"></div>

            {/* Soundwave frequency bar overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30 gap-[3px] -z-10">
              <span className="w-0.5 h-3 bg-lime-600 rounded-full"></span>
              <span className="w-0.5 h-5 bg-lime-600 rounded-full"></span>
              <span className="w-0.5 h-8 bg-lime-600 rounded-full"></span>
              <span className="w-0.5 h-12 bg-lime-600 rounded-full"></span>
              <span className="w-0.5 h-6 bg-lime-600 rounded-full"></span>
              <span className="w-0.5 h-14 bg-lime-600 rounded-full"></span>
              <span className="w-0.5 h-10 bg-lime-600 rounded-full"></span>
              <span className="w-0.5 h-16 bg-lime-600 rounded-full"></span>
              <span className="w-0.5 h-8 bg-lime-600 rounded-full"></span>
              <span className="w-0.5 h-12 bg-lime-600 rounded-full"></span>
            </div>

            {/* FITsure Health-Tech Heart Emblem */}
            <svg className="w-32 h-32 sm:w-36 sm:h-36 drop-shadow-md transition-all select-none" viewBox="0 0 160 160" fill="none">
              <defs>
                <linearGradient id="landingForestGrad" x1="20" y1="25" x2="140" y2="130" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#064e3b" />
                  <stop offset="100%" stopColor="#047857" />
                </linearGradient>
                <linearGradient id="landingPulseGrad" x1="20" y1="80" x2="140" y2="80" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#047857" />
                  <stop offset="45%" stopColor="#10b981" />
                  <stop offset="70%" stopColor="#84cc16" />
                  <stop offset="100%" stopColor="#a3e635" />
                </linearGradient>
                <linearGradient id="landingApexGrad" x1="50" y1="110" x2="110" y2="145" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#84cc16" />
                  <stop offset="50%" stopColor="#a3e635" />
                  <stop offset="100%" stopColor="#84cc16" />
                </linearGradient>
              </defs>
              <path d="M80 48 C70 27, 39 24, 25 43 C8 63, 18 97, 52 121" stroke="url(#landingForestGrad)" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M80 48 C90 27, 121 24, 135 43 C152 63, 142 97, 108 121" stroke="url(#landingForestGrad)" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M51 119 L80 143 L109 119" stroke="url(#landingApexGrad)" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M20 83 H53 L67 58 L85 116 L102 76 L115 83 H140" stroke="url(#landingPulseGrad)" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M67 58 L85 116 L102 76" stroke="#d9f99d" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.85" />
            </svg>
          </div>

          <div className="flex items-center gap-1.5 mt-1.5 opacity-80">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping"></span>
            <span className="w-1.5 h-1.5 rounded-full bg-lime-600"></span>
            <span className="text-[10px] font-bold tracking-wider text-emerald-900 uppercase">Continuous Telemetry Active</span>
          </div>
        </section>

        {/* Compact Value Proposition Items */}
        <section className="space-y-2 mb-2">
          <div className="flex items-center gap-3 bg-white/80 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/90 shadow-xs">
            <div className="w-8 h-8 rounded-xl bg-lime-100 flex items-center justify-center flex-shrink-0 text-lime-800 shadow-xs">
              <span className="material-symbols-outlined text-[17px]" style={{ fontVariationSettings: "'FILL' 1" }}>favorite</span>
            </div>
            <div className="text-left leading-tight flex-1">
              <h3 className="text-[12px] font-bold text-slate-900 tracking-tight">Track key health markers</h3>
              <p className="text-[10.5px] text-slate-600 font-medium">BP, Glucose, Heart Rate, SpO2 & Sleep</p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white/80 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/90 shadow-xs">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0 text-emerald-800 shadow-xs">
              <span className="material-symbols-outlined text-[17px]">smart_toy</span>
            </div>
            <div className="text-left leading-tight flex-1">
              <h3 className="text-[12px] font-bold text-slate-900 tracking-tight">MediBot Clinical AI</h3>
              <p className="text-[10.5px] text-slate-600 font-medium">Instant clinical guidance & chronotherapy</p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white/80 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/90 shadow-xs">
            <div className="w-8 h-8 rounded-xl bg-lime-100 flex items-center justify-center flex-shrink-0 text-lime-800 shadow-xs">
              <span className="material-symbols-outlined text-[17px]">track_changes</span>
            </div>
            <div className="text-left leading-tight flex-1">
              <h3 className="text-[12px] font-bold text-slate-900 tracking-tight">Build healthy habits</h3>
              <p className="text-[10.5px] text-slate-600 font-medium">Metabolic pacing & 4-tier health alarms</p>
            </div>
          </div>
        </section>

        {/* CTA Area */}
        <div className="pt-1 pb-1 flex-shrink-0">
          <button
            type="button"
            onClick={onGetStarted || (() => onOpenScreen?.('signup_dedicated'))}
            className="w-full py-3.5 px-6 bg-[#84cc16] hover:bg-[#78b814] active:scale-[0.98] transition-all text-neutral-950 font-black text-[15px] sm:text-[16px] rounded-full shadow-[0_10px_20px_-6px_rgba(132,204,22,0.6)] text-center tracking-tight flex items-center justify-center gap-2 cursor-pointer border border-lime-400/60"
          >
            <span>Get Started</span>
            <span className="material-symbols-outlined text-[19px]">arrow_forward</span>
          </button>
          
          <div className="text-center mt-2.5">
            <button
              type="button"
              onClick={() => onOpenScreen?.('auth')}
              className="text-[11.5px] font-semibold text-slate-700 hover:text-emerald-900 transition-colors cursor-pointer"
            >
              Already have an account? <span className="underline font-extrabold text-emerald-950">Sign In</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
