package com.suman334.rear
import expo.modules.splashscreen.SplashScreenManager

import android.content.Intent
import android.net.Uri
import android.util.Log
import java.io.File
import java.io.FileOutputStream
import java.io.InputStream
import java.io.OutputStream
import android.nfc.NdefMessage
import android.nfc.NfcAdapter
import android.os.Build
import android.os.Bundle

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    // Set the theme to AppTheme BEFORE onCreate to support
    // coloring the background, status bar, and navigation bar.
    // This is required for expo-splash-screen.
    // setTheme(R.style.AppTheme);
    // @generated begin expo-splashscreen - expo prebuild (DO NOT MODIFY) sync-f3ff59a738c56c9a6119210cb55f0b613eb8b6af
    SplashScreenManager.registerOnActivity(this)
    // @generated end expo-splashscreen
    // If launched via an external VIEW intent for a video content URI, try to
    // copy it into our app cache synchronously and replace the Intent data with
    // a file:// URI. This prevents other apps (music players) from briefly
    // taking over while we initialize.
    try {
      handleExternalViewIntent(intent)
    } catch (e: Exception) {
      Log.w("MainActivity", "handleExternalViewIntent failed", e)
    }

    super.onCreate(null)

    // Handle NFC intent if app was launched from NFC
    handleNfcIntent(intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    // Handle NFC intent when app is already running
    setIntent(intent)
    // Also attempt to handle external VIEW intents when received while running
    try {
      handleExternalViewIntent(intent)
    } catch (e: Exception) {
      Log.w("MainActivity", "handleExternalViewIntent onNewIntent failed", e)
    }
    handleNfcIntent(intent)
  }
  
  private fun handleNfcIntent(intent: Intent?) {
    if (intent == null) return
    
    // Check if this is an NFC-related action
    val action = intent.action
    if (action == NfcAdapter.ACTION_NDEF_DISCOVERED || 
        action == NfcAdapter.ACTION_TAG_DISCOVERED ||
        action == NfcAdapter.ACTION_TECH_DISCOVERED) {
      
      // Get the NDEF messages from the intent
      val rawMessages = intent.getParcelableArrayExtra(NfcAdapter.EXTRA_NDEF_MESSAGES)
      if (rawMessages != null && rawMessages.isNotEmpty()) {
        // Process the first NDEF message
        val ndefMessage = rawMessages[0] as? NdefMessage
        if (ndefMessage != null) {
          // The NFC library (react-native-nfc-manager) will handle the actual processing
          // We just need to ensure the intent is passed to React Native
          // This is automatically handled by the library's native module
        }
      }
      
      // Also check for deep link URI
      val data = intent.data
      if (data != null && data.scheme == "beatit" && data.host == "nfc") {
        // Deep link will be handled by React Native Linking
        // No additional processing needed here
      }
    }
  }

  private fun handleExternalViewIntent(intent: Intent?) {
    if (intent == null) return
    val action = intent.action
    if (action != Intent.ACTION_VIEW) return

    val data: Uri? = intent.data
    if (data == null) return

    // Only handle content/file schemes for video mime types
    val scheme = data.scheme
    if (scheme != "content" && scheme != "file") return

    val type = contentResolver.getType(data) ?: ""
    if (!type.startsWith("video")) return

    try {
      // Copy content URI into app cache synchronously
      val filename = data.lastPathSegment ?: "external_video_${System.currentTimeMillis()}"
      val outFile = File(cacheDir, filename)

      var `in`: InputStream? = null
      var out: OutputStream? = null
      try {
        `in` = contentResolver.openInputStream(data)
        if (`in` == null) return
        out = FileOutputStream(outFile)
        val buf = ByteArray(8192)
        var len: Int
        while (`in`.read(buf).also { len = it } != -1) {
          out.write(buf, 0, len)
        }
        out.flush()
      } finally {
        try { `in`?.close() } catch (_: Exception) {}
        try { out?.close() } catch (_: Exception) {}
      }

      // Replace the intent data with a file:// URI pointing to our cached copy
      val fileUri = Uri.fromFile(outFile)
      intent.data = fileUri
      // Also set the data on the activity so React's Linking.getInitialURL sees it
      setIntent(intent)
      Log.i("MainActivity", "Replaced external VIEW intent data with cached file: ${fileUri}")
    } catch (e: Exception) {
      Log.w("MainActivity", "Failed to copy external view content to cache", e)
    }
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "main"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
          this,
          BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
          object : DefaultReactActivityDelegate(
              this,
              mainComponentName,
              fabricEnabled
          ){})
  }

  /**
    * Align the back button behavior with Android S
    * where moving root activities to background instead of finishing activities.
    * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
    */
  override fun invokeDefaultOnBackPressed() {
      if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
          if (!moveTaskToBack(false)) {
              // For non-root activities, use the default implementation to finish them.
              super.invokeDefaultOnBackPressed()
          }
          return
      }

      // Use the default back button implementation on Android S
      // because it's doing more than [Activity.moveTaskToBack] in fact.
      super.invokeDefaultOnBackPressed()
  }
}
