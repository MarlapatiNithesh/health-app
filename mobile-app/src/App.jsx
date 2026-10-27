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
import { NotificationCenterModal } from './components/screens/NotificationCenterModal';
import { isNative, toNative } from './native/nativeBridge';
import { ErrorBoundary } from './components/common/ErrorBoundary';

// All screen content — shared between native and browser views
function AppScreens({
  currentTab,
  setCurrentTab,
  showMediBot,
  setShowMediBot,
  showVault,
  setShowVault,
  showPatient360,
  setShowPatient360,
  showWearables,
  setShowWearables,
  showNotifications,
  setShowNotifications,
}) {
  return (
    <>
      {currentTab === 'home' && (
        <HomeScreen
          openPhoneHealthModal={() => setShowWearables(true)}
          openPatient360Modal={() => setShowPatient360(true)}
          openMediBotModal={() => setShowMediBot(true)}
          openVaultModal={() => setShowVault(true)}
          openNotificationsModal={() => setShowNotifications(true)}
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
      {showMediBot && (
        <MediBotScreen
          onClose={() => setShowMediBot(false)}
          openNotificationsModal={() => setShowNotifications(true)}
        />
      )}
      {showVault && <VaultScreen onClose={() => setShowVault(false)} />}
      {showPatient360 && <Patient360Screen onClose={() => setShowPatient360(false)} />}
      {showWearables && <WearablesScreen onClose={() => setShowWearables(false)} />}
      <NotificationCenterModal
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
      />
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
  const [showNotifications, setShowNotifications] = useState(false);

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  const screenProps = {
    currentTab, setCurrentTab,
    showMediBot, setShowMediBot,
    showVault, setShowVault,
    showPatient360, setShowPatient360,
    showWearables, setShowWearables,
    showNotifications, setShowNotifications,
  };

  return (
    <MobileShell
      currentTab={currentTab}
      setCurrentTab={setCurrentTab}
      openMediBotModal={() => setShowMediBot(true)}
      openVaultModal={() => setShowVault(true)}
      openPatient360Modal={() => setShowPatient360(true)}
      openPhoneHealthModal={() => setShowWearables(true)}
      openNotificationsModal={() => setShowNotifications(true)}
    >
      <ErrorBoundary>
        <AppScreens {...screenProps} />
      </ErrorBoundary>
    </MobileShell>
  );
}
