import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.greenhouse.pro',
  appName: 'GreenHouse Pro',
  webDir: 'dist',
  
  server: {
    // Railway production URL
    url: 'https://greenhouse-pro-server-production.up.railway.app',
    cleartext: true,
    
    // Allow navigation to the same domain
    allowNavigation: [
      'greenhouse-pro-server-production.up.railway.app'
    ],
  },

  android: {
    // Android-specific settings
    buildOptions: {
      keystorePath: undefined,
      keystorePassword: undefined,
      keystoreAlias: undefined,
      keystoreAliasPassword: undefined,
      releaseType: 'APK',
    },
    
    // Permissions
    appendUserAgent: 'GreenHousePro/5.0',
  },

  ios: {
    // iOS-specific settings
    contentInset: 'automatic',
    appendUserAgent: 'GreenHousePro/5.0',
  },

  plugins: {
    // Splash Screen configuration
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#22c55e', // Green theme color
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      androidSpinnerStyle: 'large',
      iosSpinnerStyle: 'small',
      spinnerColor: '#ffffff',
    },

    // Status Bar configuration
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#22c55e',
    },

    // Keyboard configuration
    Keyboard: {
      resize: 'body',
      style: 'DARK',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
