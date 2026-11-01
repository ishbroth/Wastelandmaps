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
  },
  plugins: {
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
