package com.anonymous.beatit;

import android.content.Context;
import android.content.SharedPreferences;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Callback;
import com.facebook.react.bridge.ReadableMap;

public class PlaybackInfoModule extends ReactContextBaseJavaModule {
    private static final String PREFS_NAME = "music_player_widget_prefs";

    public PlaybackInfoModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "PlaybackInfoModule";
    }

    @ReactMethod
    public void setPlaybackInfo(ReadableMap info, Callback callback) {
        Context context = getReactApplicationContext();
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        if (info.hasKey("songTitle")) editor.putString("songTitle", info.getString("songTitle"));
        if (info.hasKey("artist")) editor.putString("artist", info.getString("artist"));
        if (info.hasKey("albumArtPath")) editor.putString("albumArtPath", info.getString("albumArtPath"));
        if (info.hasKey("isPlaying")) editor.putBoolean("isPlaying", info.getBoolean("isPlaying"));
        if (info.hasKey("progress")) editor.putInt("progress", info.getInt("progress"));
        editor.apply();
        callback.invoke(true);
    }
}
