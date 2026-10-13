import React, { useState } from 'react';
import { 
  Trophy, 
  Users, 
  Timer, 
  Star, 
  Footprints, 
  Moon, 
  Droplets, 
  Sparkles, 
  ChevronRight,
  CheckCircle2,
  Medal
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../../context/AuthContext';

export function ChallengesScreen() {
  const { challenges, joinChallenge, livaPoints, setLivaPoints } = useAuth();
  const [filter, setFilter] = useState('All');
  const [selectedChallenge, setSelectedChallenge] = useState(null);

  const activeCount = challenges.filter(c => c.status === 'joined').length;
  const availableCount = challenges.filter(c => c.status === 'available').length;
  const pointsAtStake = challenges
    .filter(c => c.status === 'joined')
    .reduce((acc, cur) => acc + cur.rewardPoints, 600);

  const filteredChallenges = challenges.filter(c => {
    if (filter === 'All') return true;
    if (filter === 'My Challenges') return c.status === 'joined';
    if (filter === 'Available') return c.status === 'available';
    return true;
  });

  const handleJoin = (id) => {
    confetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.7 }
    });
    joinChallenge(id);
    setSelectedChallenge(null);
  };

  const getChallengeIcon = (icon) => {
    switch (icon) {
      case 'walk':
        return (
          <div className="w-11 h-11 rounded-2xl bg-cyan-50 flex items-center justify-center text-[#00a8cc]">
            <Footprints size={22} />
          </div>
        );
      case 'sleep':
        return (
          <div className="w-11 h-11 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600">
            <Moon size={22} />
          </div>
        );
      case 'water':
        return (
          <div className="w-11 h-11 rounded-2xl bg-sky-50 flex items-center justify-center text-sky-500">
            <Droplets size={22} />
          </div>
        );
      default:
        return (
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <Sparkles size={22} />
          </div>
        );
    }
  };

  return (
    <div className="px-5 py-4 space-y-4 animate-fade-in">
      {/* 1. Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Challenges</h1>
        <p className="text-xs font-semibold text-slate-400 mt-0.5">Compete with colleagues and earn rewards</p>
      </div>

      {/* 2. Hero Banner (Cyan to Purple Gradient - Image 1) */}
      <div className="gradient-challenges-banner rounded-[26px] p-5 text-white shadow-lg shadow-indigo-500/20 relative overflow-hidden">
        <div className="grid grid-cols-3 divide-x divide-white/20 text-center">
          <div className="px-2">
            <span className="text-3xl font-extrabold tracking-tight block">{activeCount}</span>
            <span className="text-xs font-semibold text-cyan-100/90 mt-0.5 block">Active</span>
          </div>

          <div className="px-2">
            <span className="text-3xl font-extrabold tracking-tight block">{availableCount}</span>
            <span className="text-xs font-semibold text-cyan-100/90 mt-0.5 block">Available</span>
          </div>

          <div className="px-2">
            <span className="text-3xl font-extrabold tracking-tight block">{pointsAtStake}</span>
            <span className="text-xs font-semibold text-cyan-100/90 mt-0.5 block">Points at Stake</span>
          </div>
        </div>
      </div>

      {/* 3. Filter Tabs (All / My Challenges / Available) */}
      <div className="grid grid-cols-3 gap-2">
        {['All', 'My Challenges', 'Available'].map((tab) => {
          const isActive = filter === tab;
          return (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`py-2.5 rounded-2xl text-xs font-bold transition-all text-center ${
                isActive
                  ? 'bg-[#00a8cc] text-white shadow-md shadow-cyan-500/20'
                  : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50'
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>

      {/* 4. Challenge Cards List */}
      <div className="space-y-3.5">
        {filteredChallenges.map((item) => (
          <div
            key={item.id}
            className="bg-white rounded-[22px] p-5 border border-slate-100 shadow-sm hover:border-slate-200 transition space-y-3.5"
          >
            {/* Header row: Icon + Title + Joined Badge */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                {getChallengeIcon(item.icon)}
                <div>
                  <h3 className="text-sm font-bold text-slate-900 tracking-tight leading-snug">
                    {item.title}
                  </h3>
                  <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                    {item.program}
                  </p>
                </div>
              </div>

              {item.status === 'joined' ? (
                <span className="px-3 py-1 bg-emerald-50 border border-emerald-200/60 rounded-full text-[11px] font-bold text-emerald-600 shrink-0">
                  Joined
                </span>
              ) : (
                <button
                  onClick={() => handleJoin(item.id)}
                  className="px-3.5 py-1 bg-cyan-50 border border-cyan-200 text-[#00a8cc] hover:bg-[#00a8cc] hover:text-white rounded-full text-[11px] font-bold transition shrink-0"
                >
                  Join
                </button>
              )}
            </div>

            {/* Description */}
            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              {item.description}
            </p>

            {/* Progress Section */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-700">Progress</span>
                <span className="text-slate-900">{item.progress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    item.icon === 'sleep' ? 'bg-purple-600' : 'bg-[#00a8cc]'
                  }`}
                  style={{ width: `${item.progress}%` }}
                ></div>
              </div>
            </div>

            {/* Meta Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-50 text-[11px] font-semibold text-slate-500">
              <div className="flex items-center gap-1.5">
                <Users size={14} className="text-slate-400" />
                <span>{item.participants} participants</span>
              </div>

              <div className="flex items-center gap-1.5">
                <Timer size={14} className="text-slate-400" />
                <span>{item.daysLeft} days left</span>
              </div>

              <div className="flex items-center gap-1 text-amber-600 font-bold">
                <span className="text-amber-500">★</span>
                <span>{item.rewardPoints} Liva Points</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Corporate Leaderboard Teaser */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-2xl p-4 text-white flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-amber-400">
            <Medal size={22} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">Company Leaderboard</h4>
            <p className="text-[10px] text-slate-300">You're ranked #14 out of 240 colleagues this week!</p>
          </div>
        </div>
        <span className="text-xs font-bold text-cyan-300 flex items-center gap-1">
          View <ChevronRight size={14} />
        </span>
      </div>
    </div>
  );
}
