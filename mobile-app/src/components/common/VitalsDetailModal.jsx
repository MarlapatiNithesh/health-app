import React, { useState, useMemo } from 'react';
import { 
  Heart, 
  Activity, 
  Droplets, 
  Gauge, 
  X, 
  Clock, 
  ShieldCheck, 
  Info, 
  TrendingUp, 
  Plus, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';

export default function VitalsDetailModal({
  vitalKey,
  onClose,
  intradayData = {},
  latestValues = {},
  onOpenLogModal
}) {
  const [selectedPoint, setSelectedPoint] = useState(null);

  // Configuration per vital metric
  const config = useMemo(() => {
    switch (vitalKey) {
      case 'heart_rate':
        return {
          title: 'Heart Rate (Pulse)',
          shortName: 'Heart Rate',
          icon: Heart,
          unit: 'BPM',
          color: '#E11D48',
          gradientFrom: '#f43f5e',
          gradientTo: '#fb7185',
          bgLight: 'bg-rose-50',
          textColor: 'text-rose-600',
          borderColor: 'border-rose-200',
          targetRange: '60 - 100 BPM',
          targetLabel: 'Normal Resting Range',
          minY: 45,
          maxY: 140,
          currentValue: latestValues.heartRate,
          subValue: latestValues.restingHeartRate ? `Resting: ${latestValues.restingHeartRate} BPM` : null,
          getStatus: (val) => {
            if (!val) return { label: 'Awaiting Reading', color: 'text-slate-400 bg-slate-100' };
            if (val < 60) return { label: 'Resting / Athletic', color: 'text-sky-700 bg-sky-50 border border-sky-200' };
            if (val <= 100) return { label: 'Optimal / Normal', color: 'text-emerald-700 bg-emerald-50 border border-emerald-200' };
            return { label: 'Elevated Pulse', color: 'text-amber-700 bg-amber-50 border border-amber-200' };
          }
        };

      case 'spo2':
        return {
          title: 'Blood Oxygen (SpO2)',
          shortName: 'Blood Oxygen',
          icon: Gauge,
          unit: '%',
          color: '#0D9488',
          gradientFrom: '#14b8a6',
          gradientTo: '#2dd4bf',
          bgLight: 'bg-teal-50',
          textColor: 'text-teal-600',
          borderColor: 'border-teal-200',
          targetRange: '95% - 100%',
          targetLabel: 'Optimal Saturation',
          minY: 88,
          maxY: 100,
          currentValue: latestValues.spo2,
          subValue: latestValues.spo2 ? (latestValues.spo2 >= 95 ? 'Adequate Tissue Oxygenation' : 'Attention Recommended') : null,
          getStatus: (val) => {
            if (!val) return { label: 'Awaiting Reading', color: 'text-slate-400 bg-slate-100' };
            if (val >= 95) return { label: 'Optimal Saturation', color: 'text-emerald-700 bg-emerald-50 border border-emerald-200' };
            return { label: 'Low O2 Saturation', color: 'text-amber-700 bg-amber-50 border border-amber-200' };
          }
        };

      case 'blood_pressure':
        return {
          title: 'Blood Pressure',
          shortName: 'Blood Pressure',
          icon: Activity,
          unit: 'mmHg',
          color: '#0284C7',
          gradientFrom: '#0ea5e9',
          gradientTo: '#38bdf8',
          bgLight: 'bg-sky-50',
          textColor: 'text-sky-600',
          borderColor: 'border-sky-200',
          targetRange: '< 120 / < 80 mmHg',
          targetLabel: 'Standard Normotensive',
          minY: 50,
          maxY: 160,
          currentValue: latestValues.bpSys && latestValues.bpDia ? `${latestValues.bpSys}/${latestValues.bpDia}` : (latestValues.bpSys || null),
          subValue: latestValues.bpSys && latestValues.bpDia ? `Sys: ${latestValues.bpSys} · Dia: ${latestValues.bpDia}` : null,
          getStatus: (val) => {
            const sys = Number(latestValues.bpSys);
            const dia = Number(latestValues.bpDia);
            if (!sys) return { label: 'Awaiting Reading', color: 'text-slate-400 bg-slate-100' };
            if (sys < 120 && (dia ? dia < 80 : true)) return { label: 'Optimal Normotensive', color: 'text-emerald-700 bg-emerald-50 border border-emerald-200' };
            if (sys <= 129 && (dia ? dia < 80 : true)) return { label: 'Elevated BP', color: 'text-amber-700 bg-amber-50 border border-amber-200' };
            return { label: 'Stage 1 Hypertension', color: 'text-rose-700 bg-rose-50 border border-rose-200' };
          }
        };

      case 'blood_glucose':
        return {
          title: 'Blood Glucose',
          shortName: 'Blood Glucose',
          icon: Droplets,
          unit: 'mg/dL',
          color: '#D97706',
          gradientFrom: '#f59e0b',
          gradientTo: '#fbbf24',
          bgLight: 'bg-amber-50',
          textColor: 'text-amber-600',
          borderColor: 'border-amber-200',
          targetRange: '70 - 99 mg/dL (Fasting)',
          targetLabel: 'Normal Glycemic Band',
          minY: 60,
          maxY: 180,
          currentValue: latestValues.bloodGlucose,
          subValue: latestValues.bloodGlucose ? (latestValues.bloodGlucose < 100 ? 'Fasting Range Normal' : 'Pre-diabetic Band') : null,
          getStatus: (val) => {
            if (!val) return { label: 'Awaiting Reading', color: 'text-slate-400 bg-slate-100' };
            if (val < 100) return { label: 'Normal Glycemic', color: 'text-emerald-700 bg-emerald-50 border border-emerald-200' };
            if (val < 126) return { label: 'Pre-diabetic Range', color: 'text-amber-700 bg-amber-50 border border-amber-200' };
            return { label: 'High Glycemic', color: 'text-rose-700 bg-rose-50 border border-rose-200' };
          }
        };

      default:
        return {
          title: 'Vital Telemetry',
          shortName: 'Vital',
          icon: Activity,
          unit: '',
          color: '#00a8cc',
          gradientFrom: '#00a8cc',
          gradientTo: '#38bdf8',
          bgLight: 'bg-slate-50',
          textColor: 'text-slate-800',
          borderColor: 'border-slate-200',
          targetRange: 'Normal',
          targetLabel: 'Standard Target',
          minY: 0,
          maxY: 100,
          currentValue: null,
          subValue: null,
          getStatus: () => ({ label: 'Normal', color: 'text-emerald-700 bg-emerald-50' })
        };
    }
  }, [vitalKey, latestValues]);

  // Extract raw intraday samples for today
  const samples = useMemo(() => {
    let rawList = [];
    if (vitalKey === 'heart_rate') {
      rawList = intradayData.heart_rate || [];
    } else if (vitalKey === 'spo2') {
      rawList = intradayData.spo2 || [];
    } else if (vitalKey === 'blood_pressure') {
      const sysList = intradayData.blood_pressure_systolic || [];
      const diaList = intradayData.blood_pressure_diastolic || [];
      // Combine pairs by closest timestamp
      rawList = sysList.map((sys, idx) => ({
        ...sys,
        systolic: sys.value,
        diastolic: diaList[idx]?.value || (Number(sys.value) - 40),
        value: sys.value
      }));
    } else if (vitalKey === 'blood_glucose') {
      rawList = intradayData.blood_glucose || [];
    }

    return rawList.map((s, index) => {
      const recDate = new Date(s.recordedAt || s.recorded_at || Date.now());
      const hours = recDate.getHours();
      const minutes = recDate.getMinutes();
      const timeDecimal = hours + minutes / 60;
      const formattedTime = recDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return {
        ...s,
        index,
        recDate,
        timeDecimal,
        formattedTime,
        numericVal: Number(s.value)
      };
    }).sort((a, b) => a.timeDecimal - b.timeDecimal);
  }, [vitalKey, intradayData]);

  // Compute intraday summary statistics
  const stats = useMemo(() => {
    if (samples.length === 0) {
      return {
        min: null,
        max: null,
        avg: null,
        count: 0
      };
    }
    const vals = samples.map(s => s.numericVal).filter(v => Number.isFinite(v) && v > 0);
    if (vals.length === 0) return { min: null, max: null, avg: null, count: 0 };

    const min = Math.round(Math.min(...vals));
    const max = Math.round(Math.max(...vals));
    const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    return { min, max, avg, count: samples.length };
  }, [samples]);

  // SVG Chart Geometry
  const chartW = 340;
  const chartH = 150;
  const padX = 24;
  const padTop = 16;
  const padBottom = 26;
  const innerW = chartW - padX * 2;
  const innerH = chartH - padTop - padBottom;

  const minVal = config.minY;
  const maxVal = config.maxY;

  const getY = (val) => {
    const clamped = Math.max(minVal, Math.min(maxVal, Number(val) || minVal));
    const pct = (clamped - minVal) / (maxVal - minVal);
    return padTop + innerH - (pct * innerH);
  };

  const getX = (timeDec) => {
    const clampedT = Math.max(0, Math.min(24, timeDec));
    return padX + (clampedT / 24) * innerW;
  };

  // Build SVG Points & Path
  const { pathD, areaD, pointCoords } = useMemo(() => {
    if (samples.length === 0) {
      return { pathD: '', areaD: '', pointCoords: [] };
    }

    const coords = samples.map((s) => ({
      x: getX(s.timeDecimal),
      y: getY(s.numericVal),
      sample: s
    }));

    if (coords.length === 1) {
      const pt = coords[0];
      const pD = `M ${Math.max(padX, pt.x - 20)} ${pt.y} L ${Math.min(chartW - padX, pt.x + 20)} ${pt.y}`;
      const aD = `M ${Math.max(padX, pt.x - 20)} ${pt.y} L ${Math.min(chartW - padX, pt.x + 20)} ${pt.y} L ${Math.min(chartW - padX, pt.x + 20)} ${padTop + innerH} L ${Math.max(padX, pt.x - 20)} ${padTop + innerH} Z`;
      return { pathD: pD, areaD: aD, pointCoords: coords };
    }

    // Connect line segments
    let d = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 1; i < coords.length; i++) {
      // Smooth cubic bezier curve between data readings
      const prev = coords[i - 1];
      const cur = coords[i];
      const cx1 = prev.x + (cur.x - prev.x) / 2;
      const cy1 = prev.y;
      const cx2 = prev.x + (cur.x - prev.x) / 2;
      const cy2 = cur.y;
      d += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${cur.x} ${cur.y}`;
    }

    const firstX = coords[0].x;
    const lastX = coords[coords.length - 1].x;
    const bottomY = padTop + innerH;
    const aD = `${d} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;

    return { pathD: d, areaD: aD, pointCoords: coords };
  }, [samples, innerW, innerH]);

  const status = config.getStatus(config.currentValue);
  const Icon = config.icon;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div 
        className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh] animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl ${config.bgLight} ${config.borderColor} border flex items-center justify-center ${config.textColor} shadow-xs`}>
              <Icon size={22} className={vitalKey === 'heart_rate' ? 'animate-pulse' : ''} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900">{config.title}</h3>
                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Live Today
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                Intraday timeline & continuous sensor telemetry
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition border border-slate-200 cursor-pointer shadow-xs"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          
          {/* Key Metric Highlights Card */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 rounded-3xl p-4 sm:p-5 text-white shadow-xl relative overflow-hidden space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  Latest Captured Reading
                </span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                    {config.currentValue !== null ? config.currentValue : '--'}
                  </span>
                  <span className="text-sm font-bold text-slate-300">{config.unit}</span>
                </div>
                {config.subValue && (
                  <p className="text-xs text-slate-300 font-medium mt-0.5">
                    {config.subValue}
                  </p>
                )}
              </div>

              <div className="flex flex-col items-end gap-1.5">
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-xl ${status.color}`}>
                  {status.label}
                </span>
                <span className="text-[9px] text-slate-400 font-medium flex items-center gap-1">
                  <Clock size={10} />
                  <span>Recorded Today</span>
                </span>
              </div>
            </div>

            {/* Target Band Guide */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">{config.targetLabel}</span>
              <span className="font-extrabold text-emerald-400">{config.targetRange}</span>
            </div>
          </div>

          {/* Intraday 24-Hour Graph Section */}
          <div className="bg-slate-50/80 rounded-3xl p-4 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <TrendingUp size={14} className={config.textColor} />
                <span>Today's Trend (00:00 - 24:00)</span>
              </span>
              <span className="text-[10px] font-bold text-slate-400">
                {samples.length} reading{samples.length === 1 ? '' : 's'}
              </span>
            </div>

            {/* SVG Interactive Chart */}
            <div className="bg-white rounded-2xl p-2.5 border border-slate-100 shadow-inner relative">
              {samples.length > 0 ? (
                <>
                  <svg 
                    viewBox={`0 0 ${chartW} ${chartH}`} 
                    className="w-full h-40 overflow-visible"
                  >
                    <defs>
                      <linearGradient id={`grad-${vitalKey}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={config.gradientFrom} stopOpacity="0.35" />
                        <stop offset="100%" stopColor={config.gradientTo} stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal Reference Grid Lines */}
                    {[0.25, 0.5, 0.75].map((pct, i) => {
                      const y = padTop + innerH * pct;
                      const valAtY = Math.round(maxVal - (maxVal - minVal) * pct);
                      return (
                        <g key={i}>
                          <line
                            x1={padX}
                            y1={y}
                            x2={chartW - padX}
                            y2={y}
                            stroke="#e2e8f0"
                            strokeDasharray="3 3"
                            strokeWidth="1"
                          />
                          <text
                            x={padX - 4}
                            y={y + 3}
                            fill="#94a3b8"
                            fontSize="8"
                            textAnchor="end"
                            fontFamily="sans-serif"
                          >
                            {valAtY}
                          </text>
                        </g>
                      );
                    })}

                    {/* Target Safe Zone Band */}
                    {vitalKey === 'heart_rate' && (
                      <rect
                        x={padX}
                        y={getY(100)}
                        width={innerW}
                        height={getY(60) - getY(100)}
                        fill="#10b981"
                        fillOpacity="0.05"
                      />
                    )}

                    {/* Filled Area Under Curve */}
                    <path d={areaD} fill={`url(#grad-${vitalKey})`} />

                    {/* The Metric Curve Line */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke={config.color}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* Interactive Data Points */}
                    {pointCoords.map((pt, idx) => {
                      const isHovered = selectedPoint?.index === pt.sample.index;
                      return (
                        <g key={idx}>
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={isHovered ? 6 : 4}
                            fill="#ffffff"
                            stroke={config.color}
                            strokeWidth={isHovered ? 3 : 2}
                            className="cursor-pointer transition-all hover:scale-125"
                            onClick={() => setSelectedPoint(pt.sample)}
                          />
                        </g>
                      );
                    })}

                    {/* X-Axis Hour Labels */}
                    {['00:00', '06:00', '12:00', '18:00', '24:00'].map((label, i) => {
                      const x = padX + (i / 4) * innerW;
                      return (
                        <text
                          key={i}
                          x={x}
                          y={chartH - 6}
                          fill="#94a3b8"
                          fontSize="8"
                          textAnchor="middle"
                          fontWeight="bold"
                        >
                          {label}
                        </text>
                      );
                    })}
                  </svg>

                  {/* Selected Point Callout Popover */}
                  {selectedPoint && (
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-lg flex items-center gap-2 border border-slate-700 animate-fade-in">
                      <span className="text-emerald-400">{selectedPoint.numericVal} {config.unit}</span>
                      <span className="text-slate-400">at {selectedPoint.formattedTime}</span>
                      <button 
                        onClick={() => setSelectedPoint(null)}
                        className="text-slate-400 hover:text-white ml-1 cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="py-8 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                    <Info size={18} />
                  </div>
                  <p className="text-xs font-bold text-slate-700">
                    No sensor readings recorded for today yet
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                    Data will plot here automatically as your connected smartwatch or Google Health logs {config.shortName}.
                  </p>
                  {onOpenLogModal && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenLogModal(vitalKey);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition cursor-pointer mt-1"
                    >
                      <Plus size={13} />
                      <span>Log First Reading</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Summary Min / Max / Avg Row */}
            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              <div className="bg-white p-2 rounded-xl border border-slate-100">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Lowest</span>
                <span className="text-sm font-black text-slate-800">
                  {stats.min !== null ? `${stats.min} ${config.unit}` : '--'}
                </span>
              </div>
              <div className="bg-white p-2 rounded-xl border border-slate-100">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Average</span>
                <span className="text-sm font-black text-slate-800">
                  {stats.avg !== null ? `${stats.avg} ${config.unit}` : '--'}
                </span>
              </div>
              <div className="bg-white p-2 rounded-xl border border-slate-100">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Peak</span>
                <span className="text-sm font-black text-slate-800">
                  {stats.max !== null ? `${stats.max} ${config.unit}` : '--'}
                </span>
              </div>
            </div>
          </div>

          {/* Today's Captured Readings Stream */}
          {samples.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-black text-slate-800 block">
                Today's Timeline Log ({samples.length})
              </span>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {[...samples].reverse().map((s, idx) => (
                  <div 
                    key={idx}
                    className="p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-100 flex items-center justify-between text-xs transition"
                  >
                    <div className="flex items-center gap-2">
                      <Clock size={12} className="text-slate-400" />
                      <span className="font-extrabold text-slate-700">{s.formattedTime}</span>
                      <span className="text-[10px] text-slate-400">via Health Connect</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-slate-900 text-sm">
                        {vitalKey === 'blood_pressure' && s.systolic && s.diastolic
                          ? `${s.systolic}/${s.diastolic}`
                          : s.numericVal}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500">{config.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Clinical Context Footnote */}
          <div className="p-3 bg-emerald-50/70 border border-emerald-200/60 rounded-2xl text-[11px] text-emerald-900 flex items-start gap-2.5">
            <ShieldCheck size={16} className="text-emerald-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              <b>Zero Manual Entry:</b> Telemetry is synchronized directly from your companion watch sensors via Google Health Connect. All historical measurements are stored securely in your private Health Locker.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
          {onOpenLogModal && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenLogModal(vitalKey);
              }}
              className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition"
            >
              <Plus size={13} />
              <span>Log Entry</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs transition cursor-pointer text-center"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
