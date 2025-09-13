# Updating Your Android App - Step by Step Guide

Once you've made changes to your Health Sync app in Lovable, follow these steps to update your Android APK:

## 🔄 Quick Update Process

### 1. Export Latest Changes
1. Click **"Export to Github"** button in Lovable to push your latest changes
2. Navigate to your local project directory:
   ```bash
   cd <your-project-name>
   ```

### 2. Pull Latest Changes
```bash
git pull origin main
```

### 3. Install Any New Dependencies
```bash
npm install
```

### 4. Build Updated Web App
```bash
npm run build
```

### 5. Sync Changes to Android
```bash
npx cap sync android
```

### 6. Build New APK

#### Option A: Debug APK (Quick for Testing)
```bash
cd android
./gradlew assembleDebug
```
**Output location**: `android/app/build/outputs/apk/debug/app-debug.apk`

#### Option B: Release APK (For Distribution)
```bash
npx cap open android
```
Then in Android Studio:
1. **Build** → **Generate Signed Bundle / APK**
2. Choose **APK**
3. Use your existing keystore
4. Select **release** build variant
5. Click **Finish**

**Output location**: `android/app/build/outputs/apk/release/`

## 📱 Installing Updated APK

### On Your Device
1. Uninstall the old version (or use same-signature update)
2. Install new APK:
   ```bash
   adb install app-debug.apk
   ```

### Over-the-Air Update (Same Signature)
If you're using the same keystore, the new APK will update the existing app without losing data.

## 🔧 Troubleshooting Updates

### Clean Build (If Issues Occur)
```bash
# Clean Capacitor cache
npx cap clean android

# Clean Gradle cache
cd android
./gradlew clean

# Rebuild everything
cd ..
npm run build
npx cap sync android
```

### Version Management
Update version in `capacitor.config.ts` for tracking:
```typescript
const config: CapacitorConfig = {
  appId: 'app.lovable.e16d667b041945ffa9308ba011b44483',
  appName: 'your-health-sync',
  webDir: 'dist',
  // Increment version for updates
  version: '1.0.1'
};
```

## ⚠️ Important Notes

- **Data Persistence**: User data is stored in Supabase, so updates won't affect user data
- **Notifications**: Local notifications will need to be rescheduled after major updates
- **Permissions**: New permissions may require user approval on first launch
- **Testing**: Always test on debug APK before building release version

## 🚀 Automation Tips

Create a simple update script `update-android.sh`:
```bash
#!/bin/bash
echo "🔄 Updating Android app..."
git pull origin main
npm install
npm run build
npx cap sync android
cd android
./gradlew assembleDebug
echo "✅ Updated APK ready at: android/app/build/outputs/apk/debug/"
```

Make it executable: `chmod +x update-android.sh`

Run updates with: `./update-android.sh`

## 📖 Related Guides
- [Initial Android Setup](./ANDROID_APK_GUIDE.md)
- [Mobile Development Setup](./MOBILE_SETUP.md)