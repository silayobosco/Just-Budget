const fs = require('fs');
const path = require('path');

const targetFile = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-image-picker',
  'android',
  'src',
  'main',
  'java',
  'expo',
  'modules',
  'imagepicker',
  'ImagePickerModule.kt'
);

if (fs.existsSync(targetFile)) {
  let content = fs.readFileSync(targetFile, 'utf8');

  const oldCode = `  private fun ensureTargetActivityIsAvailable(options: ImagePickerOptions) {
    val cameraIntent = Intent(options.nativeMediaTypes.toCameraIntentAction())
    if (cameraIntent.resolveActivity(appContext.throwingActivity.application.packageManager) == null) {
      throw MissingActivityToHandleIntent(cameraIntent.type)
    }
  }`;

  const newCode = `  private fun ensureTargetActivityIsAvailable(options: ImagePickerOptions) {
    try {
      val pm = appContext.throwingActivity.application.packageManager
      if (!pm.hasSystemFeature(android.content.pm.PackageManager.FEATURE_CAMERA_ANY)) {
        throw MissingActivityToHandleIntent(options.nativeMediaTypes.toCameraIntentAction())
      }
    } catch (e: MissingActivityToHandleIntent) {
      throw e
    } catch (_: Throwable) {
      // Allow ActivityResultLauncher to dispatch intent directly on modern Android
    }
  }`;

  if (content.includes(oldCode)) {
    content = content.replace(oldCode, newCode);
    fs.writeFileSync(targetFile, content, 'utf8');
    console.log('[patch] Successfully patched expo-image-picker for Android 11+ camera resolution.');
  }
}
