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

  // Match any variation of ensureTargetActivityIsAvailable
  const regex = /private fun ensureTargetActivityIsAvailable\(options: ImagePickerOptions\) \{[\s\S]*?\n  \}/;

  const noOpMethod = `private fun ensureTargetActivityIsAvailable(options: ImagePickerOptions) {
    // No-op: bypass resolveActivity check to support Android 11+ and Google Pixel devices
  }`;

  if (regex.test(content)) {
    content = content.replace(regex, noOpMethod);
    fs.writeFileSync(targetFile, content, 'utf8');
    console.log('[patch] Successfully patched expo-image-picker ensureTargetActivityIsAvailable to no-op.');
  }
}
