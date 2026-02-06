package com.suman334.rear;

import android.appwidget.AppWidgetManager; 
import android.content.ComponentName;      
import android.content.Context;
import android.content.Intent; 
import android.content.SharedPreferences;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Callback;
import com.facebook.react.bridge.ReadableMap;
import com.anonymous.widget.MusicPlayerWidgetProvider; 

public class PlaybackInfoModule extends ReactContextBaseJavaModule {
    private static final String PREFS_NAME = "music_player_widget_prefs";
    public static final String ACTION_UPDATE_WIDGET = "com.anonymous.beatit.UPDATE_WIDGET";

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
        
        // Read "progress" as a Double (React Native sends numbers as Double)
        // and save it as a Float in SharedPreferences.
        if (info.hasKey("progress")) {
            editor.putFloat("progress", (float)info.getDouble("progress"));
        }
        
        editor.apply();
        
        // Send the broadcast to update the widget
        Intent intent = new Intent(context, MusicPlayerWidgetProvider.class);
        intent.setAction(ACTION_UPDATE_WIDGET);
        int[] ids = AppWidgetManager.getInstance(context).getAppWidgetIds(
            new ComponentName(context, MusicPlayerWidgetProvider.class)
        );
        
        // --- THIS IS THE FIX ---
        // It should be AppWidgetManager, not AppWidgetMatrix
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
        // --- END OF FIX ---

        context.sendBroadcast(intent);

        callback.invoke(true);
    }
}