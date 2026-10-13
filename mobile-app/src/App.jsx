import React, { useState } from 'react';
import { LayoutGrid, CheckCircle2, PlayCircle, Trophy, Star, User } from 'lucide-react';
import { useAuth } from './context/AuthContext';
import { AuthScreen } from './components/screens/AuthScreen';
import { MobileShell } from './components/layout/MobileShell';
import { HomeScreen } from './components/screens/HomeScreen';
import { HabitsScreen } from './components/screens/HabitsScreen';
import { LearnScreen } from './components/screens/LearnScreen';
import { ChallengesScreen } from './components/screens/ChallengesScreen';
import { RewardsScreen } from './components/screens/RewardsScreen';
import { ProfileScreen } from './components/screens/ProfileScreen';
import { MediBotScreen } from './components/screens/MediBotScreen';
import { VaultScreen } from './components/screens/VaultScreen';
import { Patient360Screen } from './components/screens/Patient360Screen';
import { WearablesScreen } from './components/screens/WearablesScreen';
import { isNative, toNative } from './native/nativeBridge';
import { ErrorBoundary } from './components/common/ErrorBoundary';

// All screen content — shared between native and browser views
function AppScreens({ currentTab, setCurrentTab, showMediBot, setShowMediBot, showVault, setShowVault, showPatient360, setShowPatient360, showWearables, setShowWearables }) {
  return (
    <>
      {currentTab === 'home' && (
        <HomeScreen
          openPhoneHealthModal={() => setShowWearables(true)}
          openPatient360Modal={() => setShowPatient360(true)}
          openMediBotModal={() => setShowMediBot(true)}
          openVaultModal={() => setShowVault(true)}
        />
      )}
      {currentTab === 'habits' && <HabitsScreen />}
      {currentTab === 'learn' && <LearnScreen />}
      {currentTab === 'challenges' && <ChallengesScreen />}
      {currentTab === 'rewards' && <RewardsScreen />}
      {currentTab === 'profile' && (
        <ProfileScreen
          openVaultModal={() => setShowVault(true)}
          openPatient360Modal={() => setShowPatient360(true)}
        />
      )}
      {showMediBot && <MediBotScreen onClose={() => setShowMediBot(false)} />}
      {showVault && <VaultScreen onClose={() => setShowVault(false)} />}
      {showPatient360 && <Patient360Screen onClose={() => setShowPatient360(false)} />}
      {showWearables && <WearablesScreen onClose={() => setShowWearables(false)} />}
    </>
  );
}

export default function App() {
  const { isAuthenticated } = useAuth();
  const [currentTab, setCurrentTab] = useState('home');
  const [showMediBot, setShowMediBot] = useState(false);
  const [showVault, setShowVault] = useState(false);
  const [showPatient360, setShowPatient360] = useState(false);
  const [showWearables, setShowWearables] = useState(false);

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  const screenProps = {
    currentTab, setCurrentTab,
    showMediBot, setShowMediBot,
    showVault, setShowVault,
    showPatient360, setShowPatient360,
    showWearables, setShowWearables,
  };

  // ── When running on a real phone inside Expo, skip the fake frame. ──────────
  // The native Expo shell already provides the status bar, safe area, background.
  // Showing the simulated phone chrome on top of a real phone looks doubled.
  if (isNative) {
    return (
      <div
        className="flex flex-col h-screen overflow-hidden bg-[#f8fafc]"
        style={{ paddingBottom: window.__SAFE_BOTTOM__ || 0 }}
      >
        {/* Minimal tab bar for native mode — full screen content */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <ErrorBoundary>
            <AppScreens {...screenProps} />
          </ErrorBoundary>
        </div>
        <NativeTabBar currentTab={currentTab} setCurrentTab={setCurrentTab}
          onMediBot={() => setShowMediBot(true)}
          onWearables={() => setShowWearables(true)}
        />
      </div>
    );
  }

  // ── Browser / desktop: wrap in the simulated phone frame ───────────────────
  return (
    <MobileShell
      currentTab={currentTab}
      setCurrentTab={setCurrentTab}
      openMediBotModal={() => setShowMediBot(true)}
      openVaultModal={() => setShowVault(true)}
      openPatient360Modal={() => setShowPatient360(true)}
      openPhoneHealthModal={() => setShowWearables(true)}
    >
      <ErrorBoundary>
        <AppScreens {...screenProps} />
      </ErrorBoundary>
    </MobileShell>
  );
}

// ── Minimal tab bar shown when running on a real native phone ─────────────────
function NativeTabBar({ currentTab, setCurrentTab }) {
  const tabs = [
    { id: 'home', label: 'Home', icon: LayoutGrid },
    /*
    { id: 'habits', label: 'Habits', icon: CheckCircle2 },
    { id: 'learn', label: 'Play', icon: PlayCircle },
    { id: 'challenges', label: 'Challenges', icon: Trophy },
    { id: 'rewards', label: 'Store', icon: Star },
    */
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <nav className="flex items-center justify-around bg-white border-t border-slate-100 py-2 px-1 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
      {tabs.map(({ id, label, icon: Icon }) => {
        const active = currentTab === id;
        return (
          <button
            key={id}
            onClick={() => setCurrentTab(id)}
            className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-all ${
              active
                ? 'text-[#00A8D0]'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
            <span className="text-[10px] font-semibold">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
