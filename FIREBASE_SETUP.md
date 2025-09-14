# Firebase Push Notifications Setup

Since local notifications weren't working reliably on Android, we've switched to Firebase Cloud Messaging (FCM) push notifications, which are more reliable across different Android devices and versions.

## Setup Instructions

### 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or "Create a project"
3. Enter your project name (e.g., "your-health-sync")
4. Continue through the setup process

### 2. Add Android App to Firebase

1. In your Firebase project console, click "Add app" and select Android
2. Register your app with these details:
   - **Android package name**: `app.lovable.e16d667b041945ffa9308ba011b44483`
   - **App nickname**: `your-health-sync` (optional)
   - **Debug signing certificate**: Leave blank for now

3. Download the `google-services.json` file
4. Place this file in your project at: `android/app/google-services.json`

### 3. Update Android Configuration

After running `npx cap add android`, you'll need to:

1. **Copy google-services.json**: Place the downloaded file in `android/app/google-services.json`

2. **Update android/build.gradle** (project-level):
```gradle
buildscript {
    dependencies {
        classpath 'com.google.gms:google-services:4.4.0'
        // ... other dependencies
    }
}
```

3. **Update android/app/build.gradle** (app-level):
Add at the top:
```gradle
apply plugin: 'com.google.gms.google-services'
```

Add to dependencies:
```gradle
dependencies {
    implementation 'com.google.firebase:firebase-messaging:23.4.0'
    // ... other dependencies
}
```

### 4. Server-Side Setup (Optional)

For scheduled notifications, you'll need a backend service that can:
1. Store FCM tokens from your app
2. Schedule notifications using Firebase Admin SDK
3. Send notifications at the specified times

You can use Supabase Edge Functions for this or any Node.js/Python backend.

### 5. Test the Setup

1. Run `npm run build`
2. Run `npx cap sync`
3. Run `npx cap run android`
4. Check console logs for FCM registration token
5. Test creating a routine with reminders

## How It Works Now

- **Registration**: App registers with FCM and gets a token
- **Scheduling**: When you create routines, the app logs the notification details (ready for server implementation)
- **Delivery**: Firebase handles reliable delivery to the device
- **Background**: Works even when app is closed (unlike local notifications)

## Next Steps

1. Follow the setup instructions above
2. For production use, implement a backend service to actually send the scheduled notifications
3. Consider adding notification categories and custom sounds
4. Add notification analytics and delivery tracking

## Benefits Over Local Notifications

- ✅ More reliable on Android
- ✅ Works across all Android versions and OEMs
- ✅ Better battery optimization
- ✅ Can send from server even when app is closed
- ✅ Rich notification features (images, actions, etc.)
