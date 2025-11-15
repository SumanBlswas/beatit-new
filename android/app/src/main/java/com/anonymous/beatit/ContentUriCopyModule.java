package com.anonymous.beatit;

import android.content.ContentResolver;
import android.content.Context;
import android.net.Uri;
import android.util.Log;
import android.app.Activity;
import android.content.pm.ActivityInfo;
import android.media.MediaMetadataRetriever;
import android.media.MediaMetadataRetriever;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

public class ContentUriCopyModule extends ReactContextBaseJavaModule {
    private static final String TAG = "ContentUriCopyModule";
    private final ReactApplicationContext reactContext;

    public ContentUriCopyModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    

    

    @ReactMethod
    public void getVideoOrientation(String contentUriString, Promise promise) {
        try {
            Uri contentUri = Uri.parse(contentUriString);
            Context ctx = getReactApplicationContext();

            MediaMetadataRetriever retriever = new MediaMetadataRetriever();
            retriever.setDataSource(ctx, contentUri);
            String rotationStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION);
            String widthStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH);
            String heightStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT);

            int rotation = 0;
            int width = -1;
            int height = -1;
            if (rotationStr != null) {
                try { rotation = Integer.parseInt(rotationStr); } catch (NumberFormatException ignored) {}
            }
            if (widthStr != null) {
                try { width = Integer.parseInt(widthStr); } catch (NumberFormatException ignored) {}
            }
            if (heightStr != null) {
                try { height = Integer.parseInt(heightStr); } catch (NumberFormatException ignored) {}
            }

            boolean isLandscape = false;
            if (rotation == 90 || rotation == 270) {
                isLandscape = true;
            } else if (width > 0 && height > 0) {
                isLandscape = width >= height;
            }

            Log.i(TAG, "getVideoOrientation metadata: rotation=" + rotation + " width=" + width + " height=" + height + " => isLandscape=" + isLandscape);

            Activity activity = getCurrentActivity();
            if (activity != null) {
                int orientation = isLandscape ? ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE : ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT;
                activity.setRequestedOrientation(orientation);
                Log.i(TAG, "getVideoOrientation set Activity orientation to " + (isLandscape ? "LANDSCAPE" : "PORTRAIT"));
            } else {
                Log.w(TAG, "getVideoOrientation: No current activity available to set orientation");
            }

            retriever.release();

            // ...removed media session suppression logic...

            promise.resolve(isLandscape ? "landscape" : "portrait");
        } catch (Exception e) {
            Log.w(TAG, "getVideoOrientation failed", e);
            promise.reject("E_ORIENTATION_FAILED", e.getMessage());
        }
    }

    @NonNull
    @Override
    public String getName() {
        return "ContentUriCopy";
    }

    @ReactMethod
    public void copyContentUriToCache(String contentUriString, Promise promise) {
        try {
            Uri contentUri = Uri.parse(contentUriString);
            Context ctx = getReactApplicationContext();
            ContentResolver resolver = ctx.getContentResolver();

            String filename = contentUri.getLastPathSegment();
            if (filename == null || filename.isEmpty()) {
                filename = "external_media_" + System.currentTimeMillis();
            }

            File cacheDir = ctx.getCacheDir();
            File outFile = new File(cacheDir, filename);

            InputStream in = resolver.openInputStream(contentUri);
            if (in == null) {
                promise.reject("E_READ_FAILED", "Unable to open input stream for content URI");
                return;
            }

            OutputStream out = new FileOutputStream(outFile);
            byte[] buffer = new byte[8192];
            int read;
            while ((read = in.read(buffer)) != -1) {
                out.write(buffer, 0, read);
            }
            out.flush();
            out.close();
            in.close();
            String resultPath = outFile.getAbsolutePath();
            Log.i(TAG, "Copied content URI to cache: " + resultPath + " (origUri=" + contentUriString + ")");

            // Determine video orientation using metadata and set Activity orientation
            try {
                MediaMetadataRetriever retriever = new MediaMetadataRetriever();
                // Use the content Uri as data source (supports content://)
                retriever.setDataSource(ctx, contentUri);
                String rotationStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION);
                String widthStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH);
                String heightStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT);

                int rotation = 0;
                int width = -1;
                int height = -1;
                if (rotationStr != null) {
                    try { rotation = Integer.parseInt(rotationStr); } catch (NumberFormatException ignored) {}
                }
                if (widthStr != null) {
                    try { width = Integer.parseInt(widthStr); } catch (NumberFormatException ignored) {}
                }
                if (heightStr != null) {
                    try { height = Integer.parseInt(heightStr); } catch (NumberFormatException ignored) {}
                }

                boolean isLandscape = false;
                if (rotation == 90 || rotation == 270) {
                    isLandscape = true;
                } else if (width > 0 && height > 0) {
                    isLandscape = width >= height;
                }

                Log.i(TAG, "Video metadata: rotation=" + rotation + " width=" + width + " height=" + height + " => isLandscape=" + isLandscape);

                Activity activity = getCurrentActivity();
                if (activity != null) {
                    int orientation = isLandscape ? ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE : ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT;
                    activity.setRequestedOrientation(orientation);
                    Log.i(TAG, "Set activity orientation to " + (isLandscape ? "LANDSCAPE" : "PORTRAIT"));
                } else {
                    Log.w(TAG, "No current activity available to set orientation");
                }

                retriever.release();
            } catch (Exception e) {
                Log.w(TAG, "Failed to set orientation based on video metadata", e);
            }

            // ...removed media session suppression logic...

            promise.resolve(resultPath);
        } catch (Exception e) {
            Log.w(TAG, "copyContentUriToCache failed", e);
            promise.reject("E_COPY_FAILED", e.getMessage());
        }
    }
}
