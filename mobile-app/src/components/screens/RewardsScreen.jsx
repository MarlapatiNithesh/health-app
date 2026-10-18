import React, { useState } from 'react';
import { 
  Star, 
  Gift, 
  Award, 
  Tag, 
  CheckCircle2, 
  Sparkles, 
  ChevronRight,
  TrendingUp,
  HeartHandshake,
  ShoppingBag,
  Activity,
  Check
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../../context/AuthContext';

export function RewardsScreen() {
  const { livaPoints, setLivaPoints } = useAuth();
  const [redeemed, setRedeemed] = useState([]);

  const rewards = [
    {
      id: 'r1',
      brand: 'Fitsure Hardware',
      title: 'Fitsure Smart Vital 2.0 Biometric & ECG Tracker',
      points: 1200,
      value: '₹3,499 Value',
      category: 'Smart Devices',
      code: 'FITSUREVITAL',
    },
    {
      id: 'r2',
      brand: 'Fitsure Smart Scale',
      title: 'Body Composition Smart Scale (BMI, Fat%, Muscle)',
      points: 800,
      value: '₹2,299 Value',
      category: 'Smart Devices',
      code: 'FITSURESCALE',
    },
    {
      id: 'r3',
      brand: 'Fitsure Diagnostics',
      title: 'Full Body Comprehensive Preventive Health Checkup',
      points: 500,
      value: '₹1,499 Value',
      category: 'Health Diagnostics',
      code: 'FITSURECHECKUP',
    },
    {
      id: 'r4',
      brand: 'Cult.fit & Fitsure',
      title: '1-Month All-Access Gym & Yoga Studio Pass',
      points: 600,
      value: '₹1,999 Value',
      category: 'Fitness',
      code: 'CULTFITSURE',
    },
    {
      id: 'r5',
      brand: 'Fitsure Social Impact',
      title: 'Provide 10 Balanced Meals to Underprivileged Children',
      points: 300,
      value: 'Health Initiative',
      category: 'Social Impact',
      code: 'IMPACT_MEALS',
    },
    {
      id: 'r6',
      brand: 'Fitsure Green Drive',
      title: 'Plant 3 Medicinal Plants in Clean Air Project',
      points: 200,
      value: 'Green Initiative',
      category: 'Social Impact',
      code: 'IMPACT_TREES',
    }
  ];

  const handleRedeem = (reward) => {
    if (livaPoints < reward.points) {
      alert(`You need ${reward.points} credits. Current balance is ${livaPoints}. Log daily habits, track hydration, and sync vitals to earn more.`);
      return;
    }

    confetti({
      particleCount: 70,
      spread: 80,
      origin: { y: 0.6 }
    });

    setLivaPoints(pts => pts - reward.points);
    setRedeemed(prev => [...prev, reward.id]);
  };

  return (
    <div className="px-5 py-4 space-y-4 animate-fade-in text-slate-100">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 via-teal-400 to-emerald-400 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Activity size={18} className="text-slate-950 font-black" />
          </div>
          <span className="text-xl font-black tracking-tight text-white">
            Fitsure <span className="text-cyan-400">Rewards & Credits</span>
          </span>
        </div>
        <p className="text-xs font-medium text-slate-400">
          Redeem earned health credits for biometric hardware, lab diagnostics, and fitness passes
        </p>
      </div>

      {/* Points Balance Banner */}
      <div className="glass-card rounded-2xl p-5 border border-cyan-500/30 shadow-xl relative overflow-hidden bg-gradient-to-br from-cyan-950/40 via-slate-900/80 to-slate-950">
        <div className="absolute top-0 right-0 w-36 h-36 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none"></div>
        <div className="flex items-center justify-between relative z-10">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-300/80">Available Member Credits</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-4xl font-black tracking-tight text-white">{livaPoints}</span>
              <span className="text-xs font-semibold text-cyan-300">Fitsure Credits</span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium mt-2 flex items-center gap-1.5">
              <TrendingUp size={13} className="text-cyan-400" />
              <span>Earn 25 for habits • 10 for hydration • 20 for vitals</span>
            </p>
          </div>

          <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center text-cyan-300 shadow-inner">
            <Star size={28} className="fill-cyan-400 text-cyan-400" />
          </div>
        </div>
      </div>

      {/* Rewards Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white tracking-wide">
            Verified Partner Catalog
          </h2>
          <span className="text-[11px] text-cyan-400 font-bold bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-400/20">
            Exclusive Startup Tier
          </span>
        </div>

        {rewards.map((reward) => {
          const isRedeemed = redeemed.includes(reward.id);
          const isSocialImpact = reward.category === 'Social Impact';

          return (
            <div
              key={reward.id}
              className="glass-card rounded-2xl p-4 border border-white/5 flex items-center justify-between gap-3 hover:border-cyan-500/30 transition-all duration-300"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center shrink-0 text-cyan-300">
                  {isSocialImpact ? <HeartHandshake size={20} /> : <ShoppingBag size={20} />}
                </div>

                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                      {reward.brand}
                    </span>
                    <span className="text-[9px] font-semibold text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                      {reward.value}
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-white leading-snug">
                    {reward.title}
                  </h3>
                  <div className="flex items-center gap-1 text-[11px] font-bold text-cyan-300">
                    <Star size={11} className="fill-cyan-400 text-cyan-400" />
                    <span>{reward.points} Credits</span>
                  </div>
                </div>
              </div>

              <div className="shrink-0">
                {isRedeemed ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold">
                    <CheckCircle2 size={13} /> Claimed
                  </span>
                ) : (
                  <button
                    onClick={() => handleRedeem(reward)}
                    disabled={livaPoints < reward.points}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
                      livaPoints >= reward.points
                        ? 'bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 text-slate-950 font-black shadow-md shadow-cyan-500/20 active:scale-95 hover:opacity-90'
                        : 'bg-white/5 text-slate-500 cursor-not-allowed border border-white/5'
                    }`}
                  >
                    {isSocialImpact ? 'Support' : 'Redeem'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
