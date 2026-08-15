/// App-wide constants.
///
/// Override with:
/// `--dart-define=MANIFEST_URL=...`
/// `--dart-define=MANIFEST_PUBLIC_KEY_B64=...`
/// `--dart-define=EDITOR_URL=http://localhost:8080`
class AppConfig {
  static const appName = 'Makhzan';
  static const packageId = 'com.makhzan';
  static const editorUrl = String.fromEnvironment(
    'EDITOR_URL',
    defaultValue: 'https://makhzan-suhael-farouk-s-projects.vercel.app',
  );
  static const editorHandoffUrl = '$editorUrl/?from=makhzan';

  /// Signed latest manifest on R2 (or local/dev override).
  static const manifestUrl = String.fromEnvironment(
    'MANIFEST_URL',
    defaultValue:
        'https://pub-8d441e2513ab4ce1b9addc23585efed2.r2.dev/models/makhzan/manifest-latest.json',
  );

  static const sampleRate = 16000;
  static const maxRecordingSeconds = 120;
  static const downloadTaskGroup = 'makhzan';
}
