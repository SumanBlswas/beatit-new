package com.suman334.rear;

import android.media.audiofx.Equalizer;
import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;

import java.util.Locale;

public class EqualizerModule extends ReactContextBaseJavaModule {
  private static final String TAG = "EqualizerModule";
  private Equalizer equalizer = null;
  private final ReactApplicationContext reactContext;

  public EqualizerModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.reactContext = reactContext;
  }

  @Override
  public String getName() {
    return "EqualizerModule";
  }

  @ReactMethod
  public void init(int sessionId, Promise promise) {
    try {
      if (equalizer != null) {
        equalizer.release();
        equalizer = null;
      }
      equalizer = new Equalizer(0, sessionId);
      equalizer.setEnabled(true);
      promise.resolve(true);
    } catch (Exception e) {
      Log.w(TAG, "init failed", e);
      promise.reject("EQUALIZER_INIT", e.getMessage());
    }
  }

  @ReactMethod
  public void setGains(ReadableArray gains, Promise promise) {
    try {
      if (equalizer == null) {
        promise.reject("EQUALIZER_NOT_INITIALIZED", "Equalizer not initialized");
        return;
      }

      short bands = equalizer.getNumberOfBands();
      short[] range = equalizer.getBandLevelRange();
      short min = range[0];
      short max = range[1];

      int count = Math.min(bands, (short) gains.size());
      for (short i = 0; i < count; i++) {
        double db = 0.0;
        try {
          db = gains.getDouble(i);
        } catch (Exception ex) {
          try { db = gains.getInt(i); } catch (Exception ex2) { db = 0.0; }
        }
        short level = (short) Math.round(db * 100.0); // dB to millibels
        if (level < min) level = min;
        if (level > max) level = max;
        equalizer.setBandLevel(i, level);
      }

      promise.resolve(true);
    } catch (Exception e) {
      Log.w(TAG, "setGains failed", e);
      promise.reject("EQUALIZER_SETRANGE", e.getMessage());
    }
  }

  @ReactMethod
  public void setEnabled(boolean enabled, Promise promise) {
    try {
      if (equalizer == null) {
        promise.reject("EQUALIZER_NOT_INITIALIZED", "Equalizer not initialized");
        return;
      }
      equalizer.setEnabled(enabled);
      promise.resolve(true);
    } catch (Exception e) {
      Log.w(TAG, "setEnabled failed", e);
      promise.reject("EQUALIZER_ENABLE", e.getMessage());
    }
  }

  @ReactMethod
  public void release(Promise promise) {
    try {
      if (equalizer != null) {
        equalizer.release();
        equalizer = null;
      }
      promise.resolve(true);
    } catch (Exception e) {
      Log.w(TAG, "release failed", e);
      promise.reject("EQUALIZER_RELEASE", e.getMessage());
    }
  }
}
