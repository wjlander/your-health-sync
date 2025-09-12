# Creating Android APK - Step by Step Guide

I cannot directly create APK files from this environment, but I can guide you through the process! Follow these steps:

## 📋 Prerequisites
- Android Studio installed on your computer
- Node.js and npm installed
- Git installed

## 🚀 Step-by-Step Process

### 1. Export & Clone Your Project
1. Click the **"Export to Github"** button in Lovable
2. Clone your project from GitHub:
   ```bash
   git clone <your-repo-url>
   cd <your-project-name>
   ```

### 2. Install Dependencies
```bash
npm install
```

### 3. Add Android Platform
```bash
npx cap add android
```

### 4. Update Dependencies
```bash
npx cap update android
```

### 5. Build Your Web App
```bash
npm run build
```

### 6. Sync with Capacitor
```bash
npx cap sync android
```

### 7. Open in Android Studio
```bash
npx cap open android
```

### 8. Generate APK in Android Studio
1. In Android Studio menu: **Build** → **Generate Signed Bundle / APK**
2. Choose **APK**
3. Create a new keystore or use existing one
4. Select **release** build variant
5. Click **Finish**

The APK will be generated in: `android/app/build/outputs/apk/release/`

## 🔧 Alternative: Debug APK (Faster)
For testing purposes, you can generate a debug APK:

```bash
cd android
./gradlew assembleDebug
```

Debug APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

## 📱 Installing on Device
1. Enable **Developer Options** on your Android device
2. Enable **USB Debugging**
3. Connect device via USB
4. Run: `adb install app-debug.apk`

## ⚠️ Important Notes
- Debug APKs work for testing but shouldn't be distributed
- For production, always use signed release APKs
- The app requires internet connection for Supabase backend features
- Notifications will work offline once scheduled

## 🆘 Troubleshooting
- If build fails, try `npx cap clean android` then repeat steps 5-6
- Ensure Android SDK is properly installed
- Check that Java 8+ is installed and configured