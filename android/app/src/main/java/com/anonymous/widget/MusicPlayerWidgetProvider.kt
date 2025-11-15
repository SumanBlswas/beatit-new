package com.anonymous.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.widget.RemoteViews
import androidx.palette.graphics.Palette
import android.graphics.Bitmap
import com.anonymous.beatit.R

class MusicPlayerWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        val prefs = context.getSharedPreferences("music_player_widget_prefs", Context.MODE_PRIVATE)
        val songTitle = prefs.getString("songTitle", "No song playing")
        val artist = prefs.getString("artist", "")
        val albumArtPath = prefs.getString("albumArtPath", null)
        val isPlaying = prefs.getBoolean("isPlaying", false)
        val progress = prefs.getInt("progress", 0)

        for (appWidgetId in appWidgetIds) {
            val views = RemoteViews(context.packageName, R.layout.music_player_widget)
            views.setTextViewText(R.id.song_title, songTitle)
            views.setTextViewText(R.id.song_artist, artist)

            // Load album art from file path if available
            var albumArtBitmap: Bitmap? = null
            if (albumArtPath != null) {
                val file = java.io.File(albumArtPath)
                if (file.exists()) {
                    albumArtBitmap = BitmapFactory.decodeFile(albumArtPath)
                }
            }
            if (albumArtBitmap == null) {
                albumArtBitmap = BitmapFactory.decodeResource(context.resources, R.drawable.ic_launcher_background)
            }
            views.setImageViewBitmap(R.id.album_art, albumArtBitmap)

            // Set play/pause icon
            if (isPlaying) {
                views.setImageViewResource(R.id.play_pause, R.drawable.ic_pause)
            } else {
                views.setImageViewResource(R.id.play_pause, R.drawable.ic_play)
            }

            // Set progress bar
            views.setProgressBar(R.id.progress_bar, 100, progress, false)

            // Dynamic color extraction from album art
            if (albumArtBitmap != null) {
                Palette.from(albumArtBitmap).generate { palette ->
                    val vibrant = palette?.getVibrantColor(0xFF1db954.toInt()) ?: 0xFF1db954.toInt()
                    val darkVibrant = palette?.getDarkVibrantColor(0xFF232526.toInt()) ?: 0xFF232526.toInt()
                    val lightVibrant = palette?.getLightVibrantColor(0xFFFFFFFF.toInt()) ?: 0xFFFFFFFF.toInt()

                    views.setInt(R.id.widget_root, "setBackgroundColor", vibrant)
                    views.setTextColor(R.id.song_title, lightVibrant)
                    views.setTextColor(R.id.song_artist, darkVibrant)
                    views.setInt(R.id.play_pause, "setColorFilter", vibrant)
                    views.setInt(R.id.next, "setColorFilter", vibrant)
                    views.setInt(R.id.prev, "setColorFilter", vibrant)
                    views.setInt(R.id.progress_bar, "setProgressDrawableTint", vibrant)
                    appWidgetManager.updateAppWidget(appWidgetId, views)
                }
            } else {
                appWidgetManager.updateAppWidget(appWidgetId, views)
            }

            // PendingIntent for play/pause
            val playPauseIntent = Intent(context, MusicPlayerWidgetProvider::class.java).apply {
                action = "com.anonymous.beatit.PLAY_PAUSE"
            }
            val playPausePendingIntent = PendingIntent.getBroadcast(context, 0, playPauseIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            views.setOnClickPendingIntent(R.id.play_pause, playPausePendingIntent)

            // PendingIntent for next
            val nextIntent = Intent(context, MusicPlayerWidgetProvider::class.java).apply {
                action = "com.anonymous.beatit.NEXT"
            }
            val nextPendingIntent = PendingIntent.getBroadcast(context, 1, nextIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            views.setOnClickPendingIntent(R.id.next, nextPendingIntent)

            // PendingIntent for previous
            val prevIntent = Intent(context, MusicPlayerWidgetProvider::class.java).apply {
                action = "com.anonymous.beatit.PREV"
            }
            val prevPendingIntent = PendingIntent.getBroadcast(context, 2, prevIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            views.setOnClickPendingIntent(R.id.prev, prevPendingIntent)

            // PendingIntent to open app
            val openAppIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
            val openAppPendingIntent = PendingIntent.getActivity(context, 3, openAppIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            views.setOnClickPendingIntent(R.id.album_art, openAppPendingIntent)
            views.setOnClickPendingIntent(R.id.song_title, openAppPendingIntent)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        when (intent.action) {
            "com.anonymous.beatit.PLAY_PAUSE" -> {
                // TODO: Send broadcast or start service to toggle play/pause in app
            }
            "com.anonymous.beatit.NEXT" -> {
                // TODO: Send broadcast or start service to skip to next song in app
            }
            "com.anonymous.beatit.PREV" -> {
                // TODO: Send broadcast or start service to skip to previous song in app
            }
        }
    }
}
