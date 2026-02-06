package com.anonymous.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import android.graphics.Color
import android.view.KeyEvent
import com.suman334.rear.R
import android.os.Build

class MusicPlayerWidgetProvider : AppWidgetProvider() {
    
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        android.util.Log.d("MusicPlayerWidget", "=== onUpdate called for ${appWidgetIds.size} widgets ===")
        
        val prefs = context.getSharedPreferences("music_player_widget_prefs", Context.MODE_PRIVATE)
        val songTitle = prefs.getString("songTitle", "No song playing") ?: "No song playing"
        val artist = prefs.getString("artist", "Unknown artist") ?: "Unknown artist"
        val isPlaying = prefs.getBoolean("isPlaying", false)
        val albumArtPath = prefs.getString("albumArtPath", null)
        val progressPercent = prefs.getFloat("progress", 0f) 
        val progress = (progressPercent * 100).toInt()

        android.util.Log.d("MusicPlayerWidget", "Song: $songTitle | Artist: $artist | Playing: $isPlaying | Art: $albumArtPath")

        for (appWidgetId in appWidgetIds) {
            try {
                val views = RemoteViews(context.packageName, R.layout.music_player_widget)
                
                // Set text content
                views.setTextViewText(R.id.song_title, songTitle)
                views.setTextViewText(R.id.song_artist, artist)
                
                // Set progress bar
                views.setProgressBar(R.id.progress_bar, 100, progress, false)
                
                // Set play/pause icon
                if (isPlaying) {
                    views.setImageViewResource(R.id.play_pause, android.R.drawable.ic_media_pause)
                } else {
                    views.setImageViewResource(R.id.play_pause, android.R.drawable.ic_media_play)
                }
                
                // Load Album Art
                if (!albumArtPath.isNullOrEmpty()) {
                    try {
                        val bitmap = decodeSampledBitmapFromFile(albumArtPath, 200, 200)
                        if (bitmap != null) {
                            views.setImageViewBitmap(R.id.album_art, bitmap)
                        } else {
                            views.setImageViewResource(R.id.album_art, R.drawable.album_art_placeholder)
                        }
                    } catch (e: Exception) {
                        android.util.Log.e("MusicPlayerWidget", "Error loading album art", e)
                        views.setImageViewResource(R.id.album_art, R.drawable.album_art_placeholder)
                    }
                } else {
                    views.setImageViewResource(R.id.album_art, R.drawable.album_art_placeholder)
                }

                // Apply rounded corners to album art (if API 31+)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    views.setViewLayoutMargin(R.id.album_art, RemoteViews.MARGIN_END, 16f, android.util.TypedValue.COMPLEX_UNIT_DIP)
                }
                
                // Set up click handlers
                setupClickHandlers(context, views)
                
                // Update the widget
                appWidgetManager.updateAppWidget(appWidgetId, views)
                
            } catch (e: Exception) {
                android.util.Log.e("MusicPlayerWidget", "✗ Error updating widget $appWidgetId", e)
                e.printStackTrace()
            }
        }
    }

    private fun decodeSampledBitmapFromFile(path: String, reqWidth: Int, reqHeight: Int): android.graphics.Bitmap? {
        return try {
            // First decode with inJustDecodeBounds=true to check dimensions
            val options = android.graphics.BitmapFactory.Options().apply {
                inJustDecodeBounds = true
            }
            android.graphics.BitmapFactory.decodeFile(path, options)

            // Calculate inSampleSize
            options.inSampleSize = calculateInSampleSize(options, reqWidth, reqHeight)

            // Decode bitmap with inSampleSize set
            options.inJustDecodeBounds = false
            android.graphics.BitmapFactory.decodeFile(path, options)
        } catch (e: Exception) {
            null
        }
    }

    private fun calculateInSampleSize(options: android.graphics.BitmapFactory.Options, reqWidth: Int, reqHeight: Int): Int {
        val (height: Int, width: Int) = options.run { outHeight to outWidth }
        var inSampleSize = 1

        if (height > reqHeight || width > reqWidth) {
            val halfHeight: Int = height / 2
            val halfWidth: Int = width / 2

            while (halfHeight / inSampleSize >= reqHeight && halfWidth / inSampleSize >= reqWidth) {
                inSampleSize *= 2
            }
        }

        return inSampleSize
    }
    
    private fun setupClickHandlers(context: Context, views: RemoteViews) {
        android.util.Log.d("MusicPlayerWidget", "Setting up click handlers")
        
        try {
            // Previous button
            val prevIntent = Intent(context, MusicPlayerWidgetProvider::class.java).apply { 
                action = "com.anonymous.beatit.PREV" 
            }
            val prevPendingIntent = PendingIntent.getBroadcast(
                context, 100, prevIntent, 
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.prev, prevPendingIntent)
            
            // Play/Pause button
            val playPauseIntent = Intent(context, MusicPlayerWidgetProvider::class.java).apply { 
                action = "com.anonymous.beatit.PLAY_PAUSE" 
            }
            val playPausePendingIntent = PendingIntent.getBroadcast(
                context, 101, playPauseIntent, 
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.play_pause, playPausePendingIntent)
            
            // Next button
            val nextIntent = Intent(context, MusicPlayerWidgetProvider::class.java).apply { 
                action = "com.anonymous.beatit.NEXT" 
            }
            val nextPendingIntent = PendingIntent.getBroadcast(
                context, 102, nextIntent, 
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.next, nextPendingIntent)
            
            // Click on widget to open app
            val openAppIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
            if (openAppIntent != null) {
                val openAppPendingIntent = PendingIntent.getActivity(
                    context, 103, openAppIntent, 
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                views.setOnClickPendingIntent(R.id.song_title, openAppPendingIntent)
                views.setOnClickPendingIntent(R.id.song_artist, openAppPendingIntent)
                views.setOnClickPendingIntent(R.id.album_art, openAppPendingIntent)
            }
            
            android.util.Log.d("MusicPlayerWidget", "✓ Click handlers set up successfully")
        } catch (e: Exception) {
            android.util.Log.e("MusicPlayerWidget", "✗ Error setting up click handlers", e)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        android.util.Log.d("MusicPlayerWidget", "=== onReceive: ${intent.action} ===")
        
        if (intent.action == "com.anonymous.beatit.UPDATE_WIDGET") {
            android.util.Log.d("MusicPlayerWidget", "Triggering widget update")
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val componentName = ComponentName(context, MusicPlayerWidgetProvider::class.java)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)
            if (appWidgetIds != null && appWidgetIds.isNotEmpty()) {
                android.util.Log.d("MusicPlayerWidget", "Updating ${appWidgetIds.size} widgets")
                onUpdate(context, appWidgetManager, appWidgetIds)
            } else {
                android.util.Log.w("MusicPlayerWidget", "No widget IDs found")
            }
        }
        
        // Handle media button clicks
        when (intent.action) {
            "com.anonymous.beatit.PLAY_PAUSE" -> {
                android.util.Log.d("MusicPlayerWidget", "▶️ Play/Pause clicked")
                val prefs = context.getSharedPreferences("music_player_widget_prefs", Context.MODE_PRIVATE)
                val isPlaying = prefs.getBoolean("isPlaying", false)
                if (isPlaying) {
                     context.sendBroadcast(Intent("com.anonymous.beatit.ACTION_PAUSE"))
                } else {
                     context.sendBroadcast(Intent("com.anonymous.beatit.ACTION_PLAY"))
                }
            }
            "com.anonymous.beatit.NEXT" -> {
                android.util.Log.d("MusicPlayerWidget", "⏭️ Next clicked")
                context.sendBroadcast(Intent("com.anonymous.beatit.ACTION_NEXT"))
            }
            "com.anonymous.beatit.PREV" -> {
                android.util.Log.d("MusicPlayerWidget", "⏮️ Previous clicked")
                context.sendBroadcast(Intent("com.anonymous.beatit.ACTION_PREV"))
            }
        }
        
        super.onReceive(context, intent)
    }
    
    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        android.util.Log.d("MusicPlayerWidget", "🟢 Widget ENABLED - First widget added")
    }
    
    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        android.util.Log.d("MusicPlayerWidget", "🔴 Widget DISABLED - Last widget removed")
    }
    
    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        super.onDeleted(context, appWidgetIds)
        android.util.Log.d("MusicPlayerWidget", "🗑️ Widget DELETED - IDs: ${appWidgetIds.joinToString()}")
    }
}