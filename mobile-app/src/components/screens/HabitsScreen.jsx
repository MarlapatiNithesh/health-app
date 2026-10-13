import React, { useState } from 'react';
import { 
  Bell, 
  Settings, 
  Flame, 
  Check, 
  Plus, 
  Footprints, 
  Droplets, 
  Sparkles, 
  HeartHandshake, 
  Moon, 
  Utensils, 
  Activity,
  X
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useAuth } from '../../context/AuthContext';

export function HabitsScreen() {
  const { habits, toggleHabit, addHabit } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newHabit, setNewHabit] = useState({
    name: '',
    desc: '',
    time: '08:00',
    category: 'exercise',
    icon: 'walk'
  });

  const categories = ['All', 'Exercise', 'Nutrition', 'Mind', 'Sleep'];

  const filteredHabits = selectedCategory === 'All'
    ? habits
    : habits.filter(h => h.category.toLowerCase() === selectedCategory.toLowerCase());

  const completedCount = habits.filter(h => h.completed).length;
  const totalCount = habits.length;
  const bestStreak = Math.max(...habits.map(h => h.streak), 12);

  const handleToggle = (id) => {
    const habit = habits.find(h => h.id === id);
    if (habit && !habit.completed) {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 }
      });
    }
    toggleHabit(id);
  };

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!newHabit.name.trim()) return;
    addHabit(newHabit);
    setNewHabit({ name: '', desc: '', time: '08:00', category: 'exercise', icon: 'walk' });
    setShowAddModal(false);
  };

  const getHabitIcon = (iconType) => {
    switch(iconType) {
      case 'walk':
      case 'run':
        return <Footprints size={18} className="text-cyan-500" />;
      case 'water':
        return <Droplets size={18} className="text-sky-500" />;
      case 'mind':
        return <Sparkles size={18} className="text-emerald-500" />;
      case 'food':
        return <Utensils size={18} className="text-amber-500" />;
      case 'sleep':
      case 'detox':
        return <Moon size={18} className="text-purple-500" />;
      default:
        return <Activity size={18} className="text-cyan-500" />;
    }
  };

  return (
    <div className="px-5 py-4 space-y-4 animate-fade-in">
      {/* 1. Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Healthy Habits</h1>
        <p className="text-xs font-semibold text-slate-400 mt-0.5">Build your daily routine</p>
      </div>

      {/* 2. Hero Progress Card (Teal Gradient) */}
      <div className="gradient-habits-banner rounded-[26px] p-5 text-white shadow-lg shadow-teal-500/20 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex-1 pr-4">
            <h3 className="text-sm font-bold text-white tracking-wide">Today's Progress</h3>
            <p className="text-xs font-medium text-teal-100/90 mt-0.5">
              {completedCount} of {totalCount} completed
            </p>

            {/* White Progress Bar */}
            <div className="w-full h-2 bg-white/20 rounded-full mt-3 overflow-hidden">
              <div 
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
              ></div>
            </div>
          </div>

          {/* Best Streak Box */}
          <div className="bg-white/20 backdrop-blur-md rounded-2xl px-4 py-3 flex flex-col items-center justify-center border border-white/20 text-center">
            <div className="flex items-center gap-1">
              <Flame size={20} className="text-amber-300 animate-bounce" />
              <span className="text-2xl font-extrabold leading-none text-white">{bestStreak}</span>
            </div>
            <span className="text-[10px] font-semibold text-teal-100 mt-1 uppercase tracking-wider">
              Best Streak
            </span>
          </div>
        </div>
      </div>

      {/* 3. Daily Reminders Active Banner */}
      <div className="bg-[#fffbeb] border border-[#fde68a] rounded-2xl p-4 flex items-center justify-between text-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
            <Bell size={18} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">Daily Reminders Active</h4>
            <p className="text-[11px] text-slate-500 font-medium leading-tight mt-0.5">
              You will get nudges for each habit at the scheduled time
            </p>
          </div>
        </div>

        <button 
          onClick={() => setShowAddModal(true)}
          className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-amber-100/50 transition"
        >
          <Settings size={18} />
        </button>
      </div>

      {/* 4. Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
        {categories.map((cat) => {
          const isActive = selectedCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all shrink-0 ${
                isActive 
                  ? 'bg-[#00a8cc] text-white shadow-sm shadow-cyan-500/20' 
                  : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* 5. Habits List */}
      <div className="space-y-3">
        {filteredHabits.map((habit) => (
          <div 
            key={habit.id}
            className={`rounded-2xl p-4 border transition-all duration-200 flex items-center justify-between ${
              habit.completed 
                ? 'bg-emerald-50/60 border-emerald-200/70 shadow-none' 
                : 'bg-white border-slate-100 shadow-sm hover:border-slate-200'
            }`}
          >
            {/* Left Checkbox + Content */}
            <div className="flex items-center gap-3.5 flex-1 min-w-0 pr-3">
              <button
                onClick={() => handleToggle(habit.id)}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all shrink-0 ${
                  habit.completed 
                    ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30' 
                    : 'border-2 border-slate-300 hover:border-cyan-500 bg-white'
                }`}
              >
                {habit.completed && <Check size={16} strokeWidth={3} />}
              </button>

              <div className="min-w-0">
                <h4 className={`text-sm font-bold tracking-tight ${
                  habit.completed ? 'text-slate-500 line-through' : 'text-slate-900'
                }`}>
                  {habit.name}
                </h4>
                <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">
                  {habit.desc}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-semibold text-slate-400">
                    ⏰ {habit.time}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Icon + Streak */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
                {getHabitIcon(habit.icon)}
              </div>
              <div className="flex items-center gap-0.5 text-xs font-extrabold text-amber-500">
                <Flame size={14} className="fill-amber-500" />
                <span>{habit.streak}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Floating Add Habit trigger */}
      <button
        onClick={() => setShowAddModal(true)}
        className="w-full py-3 border-2 border-dashed border-cyan-300 bg-cyan-50/50 hover:bg-cyan-50 rounded-2xl text-xs font-bold text-[#00a8cc] flex items-center justify-center gap-2 transition"
      >
        <Plus size={16} />
        <span>Add Custom Habit</span>
      </button>

      {/* Add Habit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-extrabold text-slate-900 text-base">Add New Habit</h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Habit Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 15 min Cardio"
                  value={newHabit.name}
                  onChange={(e) => setNewHabit({ ...newHabit, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl text-xs font-medium focus:ring-2 focus:ring-cyan-500 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Morning heart rate booster"
                  value={newHabit.desc}
                  onChange={(e) => setNewHabit({ ...newHabit, desc: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl text-xs font-medium focus:ring-2 focus:ring-cyan-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Time</label>
                  <input
                    type="time"
                    value={newHabit.time}
                    onChange={(e) => setNewHabit({ ...newHabit, time: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-xs font-medium focus:ring-2 focus:ring-cyan-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Category</label>
                  <select
                    value={newHabit.category}
                    onChange={(e) => setNewHabit({ ...newHabit, category: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-xs font-medium focus:ring-2 focus:ring-cyan-500 outline-none"
                  >
                    <option value="exercise">Exercise</option>
                    <option value="nutrition">Nutrition</option>
                    <option value="mind">Mind</option>
                    <option value="sleep">Sleep</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-[#00a8cc] hover:bg-cyan-600 text-white rounded-xl text-xs font-bold shadow-md shadow-cyan-500/30 transition mt-2"
              >
                Create Habit
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
