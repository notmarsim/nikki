const config = {
  appId: "app.nikki.productivity",
  appName: "Nikki",
  webDir: "mobile-shell",
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#09090b",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#09090b",
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
  },
};

export default config;
