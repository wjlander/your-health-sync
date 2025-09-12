# Mobile App Setup with Capacitor

Your Health Sync app is now configured as a native mobile app with local notification capabilities!

## 🔔 Mobile Notification Features

- **Medication Reminders**: Get notifications for your medication routines
- **Health Tracking Alerts**: Reminders for weight tracking, exercise, etc.
- **Task Notifications**: Mobile alerts for your important tasks
- **Reliable Delivery**: Works offline and respects device notification settings

## 📱 Running on Mobile Devices

### Prerequisites
- Node.js and npm installed
- For iOS: Mac with Xcode
- For Android: Android Studio

### Steps to Run on Your Device

1. **Export & Clone Your Project**
   - Click "Export to Github" button in Lovable
   - Clone the project from your GitHub repository
   - Run `npm install`

2. **Add Mobile Platforms**
   ```bash
   # Add iOS (Mac required)
   npx cap add ios
   
   # Add Android
   npx cap add android
   ```

3. **Update Platform Dependencies**
   ```bash
   # For iOS
   npx cap update ios
   
   # For Android
   npx cap update android
   ```

4. **Build and Sync**
   ```bash
   npm run build
   npx cap sync
   ```

5. **Run on Device/Emulator**
   ```bash
   # For iOS (opens Xcode)
   npx cap run ios
   
   # For Android (opens Android Studio)
   npx cap run android
   ```

## 🔧 Mobile Notification Setup

Once the app is running on your device:

1. **Grant Notification Permissions**: The app will request notification permissions on first launch
2. **Create Routines**: Use the "Routines & Reminders" section to create new routines
3. **Set Reminder Times**: Add specific times when you want to be notified
4. **Tap "Setup Mobile Alerts"**: This schedules all your routine reminders locally on your device

## ⚡ Hot Reload Development

The app is configured for hot reload, so changes in Lovable will automatically appear on your mobile device during development!

## 📖 Learn More

Read our comprehensive guide: https://lovable.dev/blogs/TODO