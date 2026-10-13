# Wellness & MediBot Mobile Application

An enterprise-grade cross-platform React / React Native style health and clinical AI mobile application, modeled after the **GOQii & Liva** corporate health experience and pixel-perfect to the reference designs.

Powered by the **Wellness & MediBot Clinical Health AI Platform API** running on `http://localhost:4000`.

---

## 🚀 Quick Start

The app is located in the `mobile-app/` directory within this repository.

### 1. Ensure Backend is Running
The Node.js/PostgreSQL backend runs on port 4000:
```bash
# In repository root
npm run dev
# Backend available at http://localhost:4000 (Swagger docs at http://localhost:4000/docs)
```

### 2. Run the Mobile App
```bash
cd mobile-app
npm run dev
# Mobile app available at http://localhost:5173
```

---

## 📱 UI & Screen Design (Matching Uploaded Screenshots)

| Screen | Reference Image | Key Components |
|---|---|---|
| **Home (Top)** | **Image 3** | "Good Evening Test", Liva Points Badge (`★ 1,450`), Bell with notification badge, **Hero Health Score (82/100)** with circular progress gauge, STEPS (`0 / 10,000`), CALORIES (`0 kcal / 2,200`), **Sleep Analysis** (`0h Total Sleep`, `0% Quality`, Deep/Light/REM/Awake pills), Vitals. |
| **Home (Scrolled)** | **Image 2** | ACTIVE MIN (`0 min`), BODY TEMP (`0.0 °C`), **Weekly Steps 7-day bar chart** (Mon-Sun with values 8.4k, 6.2k, 9.9k, 7.3k, 10.2k, 11.6k, 7.8k; today highlighted in deep cyan), **Hydration Tracker** (`0.0L / 2.5L` with 8 clickable droplet icons), **Connect Your Wearable** purple-to-blue gradient banner. |
| **Healthy Habits** | **Image 4** | "Today's Progress (1 of 8 completed)" with progress bar, **Best Streak Flame Box (`🔥 12`)**, **Daily Reminders Active banner** (`You will get nudges for each habit at the scheduled time` with gear icon), Category filter pills (`All`, `Exercise`, `Nutrition`, `Mind`, `Sleep`), Habit list with circular checkboxes, strike-through text on completion, confetti celebration, and Custom Habit creator. |
| **Challenges** | **Image 1** | Cyan-to-purple gradient stats card (**3 Active, 2 Available, 1450 Points at Stake**), Filter tabs (`All`, `My Challenges`, `Available`), **10K Steps Challenge** (Company Wellness Program, `Joined` badge, `52%` progress, 234 participants, 0 days left, 500 Liva Points), **Sleep Well February** (`Joined` badge, `18%` progress, 189 participants, 350 Liva Points), Corporate Leaderboard teaser. |
| **Learn** | Tab 3 | Doctor masterclasses, audio guides, circadian biology & sleep architecture, Zone 2 cardio, glucose pacing articles. |
| **Rewards** | Tab 5 | Liva Points store (`1,450 Available Balance`), partner voucher redemptions (PharmEasy diagnostics, Cult.fit passes, Apple Watch accessories). |
| **Member Profile** | Tab 6 | Demographics, Biometrics (Height, Weight, BMI), weight progress trajectory, HIPAA/GDPR clinical consent toggles, and right-to-be-forgotten account deletion. |

---

## 🤖 Integrated Backend Endpoints

Every single REST endpoint from the Swagger specification is fully integrated:

### 1. Phone Authentication
- `POST /phone/send-otp`: Issues 6-digit SMS verification code with rate limiting and E.164 phone validation.
- `POST /phone/verify-otp`: Validates SMS OTP code (with `123456` dev bypass enabled), creates member profile, and issues JWT bearer session.

### 2. Member Profile & Health
- `GET /v1/me/profile`: Fetches member demographics and biometrics.
- `PATCH /v1/me/profile`: Updates name, DOB, sex, height, and weight with audit logging.
- `GET /v1/me/daily-summary`: Retrieves daily steps, active energy, heart rate, and sleep duration.
- `GET /v1/me/profile/history`: Chronological audit log of biometric revisions.
- `GET /v1/me/profile/weight-progress`: BMI trajectory, baseline comparisons, and target progress.
- `POST /v1/me/consents`: Stores member privacy and health data acceptance.
- `GET & PUT /v1/me/phone-health/connection`: Apple Health and Android Health Connect sync configuration.
- `POST /v1/me/phone-health/sync`: Batch ingestion of steps, heart rate, and sleep telemetry.
- `DELETE /v1/me`: GDPR/CCPA right-to-be-forgotten erasure and session termination.

### 3. Clinical Consents
- `POST /medibot/consents`: Sets global patient clinical AI consent.
- `POST & GET /medibot/consents/{scope}`: Scoped clinical consents (`data_access`, `ai_processing`, `document_upload`, `wearable_sync`).

### 4. Clinical Documents & OCR Vault
- `POST /medibot/documents`: S3 vault document upload with Gzip compression and OCR entity extraction.
- `GET /medibot/documents`: Lists uploaded clinical records.
- `GET /medibot/documents/{id}`: Document details and extracted medical entities (medication names, confidence scores).
- `POST /medibot/documents/{id}/commit`: Atomically commits confirmed OCR extracted entities directly to patient medical chart.

### 5. Clinical Encounters
- `POST /medibot/encounters`: Initializes clinical consultation session.
- `GET /medibot/encounters`: Lists consultation sessions and assessments.
- `POST /medibot/encounters/{id}/messages`: Appends patient/clinician messages to encounter transcript.
- `PUT /medibot/encounters/{id}/status`: Transitions encounter status (`in_progress`, `complete`, `high_risk`).
- `GET & PUT /medibot/encounters/{id}/symptom-state`: Evaluated symptom tracker, onset, and red-flag indicators.

### 6. MediBot AI Clinical Services
- `POST /medibot/chat`: Sub-millisecond red-flag emergency screening followed by clinical conversational guidance. Displays urgency level, screening latency, and emergency callouts.
- `POST /medibot/rag`: Clinical semantic vector retrieval searching patient longitudinal records.
- `POST /medibot/rules/validate`: Deterministic drug safety checker against patient allergies and chronic conditions.
- `GET /medibot/status`: Health of AI triage engine, vector store, and caching layers.

### 7. Patient 360 & Longitudinal Records
- `GET /medibot/patients/{patientId}`: Comprehensive medical chart aggregation.
- `PUT /medibot/patients/{patientId}`: Clinical profile, emergency contacts, preferences, and lifestyle.
- `GET & POST /medibot/patients/{patientId}/conditions`: ICD-10 clinical diagnoses.
- `GET & POST /medibot/patients/{patientId}/medications`: Active drug prescriptions, dosages, and dosing schedules.
- `GET & POST /medibot/patients/{patientId}/allergies`: Documented allergen sensitivities and severity.
- `GET & POST /medibot/patients/{patientId}/labs`: Quantitative lab panels and reference ranges.
- `GET /medibot/patients/{patientId}/timeline`: Unified longitudinal clinical timeline.

### 8. Wearables & Devices
- `POST /wearables/connect-session`: OpenWearables OAuth authorization session.
- `GET & DELETE /wearables/connections`: Manages third-party wearable provider accounts.
- `POST /wearables/connections/{provider}/sync`: On-demand background synchronization.
- `GET & POST /wearables/devices`: Lists and registers paired hardware rings, bands, and smartwatches.
- `PATCH & DELETE /wearables/devices/{deviceId}`: Modifies settings or unpairs devices.
- `POST /wearables/devices/{deviceId}/sync`: Telemetry sync trigger.
- `GET /wearables/providers`: Supported hardware brands (Apple, Oura, Whoop, Fitbit, Garmin).
- `GET /wearables/sleep`: Sleep stages (deep, REM, light) and efficiency scores.
- `GET /wearables/timeseries`: Granular heart rate, HRV, SpO2, and skin temperature.
- `GET /wearables/workouts`: Recorded workouts and calorie burns.

---

## 🎨 Design Highlights
- **Phone Simulator Frame**: Interactive iPhone 15 Pro frame with Dynamic Island, iOS status bar, volume toggles, and responsive full-screen switch.
- **Glassmorphism & Rich Gradients**: Tailored gradients matching the GOQii / Liva health aesthetics.
- **Celebration Effects**: Integrated micro-animations and confetti for completed daily habits and challenges.
- **Offline & Dev Convenience**: Built-in dev autofill (`123456`) and demo phone numbers for rapid local testing without SMS rate limits.
