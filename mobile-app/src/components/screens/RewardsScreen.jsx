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
  Watch
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../../context/AuthContext';

export function RewardsScreen() {
  const { livaPoints, setLivaPoints } = useAuth();
  const [redeemed, setRedeemed] = useState([]);

  const rewards = [
    {
      id: 'r1',
      brand: 'GOQii Hardware',
      title: 'GOQii Smart Vital 2.0 Fitness & ECG Tracker',
      points: 1200,
      value: '₹3,499 Value',
      category: 'Smart Devices',
      code: 'GOQIIVITAL',
    },
    {
      id: 'r2',
      brand: 'GOQii Smart Scale',
      title: 'Body Composition Smart Scale (BMI, Fat%, Muscle)',
      points: 800,
      value: '₹2,299 Value',
      category: 'Smart Devices',
      code: 'GOQIISCALE',
    },
    {
      id: 'r3',
      brand: 'GOQii Diagnostics',
      title: 'Full Body Comprehensive Preventive Health Checkup',
      points: 500,
      value: '₹1,499 Value',
      category: 'Health Diagnostics',
      code: 'GOQIICHECKUP',
    },
    {
      id: 'r4',
      brand: 'Cult.fit Pass',
      title: '1-Month All-Access Gym & Yoga Studio Pass',
      points: 600,
      value: '₹1,999 Value',
      category: 'Fitness',
      code: 'CULTGOQII',
    },
    {
      id: 'r5',
      brand: 'GOQii Karma Philanthropy',
      title: 'Donate Wholesome Meals to Underprivileged Children',
      points: 300,
      value: 'Social Cause',
      category: 'Karma Giving',
      code: 'KARMA_MEALS',
    },
    {
      id: 'r6',
      brand: 'GOQii Karma Green',
      title: 'Plant 3 Medicinal Trees in Afforestation Drive',
      points: 200,
      value: 'Social Cause',
      category: 'Karma Giving',
      code: 'KARMA_TREES',
    }
  ];

  const handleRedeem = (reward) => {
    if (livaPoints < reward.points) {
      alert(`You need ${reward.points} points. Current balance is ${livaPoints}. Complete more daily habits & challenges!`);
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
    <div className="px-5 py-4 space-y-4 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[#ED1C24] font-black text-xl tracking-tight">GOQ<span className="inline-block relative">i<span className="w-1.5 h-1.5 rounded-full bg-[#ED1C24] absolute -top-1 left-[1px]"></span></span><span className="inline-block relative">i<span className="w-1.5 h-1.5 rounded-full bg-[#ED1C24] absolute -top-1 left-[1px]"></span></span></span>
          <span className="text-xl font-extrabold text-slate-900 tracking-tight">Store & Karma</span>
        </div>
        <p className="text-xs font-semibold text-slate-400">Redeem GOQii Cash for health gear or donate Karma to causes</p>
      </div>

      {/* Points Balance Banner */}
      <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-[#ED1C24] rounded-[26px] p-5 text-white shadow-lg shadow-orange-500/25 relative overflow-hidden">
        <div className="flex items-center justify-between relative z-10">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-amber-100">Available Balance</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-4xl font-extrabold tracking-tight">{livaPoints}</span>
              <span className="text-sm font-bold text-amber-100">Karma Points / Cash</span>
            </div>
            <p className="text-[11px] text-amber-100 font-medium mt-2 flex items-center gap-1">
              <TrendingUp size={13} />
              <span>Earn 25 pts for habits, 10 pts for water, 20 pts for vitals</span>
            </p>
          </div>

          <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 text-amber-100">
            <Star size={32} className="fill-amber-300 text-amber-300" />
          </div>
        </div>
      </div>

      {/* Rewards Grid */}
      <div className="space-y-3">
        <h2 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center justify-between">
          <span>GOQii Health Catalog & Karma</span>
          <span className="text-xs text-[#ED1C24] font-bold">Featured Deals</span>
        </h2>

        {rewards.map((reward) => {
          const isRedeemed = redeemed.includes(reward.id);
          const isKarma = reward.category === 'Karma Giving';

          return (
            <div
              key={reward.id}
              className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center justify-between gap-3 hover:shadow-md transition"
            >
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  isKarma ? 'bg-rose-50 text-[#ED1C24]' : 'bg-amber-50 text-amber-600'
                }`}>
                  {isKarma ? <HeartHandshake size={22} /> : <ShoppingBag size={22} />}
                </div>

                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {reward.brand}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                      {reward.value}
                    </span>
                  </div>
                  <h3 className="text-xs font-extrabold text-slate-900 leading-snug">
                    {reward.title}
                  </h3>
                  <div className="flex items-center gap-1 text-[11px] font-bold text-amber-600">
                    <span>★ {reward.points} Points</span>
                  </div>
                </div>
              </div>

              <div>
                {isRedeemed ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold">
                    <CheckCircle2 size={13} /> Redeemed
                  </span>
                ) : (
                  <button
                    onClick={() => handleRedeem(reward)}
                    disabled={livaPoints < reward.points}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition shadow-sm ${
                      livaPoints >= reward.points
                        ? isKarma 
                          ? 'bg-[#ED1C24] hover:bg-rose-700 text-white shadow-rose-500/20 active:scale-95'
                          : 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20 active:scale-95'
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    {isKarma ? 'Donate' : 'Redeem'}
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
