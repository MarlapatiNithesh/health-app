import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { AuthScreen } from './components/screens/AuthScreen';
import { MobileShell } from './components/layout/MobileShell';
import { HomeScreen } from './components/screens/HomeScreen';
import { RecordsScreen } from './components/screens/RecordsScreen';
import { CareScreen } from './components/screens/CareScreen';
import { VitalsScreen } from './components/screens/VitalsScreen';
import { MediBotScreen } from './components/screens/MediBotScreen';
import { MoreScreen } from './components/screens/MoreScreen';

// All 28 Stitch Dedicated Screens
import LandingScreen from './components/screens/LandingScreen';
import DedicatedSignupScreen from './components/screens/DedicatedSignupScreen';
import CaresyncSignupScreen from './components/screens/CaresyncSignupScreen';
import ForgotPasswordScreen from './components/screens/ForgotPasswordScreen';
import BaselineSetupScreen from './components/screens/BaselineSetupScreen';
import WearableSyncScreen from './components/screens/WearableSyncScreen';
import LaunchTransitionScreen from './components/screens/LaunchTransitionScreen';
import FoodOcrScannerScreen from './components/screens/FoodOcrScannerScreen';
import NutritionDashboardScreen from './components/screens/NutritionDashboardScreen';
import CalorieCounterScreen from './components/screens/CalorieCounterScreen';
import HydrationPacingScreen from './components/screens/HydrationPacingScreen';
import DeviceDiagnosticsScreen from './components/screens/DeviceDiagnosticsScreen';
import GuardianSetupScreen from './components/screens/GuardianSetupScreen';
import PhysicianDossierScreen from './components/screens/PhysicianDossierScreen';
import HealthAnalyticsDossierScreen from './components/screens/HealthAnalyticsDossierScreen';
import ClinicalAlarmsScreen from './components/screens/ClinicalAlarmsScreen';
import ClinicalSecurityScreen from './components/screens/ClinicalSecurityScreen';
import MetabolismScreen from './components/screens/MetabolismScreen';
import EmergencyCrisisScreen from './components/screens/EmergencyCrisisScreen';
import AddMedicineScreen from './components/screens/AddMedicineScreen';
import LogoutScreen from './components/screens/LogoutScreen';
import { ProfileScreen } from './components/screens/ProfileScreen';

// Modals
import { EmergencySosModal } from './components/modals/EmergencySosModal';
import { LogVitalsModal } from './components/modals/LogVitalsModal';
import { OcrScannerModal } from './components/modals/OcrScannerModal';
import { FhirPdfModal } from './components/modals/FhirPdfModal';
import { AddMedicineModal } from './components/modals/AddMedicineModal';
import { LogoutModal } from './components/modals/LogoutModal';
import { NotificationCenterModal } from './components/screens/NotificationCenterModal';
import { HeadsUpNotificationBanner } from './components/notifications/HeadsUpNotificationBanner';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { api } from './services/api';

export default function App() {
  const { isAuthenticated, loginWithToken } = useAuth();
  const [currentTab, setCurrentTab] = useState('today');
  const [activeScreen, setActiveScreen] = useState('landing'); // Starts from LandingScreen per requirement

  // Modals state
  const [showSosModal, setShowSosModal] = useState(false);
  const [showLogVitals, setShowLogVitals] = useState(false);
  const [vitalsType, setVitalsType] = useState('glucose');
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [showAddMedModal, setShowAddMedModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Screen routing handler
  const handleOpenScreen = (screenId) => {
    switch (screenId) {
      case 'home':
      case 'today':
      case 'dashboard':
        if (!isAuthenticated) {
          loginWithToken('demo-jwt-token-fitsure', {
            phone: '+15553829014',
            fullName: 'Anna Martinez',
            wellnessScore: 91,
          });
        }
        setActiveScreen(null);
        setCurrentTab('today');
        break;
      case 'records':
        if (!isAuthenticated) {
          loginWithToken('demo-jwt-token-fitsure', {
            phone: '+15553829014',
            fullName: 'Anna Martinez',
            wellnessScore: 91,
          });
        }
        setActiveScreen(null);
        setCurrentTab('records');
        break;
      case 'care':
        if (!isAuthenticated) {
          loginWithToken('demo-jwt-token-fitsure', {
            phone: '+15553829014',
            fullName: 'Anna Martinez',
            wellnessScore: 91,
          });
        }
        setActiveScreen(null);
        setCurrentTab('care');
        break;
      case 'vitals':
        if (!isAuthenticated) {
          loginWithToken('demo-jwt-token-fitsure', {
            phone: '+15553829014',
            fullName: 'Anna Martinez',
            wellnessScore: 91,
          });
        }
        setActiveScreen(null);
        setCurrentTab('vitals');
        break;
      case 'medibot':
        if (!isAuthenticated) {
          loginWithToken('demo-jwt-token-fitsure', {
            phone: '+15553829014',
            fullName: 'Anna Martinez',
            wellnessScore: 91,
          });
        }
        setActiveScreen(null);
        setCurrentTab('medibot');
        break;
      case 'more':
        if (!isAuthenticated) {
          loginWithToken('demo-jwt-token-fitsure', {
            phone: '+15553829014',
            fullName: 'Anna Martinez',
            wellnessScore: 91,
          });
        }
        setActiveScreen(null);
        setCurrentTab('more');
        break;
      case 'emergency_sos':
      case 'sos':
        setShowSosModal(true);
        break;
      case 'add_medicine_modal':
        setShowAddMedModal(true);
        break;
      case 'logout_modal':
      case 'logout':
        setShowLogoutModal(true);
        break;
      case 'ocr_modal':
        setShowOcrModal(true);
        break;
      case 'pdf_modal':
        setShowPdfModal(true);
        break;
      default:
        setActiveScreen(screenId);
        break;
    }
  };

  const handleOpenLogVitals = (type = 'glucose') => {
    setVitalsType(type);
    setShowLogVitals(true);
  };

  // Render standalone Stitch screens when selected
  const renderActiveScreen = () => {
    switch (activeScreen) {
      case 'landing':
        return (
          <LandingScreen
            onGetStarted={() => setActiveScreen('signup_dedicated')}
            onOpenScreen={handleOpenScreen}
          />
        );
      case 'signup_dedicated':
        return (
          <DedicatedSignupScreen
            onNavigateNext={() => setActiveScreen('baseline_setup')}
            onOpenScreen={handleOpenScreen}
          />
        );
      case 'signup_caresync':
        return (
          <CaresyncSignupScreen
            onNavigateNext={() => setActiveScreen('baseline_setup')}
            onOpenScreen={handleOpenScreen}
          />
        );
      case 'forgot_password':
        return (
          <ForgotPasswordScreen
            onOpenScreen={handleOpenScreen}
          />
        );
      case 'baseline_setup':
        return (
          <BaselineSetupScreen
            onNavigateNext={() => setActiveScreen('wearable_sync')}
            onOpenScreen={handleOpenScreen}
          />
        );
      case 'wearable_sync':
        return (
          <WearableSyncScreen
            onNavigateNext={() => setActiveScreen('launch_transition')}
            onOpenScreen={handleOpenScreen}
          />
        );
      case 'launch_transition':
        return (
          <LaunchTransitionScreen
            onLaunchDashboard={() => {
              setActiveScreen(null);
              setCurrentTab('today');
            }}
            onOpenScreen={handleOpenScreen}
          />
        );
      case 'food_ocr_scanner':
        return (
          <FoodOcrScannerScreen
            onOpenScreen={handleOpenScreen}
            onMealLogged={() => setActiveScreen('nutrition_dashboard')}
          />
        );
      case 'nutrition_dashboard':
        return (
          <NutritionDashboardScreen
            onOpenScreen={handleOpenScreen}
            onOpenScanner={() => setActiveScreen('food_ocr_scanner')}
          />
        );
      case 'calorie_counter':
        return (
          <CalorieCounterScreen
            onOpenScreen={handleOpenScreen}
          />
        );
      case 'hydration_pacing':
        return (
          <HydrationPacingScreen
            onOpenScreen={handleOpenScreen}
            onOpenSos={() => setShowSosModal(true)}
          />
        );
      case 'metabolism':
        return (
          <MetabolismScreen
            onOpenScreen={handleOpenScreen}
          />
        );
      case 'device_diagnostics':
        return (
          <DeviceDiagnosticsScreen
            onOpenScreen={handleOpenScreen}
          />
        );
      case 'guardian_setup':
        return (
          <GuardianSetupScreen
            onOpenScreen={handleOpenScreen}
            onOpenSos={() => setShowSosModal(true)}
          />
        );
      case 'physician_dossier':
        return (
          <PhysicianDossierScreen
            onOpenScreen={handleOpenScreen}
            onOpenSos={() => setShowSosModal(true)}
          />
        );
      case 'health_analytics':
        return (
          <HealthAnalyticsDossierScreen
            onOpenScreen={handleOpenScreen}
          />
        );
      case 'clinical_alarms':
        return (
          <ClinicalAlarmsScreen
            onOpenScreen={handleOpenScreen}
          />
        );
      case 'clinical_security':
        return (
          <ClinicalSecurityScreen
            onOpenScreen={handleOpenScreen}
            onOpenLogout={() => setShowLogoutModal(true)}
          />
        );
      case 'emergency_crisis_screen':
        return (
          <EmergencyCrisisScreen
            onBack={() => setActiveScreen(null)}
            onOpenScreen={handleOpenScreen}
          />
        );
      case 'add_medicine_screen':
        return (
          <AddMedicineScreen
            onBack={() => setActiveScreen(null)}
            onOpenScreen={handleOpenScreen}
            onAddSuccess={() => {
              setActiveScreen(null);
              setCurrentTab('care');
            }}
          />
        );
      case 'logout_screen':
        return (
          <LogoutScreen
            onBack={() => setActiveScreen(null)}
            onOpenScreen={handleOpenScreen}
          />
        );
      case 'profile':
        return (
          <ProfileScreen
            onBack={() => setActiveScreen(null)}
          />
        );
      case 'auth':
        return (
          <AuthScreen
            onOpenScreen={handleOpenScreen}
          />
        );
      default:
        return null;
    }
  };

  return (
    <ErrorBoundary>
      {activeScreen ? (
        activeScreen === 'landing' ? (
          <div className="relative min-h-screen bg-[#f7fee7] flex justify-center items-center select-none">
            <LandingScreen
              onGetStarted={() => setActiveScreen('signup_dedicated')}
              onOpenScreen={handleOpenScreen}
            />
          </div>
        ) : (
          <div className="relative min-h-screen bg-[#ECEEF2] flex justify-center items-start p-0 sm:py-6">
            <div className="w-full max-w-[430px] min-h-screen sm:min-h-0 sm:h-[874px] sm:max-h-[92vh] bg-white border-x border-[#e2e8f0] sm:border-2 sm:border-slate-300 sm:rounded-[36px] shadow-xl flex flex-col overflow-y-auto">
              {renderActiveScreen()}
            </div>
          </div>
        )
      ) : (
        <MobileShell
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          openSosModal={() => setShowSosModal(true)}
          openNotificationsModal={() => setShowNotifications(true)}
        >
          {/* Tab 1: Today */}
          {(currentTab === 'today' || currentTab === 'home') && (
            <HomeScreen
              openLogVitals={handleOpenLogVitals}
              openSosModal={() => setShowSosModal(true)}
              openOcrModal={() => setShowOcrModal(true)}
              openPdfModal={() => setShowPdfModal(true)}
              openNotificationsModal={() => setShowNotifications(true)}
              navigateToTab={(tab) => setCurrentTab(tab)}
              onOpenScreen={handleOpenScreen}
            />
          )}

          {/* Tab 2: Records Vault */}
          {currentTab === 'records' && (
            <RecordsScreen
              openOcrModal={() => setShowOcrModal(true)}
              openPdfModal={() => setShowPdfModal(true)}
              onOpenScreen={handleOpenScreen}
            />
          )}

          {/* Tab 3: Care Plan & Chrono-Rx */}
          {currentTab === 'care' && (
            <CareScreen
              openAddMedModal={() => setShowAddMedModal(true)}
              onOpenScreen={handleOpenScreen}
            />
          )}

          {/* Tab 4: Vitals & Metabolism */}
          {currentTab === 'vitals' && (
            <VitalsScreen
              openLogVitals={handleOpenLogVitals}
              onOpenScreen={handleOpenScreen}
            />
          )}

          {/* Tab 5: Dr. MediBot AI Clinical Specialist */}
          {currentTab === 'medibot' && (
            <MediBotScreen
              openSosModal={() => setShowSosModal(true)}
              openPdfModal={() => setShowPdfModal(true)}
              onOpenScreen={handleOpenScreen}
            />
          )}

          {/* Tab 6: More & Safety */}
          {currentTab === 'more' && (
            <MoreScreen
              openPdfModal={() => setShowPdfModal(true)}
              openLogoutModal={() => setShowLogoutModal(true)}
              onOpenScreen={handleOpenScreen}
            />
          )}

          {/* System Heads-Up Notification Banner */}
          <HeadsUpNotificationBanner
            onOpenNotificationCenter={() => setShowNotifications(true)}
            onActionClick={async (notif, label) => {
              try {
                await api.executeNotificationAction?.(notif.id, label);
              } catch (e) {
                console.warn('Action error:', e);
              }
            }}
          />
        </MobileShell>
      )}

      {/* Global Modals */}
      <EmergencySosModal
        isOpen={showSosModal}
        onClose={() => setShowSosModal(false)}
      />

      <LogVitalsModal
        isOpen={showLogVitals}
        initialType={vitalsType}
        onClose={() => setShowLogVitals(false)}
      />

      <OcrScannerModal
        isOpen={showOcrModal}
        onClose={() => setShowOcrModal(false)}
        onImportSuccess={() => setCurrentTab('care')}
      />

      <FhirPdfModal
        isOpen={showPdfModal}
        onClose={() => setShowPdfModal(false)}
      />

      <AddMedicineModal
        isOpen={showAddMedModal}
        onClose={() => setShowAddMedModal(false)}
        onAddSuccess={() => setCurrentTab('care')}
      />

      <LogoutModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
      />

      <NotificationCenterModal
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
      />
    </ErrorBoundary>
  );
}
