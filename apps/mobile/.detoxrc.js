/** Detox configuration. Requires a dev-client build (expo prebuild + eas build). */
module.exports = {
  testRunner: {
    args: { $0: 'jest', config: 'e2e/jest.config.js' },
    jest: { setupTimeout: 180_000 },
  },
  apps: {
    'android.debug': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      build:
        'cd android && gradlew.bat assembleDebug assembleAndroidTest -DtestBuildType=debug && cd ..',
    },
    'ios.debug': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/Hisabche.app',
      build:
        'xcodebuild -workspace ios/Hisabche.xcworkspace -scheme Hisabche -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build',
    },
  },
  devices: {
    emulator: { type: 'android.emulator', device: { avdName: 'Pixel_5_API_34' } },
    simulator: { type: 'ios.simulator', device: { type: 'iPhone 15' } },
  },
  configurations: {
    'android.emu.debug': { device: 'emulator', app: 'android.debug' },
    'ios.sim.debug': { device: 'simulator', app: 'ios.debug' },
  },
}
