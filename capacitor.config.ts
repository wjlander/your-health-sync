import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.e16d667b041945ffa9308ba011b44483',
  appName: 'your-health-sync',
  webDir: 'dist',
  // Comment out server config for production APK builds
  // server: {
  //   url: 'https://e16d667b-0419-45ff-a930-8ba011b44483.lovableproject.com?forceHideBadge=true',
  //   cleartext: true
  // },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    },
    BarcodeScanner: {
      // Enable camera permissions
      "android": {
        "permissions": [
          "CAMERA"
        ]
      }
    }
  }
};

export default config;