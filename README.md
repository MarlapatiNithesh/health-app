# Wellness & MediBot Health Platform

A comprehensive health, wearable, and clinical AI platform consisting of:
- **Backend API**: Node.js (v20+) + Express + PostgreSQL with Swagger docs and clinical MediBot AI engine.
- **Mobile Web App (`mobile-app`)**: React + Vite + Tailwind CSS with a phone simulator frame and responsive UI.
- **Native Mobile App (`expo-mobile`)**: React Native + Expo shell with native HealthKit, BLE, and sensor integrations.

---

## 📋 Prerequisites

Before starting, ensure you have the following installed:
1. **Node.js**: Version `20.x` or higher (`node -v`)
2. **npm**: Version `10.x` or higher (`npm -v`)
3. **Docker Desktop**: For running the PostgreSQL database (or have a local PostgreSQL 16 instance)
4. *(Optional for Native Mobile testing)*: **Expo Go** app on your iOS or Android phone, or Android Studio / Xcode for emulators.

---

## 🛠️ Step 1: Initial Installation

Open a terminal in the project root directory (`health (2)`):

```bash
# 1. Install root dependencies (Backend)
npm install

# 2. Install web mobile app dependencies
npm --prefix mobile-app install

# 3. Install Expo native mobile dependencies
npm --prefix expo-mobile install
```

---

## 🗄️ Step 2: Configure Environment & Database

### 1. Environment File
Ensure you have a `.env` file in the root directory. If not present, copy from `.env.example`:
```bash
cp .env.example .env
```
*(On Windows PowerShell: `Copy-Item .env.example .env`)*

Verify your `.env` contains the default local database URL:
```env
PORT=4000
DATABASE_URL=postgres://wellness_app:wellness_app@127.0.0.1:5433/wellness_db
JWT_SECRET=c2VjdXJlLXdlbGxuZXNzLWFwcC1qd3Qtc2VjcmV0LWtleS0yMDI2
ALLOW_DEV_OTP=true
DEV_OTP_CODE=123456
```

### 2. Start PostgreSQL Database
Start the PostgreSQL container defined in `docker-compose.yml`:
```bash
docker compose up -d
```
> **Note**: This spins up PostgreSQL on port `5433` (mapped to `5432` internally) with credentials `wellness_app / wellness_app` and database `wellness_db`.

### 3. Run Database Migrations
Create all the necessary tables and clinical schemas:
```bash
npm run db:migrate
```

---

## 🚀 Step 3: Run the Backend API

Start the backend server in development mode (with auto-reload):
```bash
npm run dev
```

- **Backend API URL**: [http://localhost:4000](http://localhost:4000)
- **Interactive Swagger Docs**: [http://localhost:4000/docs](http://localhost:4000/docs)
- **Health Check**: [http://localhost:4000/medibot/status](http://localhost:4000/medibot/status)

Keep this terminal running!

---

## 📱 Step 4: Run the Mobile App

You have **two ways** to run and test the mobile application:

### Option A: Web Browser / Simulator Mode (Fastest & Recommended for Development)

This runs the React + Vite frontend with live Hot-Module-Replacement (HMR) and an interactive iPhone simulator frame:

1. Open a new terminal in the project root:
   ```bash
   npm run mobile
   ```
   *(Or navigate into `mobile-app` and run: `npm run dev`)*

2. Open your browser at:
   👉 **[http://localhost:5173](http://localhost:5173)**

---

### Option B: Native Mobile App via Expo (Android & iOS)

This runs the React Native / Expo shell that connects to native device sensors, HealthKit, and BLE:

1. **Build the web bundle first** (so the backend can serve it at `/app/`):
   ```bash
   npm run build:mobile
   ```

2. **Ensure your Backend is running** in another terminal:
   ```bash
   npm run dev
   ```

3. **Start Expo**:
   ```bash
   npm run expo
   ```
   > 💡 *This script automatically detects your machine's local Wi-Fi IP (via `scripts/sync-dev-ip.js`) and updates `expo-mobile/.env` so your physical phone or emulator can communicate with the backend.*

4. **Launch on your device**:
   - **Android Emulator**: Press `a` in the terminal (or run `npm run expo:android`)
   - **iOS Simulator** *(macOS only)*: Press `i` in the terminal (or run `npm run expo:ios`)
   - **Physical Phone**: Open the **Expo Go** app and scan the QR code displayed in the terminal.
     *(Ensure your phone and PC are connected to the exact same Wi-Fi network)*.

---

## 🔑 Login & Demo Test Credentials

When opening the mobile app:
1. Enter any test mobile phone number (e.g. `+91 9876543210` or `+1 555-010-9999`).
2. Tap **Send OTP**.
3. Enter the development bypass OTP code:
   ```
   123456
   ```
4. You will be authenticated immediately with full access to the member dashboard, habit trackers, clinical MediBot chat, and health vitals.

---

## 📜 All Available NPM Scripts

From the root directory, you can run:

| Command | Description |
|---|---|
| `npm run dev` | Starts the Backend API server with watch mode (`http://localhost:4000`) |
| `npm run start` | Starts the Backend API server in production mode |
| `npm run db:migrate` | Runs all Flyway-style SQL migrations from `db/ddl/` |
| `npm run mobile` | Starts Vite dev server for web mobile app (`http://localhost:5173`) |
| `npm run build:mobile` | Compiles the web mobile app into `mobile-app/dist` |
| `npm run expo` | Syncs local IP and starts the Expo / React Native bundler |
| `npm run expo:android` | Syncs local IP and launches Android build on emulator/device |
| `npm run expo:ios` | Syncs local IP and launches iOS build on simulator |
| `npm run expo:web` | Starts Expo dev server in web mode |

---

## ❓ Troubleshooting

- **Database connection error (`ECONNREFUSED 127.0.0.1:5433`)**:
  - Run `docker ps` to verify the PostgreSQL container is running.
  - If stopped, run `docker compose up -d`.
  - Check that port `5433` in your `.env` matches the `5433:5432` port mapping in `docker-compose.yml`.

- **Mobile app shows blank screen or network error in Expo**:
  - Confirm the backend server is running (`npm run dev`).
  - Make sure you ran `npm run build:mobile` so that `http://<your-ip>:4000/app/` exists.
  - Ensure Windows Defender / Firewall allows inbound traffic on port `4000`.
  - Ensure your phone and development computer are on the same local Wi-Fi subnet.

- **Port 4000 is already in use**:
  - Stop any existing node process listening on 4000:
    ```powershell
    # Windows PowerShell:
    Get-Process -Id (Get-NetTCPConnection -LocalPort 4000).OwningProcess | Stop-Process -Force
    ```
