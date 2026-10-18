import React, { useState } from 'react';
import { 
  PlayCircle, 
  Tv, 
  Users, 
  Heart, 
  Flame, 
  Sparkles, 
  Clock, 
  CheckCircle2, 
  Share2, 
  X,
  Stethoscope,
  Activity,
  Award
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import confetti from 'canvas-confetti';

export function LearnScreen() {
  const { setLivaPoints } = useAuth();
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [watchedVideos, setWatchedVideos] = useState([]);

  const categories = ['All', 'Live Stream', 'Yoga & Mobility', 'High Intensity', 'Doctor Talks', 'Nutrition'];

  const videoStreamList = [
    {
      id: 'v1',
      title: '30-Min High-Energy Fat Burn & Core Conditioning',
      instructor: 'Master Trainer Vikram • Performance Specialist',
      category: 'High Intensity',
      viewers: '2.4k Watching',
      duration: '32 mins',
      isLive: true,
      calories: '280 kcal',
      thumbnailBg: 'from-cyan-900 via-teal-950 to-slate-950',
      badge: 'LIVE WORKOUT',
      description: 'Full-body interval sequencing engineered to elevate VO2 max and stimulate metabolic afterburn.'
    },
    {
      id: 'v2',
      title: 'Managing Blood Sugar & HbA1c with Precision Nutrition',
      instructor: 'Dr. R. Mehta • Clinical Endocrinologist',
      category: 'Doctor Talks',
      viewers: '1.8k Watching',
      duration: '45 mins',
      isLive: true,
      calories: 'Clinical',
      thumbnailBg: 'from-blue-950 via-slate-900 to-slate-950',
      badge: 'DOCTOR MASTERCLASS',
      description: 'Meal timing, glycemic index pacing, and preventing glucose excursions verified by CGM telemetry.'
    },
    {
      id: 'v3',
      title: 'Sunrise Vinyasa Flow for Spinal Decompression',
      instructor: 'Ananya S. • Breathwork & Mobility Lead',
      category: 'Yoga & Mobility',
      viewers: '980 Completed',
      duration: '25 mins',
      isLive: false,
      calories: '120 kcal',
      thumbnailBg: 'from-teal-950 via-slate-900 to-slate-950',
      badge: 'MOBILITY & RECOVERY',
      description: 'Spinal decompression, hip openers, and mindful pranayama respiration for autonomic balance.'
    },
    {
      id: 'v4',
      title: 'Gut Microbiome Dynamics & Metabolic Longevity',
      instructor: 'Pooja K. • Functional Nutrition Scientist',
      category: 'Nutrition',
      viewers: '1.2k Completed',
      duration: '20 mins',
      isLive: false,
      calories: 'Biomarkers',
      thumbnailBg: 'from-emerald-950 via-slate-900 to-slate-950',
      badge: 'NUTRITION LABS',
      description: 'How fermented foods, short-chain fatty acids, and prebiotics optimize immune resilience.'
    }
  ];

  const filteredVideos = activeCategory === 'All' 
    ? videoStreamList 
    : activeCategory === 'Live Stream'
      ? videoStreamList.filter(v => v.isLive)
      : videoStreamList.filter(v => v.category === activeCategory);

  const handleWatchVideo = (video) => {
    setSelectedVideo(video);
    if (!watchedVideos.includes(video.id)) {
      setWatchedVideos(prev => [...prev, video.id]);
      setLivaPoints(p => p + 30);
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.6 }
      });
    }
  };

  return (
    <div className="px-5 py-4 space-y-4 animate-fade-in text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 via-teal-400 to-emerald-400 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Activity size={18} className="text-slate-950 font-black" />
            </div>
            <span className="text-xl font-black tracking-tight text-white">
              Fitsure <span className="text-cyan-400">Masterclasses</span>
            </span>
          </div>
          <p className="text-xs font-medium text-slate-400">
            Interactive medical masterclasses, clinical longevity streams & trainer workouts
          </p>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 bg-cyan-500/10 text-cyan-300 border border-cyan-400/30 rounded-full text-xs font-bold">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
          <span>LIVE STREAM</span>
        </div>
      </div>

      {/* Hero Featured Live Broadcast */}
      <div className="glass-card rounded-2xl p-5 border border-cyan-500/30 shadow-xl relative overflow-hidden bg-gradient-to-br from-cyan-950/40 via-slate-900/80 to-slate-950">
        <div className="absolute top-0 right-0 w-44 h-44 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="relative z-10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping"></span>
                <span>ON AIR NOW</span>
              </span>
              <span className="text-xs text-cyan-200/80 font-medium">2.4k Stream Viewers</span>
            </div>
            <span className="text-[11px] font-bold text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-400/20">
              +30 Fitsure Credits
            </span>
          </div>

          <h3 className="text-base font-extrabold text-white leading-snug">
            Live Morning Mobility & Fat Burn Intervals
          </h3>

          <p className="text-xs text-slate-300 leading-relaxed">
            Real-time biometric tracking active. Continuous calorie & heart rate telemetry synced via Fitsure sensors.
          </p>

          <button 
            onClick={() => handleWatchVideo(videoStreamList[0])}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 text-slate-950 rounded-xl text-xs font-black shadow-lg shadow-cyan-500/25 hover:opacity-90 transition active:scale-95"
          >
            <PlayCircle size={16} />
            <span>Join Live Stream</span>
          </button>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setActiveCategory(c)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
              activeCategory === c
                ? 'bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 font-black shadow-md shadow-cyan-500/20'
                : 'glass-pill border border-white/5 text-slate-300 hover:text-white hover:border-cyan-400/30'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Videos List */}
      <div className="space-y-3">
        {filteredVideos.map((item) => (
          <div
            key={item.id}
            onClick={() => handleWatchVideo(item)}
            className="glass-card rounded-2xl p-4 border border-white/5 flex gap-3.5 items-center justify-between hover:border-cyan-500/30 transition-all duration-300 cursor-pointer"
          >
            <div className="flex gap-3.5 items-center flex-1">
              {/* Thumbnail Placeholder */}
              <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${item.thumbnailBg} border border-cyan-400/20 flex items-center justify-center text-cyan-300 shrink-0 shadow-inner relative overflow-hidden`}>
                <PlayCircle size={22} className="text-cyan-300" />
                {item.isLive && (
                  <span className="absolute bottom-1 left-1 px-1 bg-cyan-400 text-[8px] font-black rounded text-slate-950 uppercase">
                    Live
                  </span>
                )}
              </div>

              {/* Video Info */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                    {item.badge}
                  </span>
                  <span className="text-slate-600 text-xs">•</span>
                  <span className="text-[10px] text-slate-400 font-semibold">{item.duration}</span>
                </div>
                <h4 className="text-xs font-bold text-white leading-snug line-clamp-1">
                  {item.title}
                </h4>
                <p className="text-[11px] text-slate-400 font-medium">
                  {item.instructor}
                </p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[10px] font-bold text-slate-400 block">{item.viewers}</span>
              {watchedVideos.includes(item.id) && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 mt-1">
                  <CheckCircle2 size={12} /> Watched
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── MODAL: Video Player ── */}
      {selectedVideo && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="glass-card bg-slate-900/95 text-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl border border-cyan-500/30 space-y-4">
            {/* Mock Video Screen */}
            <div className="relative aspect-video bg-gradient-to-br from-slate-950 via-slate-900 to-black flex items-center justify-center border-b border-white/5">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center mx-auto border border-cyan-400/40 animate-pulse">
                  <PlayCircle size={32} />
                </div>
                <p className="text-xs font-bold text-cyan-200">Streaming Fitsure Live Ultra-HD</p>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setSelectedVideo(null)}
                className="absolute top-3 right-3 p-1.5 bg-black/60 rounded-full text-white hover:bg-black/90 transition"
              >
                <X size={16} />
              </button>

              {/* Live Tag */}
              {selectedVideo.isLive && (
                <div className="absolute top-3 left-3 px-2 py-0.5 bg-gradient-to-r from-cyan-500 to-teal-400 text-slate-950 text-[10px] font-black rounded uppercase">
                  LIVE
                </div>
              )}
            </div>

            {/* Video Details */}
            <div className="p-4 pt-0 space-y-3">
              <div>
                <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                  {selectedVideo.badge}
                </span>
                <h3 className="text-sm font-extrabold text-white mt-0.5">
                  {selectedVideo.title}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedVideo.instructor}
                </p>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed bg-white/5 p-3 rounded-xl border border-white/5">
                {selectedVideo.description}
              </p>

              <div className="flex items-center justify-between text-xs font-bold text-slate-300 pt-1">
                <span className="text-emerald-400 flex items-center gap-1">
                  <Award size={14} /> +30 Health Credits Awarded!
                </span>
                <button 
                  onClick={() => setSelectedVideo(null)}
                  className="px-4 py-1.5 bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 text-slate-950 rounded-xl text-xs font-black shadow-md shadow-cyan-500/20 active:scale-95 hover:opacity-90"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
