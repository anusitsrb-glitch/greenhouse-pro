import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.greenhouse.pro',
  appName: 'GreenHouse Pro',
  webDir: 'dist',

  android: {
    buildOptions: {
      releaseType: 'APK',
    },
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#22c55e',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#22c55e',
    },
  },
};

export default config;