import type { CapacitorConfig } from '@capacitor/cli';

// The app wraps the built website (dist/). Change appId before the first store upload: it cannot be changed afterwards.
const config: CapacitorConfig = {
  appId: 'com.wastelandmaps.app',
  appName: 'WastelandMaps',
  webDir: 'dist',
  backgroundColor: '#000a04',
  server: {
    // Android serves the pages from https://localhost; iOS from capacitor://localhost (both are allowed by the server's CORS list)
    androidScheme: 'https',
  },
  ios: {
    contentInset: 'never',
    backgroundColor: '#000a04',
  },
  android: {
    backgroundColor: '#000a04',
    // keeps position updates coming after five minutes in the background (needed by background discovery)
    useLegacyBridge: true,
  },
  plugins: {
    // web requests go through the phone's own networking: Android throttles the web view's requests after five minutes in the background, and the
    // discoveries found while the phone is in a pocket have to reach the server
    CapacitorHttp: { enabled: true },
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#000a04',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#000a04',
    },
    LocalNotifications: {
      iconColor: '#3dff8a',
    },
  },
};

export default config;
