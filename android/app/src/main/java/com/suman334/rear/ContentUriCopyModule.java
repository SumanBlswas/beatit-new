package com.suman334.rear;

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
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;

import java.io.File;
import java.io.FileInputStream;
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

            InputStream in = null;
            
            // Handle both content:// and file:// URIs
            if (contentUriString.startsWith("content://")) {
                // Content URI - use ContentResolver
                in = resolver.openInputStream(contentUri);
                if (in == null) {
                    promise.reject("E_READ_FAILED", "Unable to open input stream for content URI");
                    return;
                }
            } else if (contentUriString.startsWith("file://")) {
                // File URI - use FileInputStream directly
                try {
                    // Handle file:// URIs - normalize triple slashes to single slash
                    String filePath = contentUriString.replaceFirst("^file://+", "");
                    // Ensure we have a leading slash
                    if (!filePath.startsWith("/")) {
                        filePath = "/" + filePath;
                    }
                    File sourceFile = new File(filePath);
                    if (!sourceFile.exists()) {
                        Log.e(TAG, "Source file does not exist: " + filePath);
                        promise.reject("E_FILE_NOT_FOUND", "Source file does not exist: " + filePath);
                        return;
                    }
                    if (!sourceFile.canRead()) {
                        Log.e(TAG, "Source file is not readable: " + filePath);
                        promise.reject("E_READ_FAILED", "Source file is not readable: " + filePath);
                        return;
                    }
                    in = new FileInputStream(sourceFile);
                    Log.i(TAG, "Opening file:// URI: " + filePath + " (size: " + sourceFile.length() + " bytes)");
                } catch (Exception e) {
                    Log.e(TAG, "Failed to open file:// URI: " + contentUriString, e);
                    promise.reject("E_READ_FAILED", "Unable to open file: " + e.getMessage());
                    return;
                }
            } else {
                promise.reject("E_UNSUPPORTED_URI", "Unsupported URI scheme. Only content:// and file:// are supported.");
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
            
            // Return file:// URI format for expo-video compatibility
            String resultPath = "file://" + outFile.getAbsolutePath();
            Log.i(TAG, "Copied URI to cache: " + resultPath + " (origUri=" + contentUriString + ", size: " + outFile.length() + " bytes)");

            // Determine video orientation using metadata and set Activity orientation
            try {
                MediaMetadataRetriever retriever = new MediaMetadataRetriever();
                // Use the appropriate data source based on URI type
                if (contentUriString.startsWith("content://")) {
                    retriever.setDataSource(ctx, contentUri);
                } else if (contentUriString.startsWith("file://")) {
                    // Use the cached file path for metadata extraction
                    String filePath = outFile.getAbsolutePath();
                    retriever.setDataSource(filePath);
                } else {
                    retriever.setDataSource(ctx, contentUri);
                }
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

    @ReactMethod
    public void extractAudioMetadata(String uriString, Promise promise) {
        try {
            Uri uri = Uri.parse(uriString);
            Context ctx = getReactApplicationContext();
            
            MediaMetadataRetriever retriever = new MediaMetadataRetriever();
            
            // Set data source based on URI scheme
            if (uriString.startsWith("content:")) {
                retriever.setDataSource(ctx, uri);
            } else if (uriString.startsWith("file://")) {
                retriever.setDataSource(uriString.replace("file://", ""));
            } else if (uriString.startsWith("file:")) {
                retriever.setDataSource(uriString.replace("file:", ""));
            } else {
                retriever.setDataSource(uriString);
            }
            
            // Extract metadata
            String title = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_TITLE);
            String artist = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ARTIST);
            String album = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUM);
            
            // Extract album art
            String albumArtPath = null;
            byte[] albumArt = retriever.getEmbeddedPicture();
            if (albumArt != null && albumArt.length > 0) {
                try {
                    // Save album art to cache directory
                    File cacheDir = ctx.getCacheDir();
                    String filename = "album_art_" + System.currentTimeMillis() + ".jpg";
                    File albumArtFile = new File(cacheDir, filename);
                    
                    FileOutputStream fos = new FileOutputStream(albumArtFile);
                    fos.write(albumArt);
                    fos.flush();
                    fos.close();
                    
                    albumArtPath = "file://" + albumArtFile.getAbsolutePath();
                    Log.i(TAG, "Saved album art to: " + albumArtPath);
                } catch (Exception e) {
                    Log.w(TAG, "Failed to save album art", e);
                }
            }
            
            retriever.release();
            
            // Build result map
            WritableMap result = Arguments.createMap();
            result.putString("title", title);
            result.putString("artist", artist);
            result.putString("album", album);
            result.putString("albumArtPath", albumArtPath);
            
            Log.i(TAG, "Extracted audio metadata - Title: " + title + ", Artist: " + artist + ", Album: " + album + ", AlbumArt: " + (albumArtPath != null ? "yes" : "no"));
            
            promise.resolve(result);
        } catch (Exception e) {
            Log.w(TAG, "extractAudioMetadata failed", e);
            promise.reject("E_METADATA_EXTRACTION_FAILED", e.getMessage());
        }
    }
}
