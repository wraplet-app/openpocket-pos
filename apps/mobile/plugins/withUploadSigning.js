const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Adds a dedicated `upload` signing config to android/app/build.gradle and
 * points the release build at it when the OPENPOCKET_UPLOAD_* gradle properties
 * are set (keep those in ~/.gradle/gradle.properties, never in the repo). Falls
 * back to the debug key for local/dev builds that don't set them.
 *
 * Why a plugin: `expo prebuild --clean` regenerates android/ from the template
 * and would otherwise drop the release signing setup every time (this is how the
 * original upload key was lost). The plugin re-applies it on every prebuild.
 *
 * ponytail: exact-string patches against the stock Expo/RN template. If the
 * template ever changes those lines, the patch no-ops and the release build
 * falls back to the debug key — which Play rejects loudly (wrong key), so it
 * surfaces rather than shipping a mis-signed bundle silently.
 */
const DEBUG_BLOCK = `        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }`;

const UPLOAD_BLOCK = `
        upload {
            if (project.hasProperty('OPENPOCKET_UPLOAD_STORE_FILE')) {
                storeFile file(OPENPOCKET_UPLOAD_STORE_FILE)
                storePassword OPENPOCKET_UPLOAD_STORE_PASSWORD
                keyAlias OPENPOCKET_UPLOAD_KEY_ALIAS
                keyPassword OPENPOCKET_UPLOAD_KEY_PASSWORD
            }
        }`;

const RELEASE_DEBUG = `            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig = signingConfigs.debug`;

const RELEASE_UPLOAD = `            // Signed with the OpenPocket upload keystore when its gradle
            // properties are set; falls back to the debug key for local/dev builds.
            signingConfig = project.hasProperty('OPENPOCKET_UPLOAD_STORE_FILE') ? signingConfigs.upload : signingConfigs.debug`;

module.exports = function withUploadSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents;
    if (!gradle.includes('OPENPOCKET_UPLOAD_STORE_FILE')) {
      if (gradle.includes(DEBUG_BLOCK)) gradle = gradle.replace(DEBUG_BLOCK, DEBUG_BLOCK + UPLOAD_BLOCK);
      if (gradle.includes(RELEASE_DEBUG)) gradle = gradle.replace(RELEASE_DEBUG, RELEASE_UPLOAD);
      cfg.modResults.contents = gradle;
    }
    return cfg;
  });
};
