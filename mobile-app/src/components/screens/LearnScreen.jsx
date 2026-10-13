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

  const categories = ['All', 'Live Now', 'Yoga', 'Workouts', 'Doctor Talks', 'Nutrition'];

  const videoStreamList = [
    {
      id: 'v1',
      title: '30-Min High-Energy Fat Burn & Core',
      coach: 'Coach Vikram (Master Fitness Trainer)',
      category: 'Workouts',
      viewers: '2.4k Watching',
      duration: '32 mins',
      isLive: true,
      calories: '280 kcal',
      thumbnailBg: 'from-orange-600 via-rose-700 to-slate-900',
      badge: 'LIVE WORKOUT',
      description: 'Follow Coach Vikram through full-body intervals designed to elevate VO2 max and burn excess visceral fat.'
    },
    {
      id: 'v2',
      title: 'Managing Blood Sugar & HbA1c with Diet',
      coach: 'Dr. R. Mehta (Senior Diabetologist)',
      category: 'Doctor Talks',
      viewers: '1.8k Watching',
      duration: '45 mins',
      isLive: true,
      calories: 'Clinical',
      thumbnailBg: 'from-indigo-700 via-blue-900 to-slate-950',
      badge: 'DOCTOR MASTERCLASS',
      description: 'Essential guidance on meal timing, glycemic index pacing, and preventing postprandial glucose spikes.'
    },
    {
      id: 'v3',
      title: 'Sunrise Vinyasa Yoga for Spinal Health',
      coach: 'Coach Ananya (Yoga & Breathwork)',
      category: 'Yoga',
      viewers: '980 Completed',
      duration: '25 mins',
      isLive: false,
      calories: '120 kcal',
      thumbnailBg: 'from-emerald-700 via-teal-900 to-slate-950',
      badge: 'YOGA & MOBILITY',
      description: 'Gentle spinal decompression, hamstring openers, and mindful pranayama breathing for total rejuvenation.'
    },
    {
      id: 'v4',
      title: 'Gut Microbiome & Fermented Nutrition',
      coach: 'Pooja K. (Clinical Nutritionist)',
      category: 'Nutrition',
      viewers: '1.2k Completed',
      duration: '20 mins',
      isLive: false,
      calories: 'Nutrition Guide',
      thumbnailBg: 'from-amber-600 via-orange-800 to-slate-950',
      badge: 'NUTRITION ESSENTIALS',
      description: 'How fermented foods, resistant starches, and prebiotic fiber optimize immune resilience and mood regulation.'
    }
  ];

  const filteredVideos = activeCategory === 'All' 
    ? videoStreamList 
    : activeCategory === 'Live Now'
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
    <div className="px-5 py-4 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[#ED1C24] font-black text-xl tracking-tight">GOQ<span className="inline-block relative">i<span className="w-1.5 h-1.5 rounded-full bg-[#ED1C24] absolute -top-1 left-[1px]"></span></span><span className="inline-block relative">i<span className="w-1.5 h-1.5 rounded-full bg-[#ED1C24] absolute -top-1 left-[1px]"></span></span></span>
            <span className="text-xl font-extrabold text-slate-900 tracking-tight">Play</span>
          </div>
          <p className="text-xs font-semibold text-slate-400">Live Health OTT, Video Coaching & Doctor Masterclasses</p>
        </div>

        <div className="flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-[#ED1C24] border border-rose-200/80 rounded-full text-xs font-bold animate-pulse">
          <span className="w-2 h-2 rounded-full bg-[#ED1C24]"></span>
          <span>LIVE OTT</span>
        </div>
      </div>

      {/* Hero Featured Live Broadcast */}
      <div className="bg-gradient-to-br from-rose-950 via-slate-900 to-black rounded-[26px] p-5 text-white shadow-xl relative overflow-hidden border border-rose-900/40">
        <div className="absolute right-0 top-0 translate-x-6 -translate-y-6 w-44 h-44 bg-[#ED1C24]/20 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="relative z-10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-[#ED1C24] text-white rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                <span>ON AIR NOW</span>
              </span>
              <span className="text-xs text-rose-200/80 font-medium">2.4k Participants</span>
            </div>
            <span className="text-[11px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
              +30 Karma Points
            </span>
          </div>

          <h3 className="text-base font-extrabold text-white leading-snug">
            Live Morning Mobility & Fat Burn Intervals
          </h3>

          <p className="text-xs text-slate-300 leading-relaxed">
            Led by Coach Vikram. Real-time calorie tracking with your connected GOQii Smart Vital or Apple Health band.
          </p>

          <button 
            onClick={() => handleWatchVideo(videoStreamList[0])}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#ED1C24] hover:bg-rose-700 text-white rounded-full text-xs font-bold shadow-lg shadow-rose-600/30 transition active:scale-95"
          >
            <PlayCircle size={16} />
            <span>Join Live Session</span>
          </button>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setActiveCategory(c)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition shrink-0 ${
              activeCategory === c
                ? 'bg-[#ED1C24] text-white shadow-sm shadow-rose-500/20'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
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
            className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition cursor-pointer flex gap-3.5 items-center justify-between"
          >
            <div className="flex gap-3.5 items-center flex-1">
              {/* Thumbnail Placeholder */}
              <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${item.thumbnailBg} flex items-center justify-center text-white shrink-0 shadow-sm relative overflow-hidden`}>
                <PlayCircle size={24} className="text-white/90" />
                {item.isLive && (
                  <span className="absolute bottom-1 left-1 px-1 bg-[#ED1C24] text-[8px] font-black rounded text-white uppercase">
                    Live
                  </span>
                )}
              </div>

              {/* Video Info */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-[#ED1C24] uppercase tracking-wider">
                    {item.badge}
                  </span>
                  <span className="text-slate-300 text-xs">•</span>
                  <span className="text-[10px] text-slate-400 font-semibold">{item.duration}</span>
                </div>
                <h4 className="text-xs font-extrabold text-slate-900 leading-snug line-clamp-1">
                  {item.title}
                </h4>
                <p className="text-[11px] text-slate-500 font-medium">
                  {item.coach}
                </p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[10px] font-bold text-slate-400 block">{item.viewers}</span>
              {watchedVideos.includes(item.id) && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600 mt-1">
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
          <div className="bg-slate-900 text-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl border border-slate-800 space-y-4">
            {/* Mock Video Screen */}
            <div className="relative aspect-video bg-gradient-to-br from-slate-950 via-slate-900 to-black flex items-center justify-center border-b border-slate-800">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-full bg-[#ED1C24]/20 text-[#ED1C24] flex items-center justify-center mx-auto border border-[#ED1C24]/30 animate-pulse">
                  <PlayCircle size={32} />
                </div>
                <p className="text-xs font-bold text-slate-300">Streaming GOQii Play Live HD</p>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setSelectedVideo(null)}
                className="absolute top-3 right-3 p-1.5 bg-black/60 rounded-full text-white hover:bg-black"
              >
                <X size={16} />
              </button>

              {/* Live Tag */}
              {selectedVideo.isLive && (
                <div className="absolute top-3 left-3 px-2 py-0.5 bg-[#ED1C24] text-white text-[10px] font-black rounded uppercase">
                  LIVE
                </div>
              )}
            </div>

            {/* Video Details */}
            <div className="p-4 pt-0 space-y-3">
              <div>
                <span className="text-[10px] font-bold text-[#ED1C24] uppercase tracking-wider">
                  {selectedVideo.badge}
                </span>
                <h3 className="text-sm font-extrabold text-white mt-0.5">
                  {selectedVideo.title}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedVideo.coach}
                </p>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed bg-slate-800/60 p-3 rounded-xl border border-slate-700/50">
                {selectedVideo.description}
              </p>

              <div className="flex items-center justify-between text-xs font-bold text-slate-300 pt-1">
                <span className="text-emerald-400 flex items-center gap-1">
                  <Award size={14} /> +30 Karma Points Awarded!
                </span>
                <button 
                  onClick={() => setSelectedVideo(null)}
                  className="px-4 py-1.5 bg-[#ED1C24] text-white rounded-full text-xs font-bold"
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
