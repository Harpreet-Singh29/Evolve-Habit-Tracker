package com.harpreetsingh29.habittracker;

import android.content.ComponentName;
import android.content.Context;
import android.content.ContextWrapper;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;
import com.getcapacitor.Plugin;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends BridgeActivity {
    
    private static final String TAG = "EvolveMainActivity";
    private ActivityResultLauncher<String> createBackupFileLauncher;
    
    // GitHub API constants
    private static final String GITHUB_API_URL = "https://api.github.com/repos/Harpreet-Singh29/Evolve-Habit-Tracker/releases/latest";
    private static final String GITHUB_REPO = "Harpreet-Singh29/Evolve-Habit-Tracker";
    
    // Update checking (no native APK download/install — Play Protect flags
    // apps that install their own updates; updates are fetched in the browser
    // instead. See openInBrowser().)
    private final ExecutorService executorService = Executors.newSingleThreadExecutor();
    
    // JS Callback storage
    private String pendingUpdateCheckCallback = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createBackupFileLauncher = registerForActivityResult(
            new ActivityResultContracts.CreateDocument("application/json"),
            this::writeBackupFile
        );
        configureSystemBars();
        
        // Add JavaScript interface for dynamic icon updates
        // This must be done after super.onCreate() initializes the bridge
        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            webView.addJavascriptInterface(this, "Android");
            Log.d(TAG, "Added JavaScript interface 'Android' for dynamic icon and updates");

            // The web layer owns theming (html.light toggle + color-scheme).
            // Android's algorithmic darkening would heuristically invert the
            // light theme whenever the SYSTEM is dark, producing text that
            // matches its own background. Belt and braces with the Light-only
            // AppTheme parent and `color-scheme: only light` in the CSS.
            if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
                WebSettingsCompat.setAlgorithmicDarkeningAllowed(webView.getSettings(), false);
                Log.d(TAG, "WebView algorithmic darkening disabled");
            } else if (WebViewFeature.isFeatureSupported(WebViewFeature.FORCE_DARK)) {
                WebSettingsCompat.setForceDark(webView.getSettings(), WebSettingsCompat.FORCE_DARK_OFF);
                Log.d(TAG, "WebView force-dark disabled");
            }
        }
    }
    
    @Override
    public void onDestroy() {
        super.onDestroy();
        executorService.shutdown();
    }
    
    /**
     * Open a URL in the user's default browser.
     *
     * Used to fetch a new APK from the GitHub release. Updates are downloaded
     * and installed by the user through the browser on purpose: Play Protect
     * flags apps that declare REQUEST_INSTALL_PACKAGES and download their own
     * updates, so this app deliberately keeps no install-package code.
     * @param url HTTPS URL to open
     */
    @JavascriptInterface
    public void openInBrowser(String url) {
        Log.d(TAG, "openInBrowser called: " + url);
        if (url == null || url.trim().isEmpty()) {
            Log.w(TAG, "openInBrowser called with empty URL");
            return;
        }
        try {
            Uri uri = Uri.parse(url.trim());
            // Only ever hand HTTPS URLs to the browser from the JS bridge.
            if (!"https".equalsIgnoreCase(uri.getScheme())) {
                Log.e(TAG, "openInBrowser rejected non-HTTPS URL");
                runOnUiThread(() -> Toast.makeText(this, "Only secure (https) links can be opened", Toast.LENGTH_SHORT).show());
                return;
            }
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            runOnUiThread(() -> {
                try {
                    startActivity(intent);
                } catch (Exception e) {
                    Log.e(TAG, "No browser available", e);
                    Toast.makeText(this, "Could not open a browser", Toast.LENGTH_LONG).show();
                }
            });
        } catch (Exception e) {
            Log.e(TAG, "openInBrowser failed", e);
        }
    }
    
    /**
     * Get current app version from BuildConfig.
     */
    @JavascriptInterface
    public String getCurrentVersion() {
        return BuildConfig.VERSION_NAME;
    }
    
    /**
     * Get current version code from BuildConfig.
     */
    @JavascriptInterface
    public int getCurrentVersionCode() {
        return BuildConfig.VERSION_CODE;
    }
    
    /**
     * Check for updates from GitHub Releases.
     * Called from JavaScript with a callback function name.
     * @param callbackId Unique identifier for the callback
     */
    @JavascriptInterface
    public void checkForUpdates(String callbackId) {
        Log.d(TAG, "checkForUpdates called from JS with callbackId: " + callbackId);
        this.pendingUpdateCheckCallback = callbackId;
        
        executorService.execute(() -> {
            try {
                // Fetch latest release from GitHub API
                URL url = new URL(GITHUB_API_URL);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestProperty("Accept", "application/vnd.github.v3+json");
                conn.setRequestProperty("User-Agent", "Evolve-Android-App");
                conn.setConnectTimeout(10000);
                conn.setReadTimeout(10000);
                
                int responseCode = conn.getResponseCode();
                if (responseCode != HttpURLConnection.HTTP_OK) {
                    sendUpdateCheckResult(false, "GitHub API error: " + responseCode, null, null);
                    return;
                }
                
                // Read response
                StringBuilder response = new StringBuilder();
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        response.append(line);
                    }
                }
                
                // Parse JSON
                JSONObject release = new JSONObject(response.toString());
                String tagName = release.optString("tag_name", "");
                String latestVersion = tagName.replaceFirst("^v", ""); // Remove 'v' prefix
                
                // Find APK asset
                String downloadUrl = null;
                if (release.has("assets")) {
                    org.json.JSONArray assets = release.getJSONArray("assets");
                    for (int i = 0; i < assets.length(); i++) {
                        JSONObject asset = assets.getJSONObject(i);
                        String name = asset.optString("name", "");
                        if (name.endsWith(".apk")) {
                            downloadUrl = asset.optString("browser_download_url", null);
                            break;
                        }
                    }
                }
                
                if (downloadUrl == null) {
                    sendUpdateCheckResult(false, "No APK asset found in latest release", null, null);
                    return;
                }
                
                // Compare versions
                String currentVersion = BuildConfig.VERSION_NAME;
                int comparison = compareVersions(currentVersion, latestVersion);
                
                if (comparison < 0) {
                    // Update available
                    sendUpdateCheckResult(true, null, latestVersion, downloadUrl);
                } else {
                    // Already up to date
                    sendUpdateCheckResult(false, "already_latest", latestVersion, null);
                }
                
            } catch (Exception e) {
                Log.e(TAG, "Error checking for updates", e);
                sendUpdateCheckResult(false, "Error: " + e.getMessage(), null, null);
            }
        });
    }
    
    /**
     * Send update check result back to JavaScript.
     */
    private void sendUpdateCheckResult(boolean hasUpdate, String error, String latestVersion, String downloadUrl) {
        String callbackId = pendingUpdateCheckCallback;
        pendingUpdateCheckCallback = null;
        
        if (callbackId == null) {
            Log.w(TAG, "No pending callback for update check result");
            return;
        }
        
        JSONObject result = new JSONObject();
        try {
            result.put("hasUpdate", hasUpdate);
            result.put("currentVersion", BuildConfig.VERSION_NAME);
            if (error != null) {
                result.put("error", error);
            }
            if (latestVersion != null) {
                result.put("latestVersion", latestVersion);
            }
            if (downloadUrl != null) {
                result.put("downloadUrl", downloadUrl);
            }
        } catch (JSONException e) {
            Log.e(TAG, "Error creating result JSON", e);
        }
        
        final String jsCallback = "window.AndroidUpdateCallbacks && window.AndroidUpdateCallbacks['" + callbackId + "']";
        final String jsResult = result.toString();
        
        runOnUiThread(() -> {
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().evaluateJavascript(
                    jsCallback + " && " + jsCallback + "(" + jsResult + ")",
                    r -> Log.d(TAG, "Update check callback result: " + r)
                );
            }
        });
    }
    
    /**
     * Draw the WebView behind the system bars and keep navigation-bar icons
     * readable against Evolve's current web theme. The WebView CSS supplies the
     * actual light/dark background, including beneath the gesture indicator.
     */
    @JavascriptInterface
    public void setAppTheme(String theme) {
        if (theme == null) {
            return;
        }
        boolean isLightTheme = "light".equalsIgnoreCase(theme.trim());
        getSharedPreferences("evolve", MODE_PRIVATE)
            .edit()
            .putBoolean("lightTheme", isLightTheme)
            .apply();
        runOnUiThread(() -> applySystemBarAppearance(isLightTheme));
    }

    /** Open Android's document picker so backups can be saved from the WebView. */
    @JavascriptInterface
    public void exportBackup(String json, String filename) {
        if (json == null || createBackupFileLauncher == null) {
            return;
        }
        runOnUiThread(() -> {
            try {
                java.io.File backupFile = java.io.File.createTempFile(
                    "evolve-backup-", ".json", getCacheDir()
                );
                try (java.io.FileOutputStream output = new java.io.FileOutputStream(backupFile)) {
                    output.write(json.getBytes(java.nio.charset.StandardCharsets.UTF_8));
                }
                getPreferences(MODE_PRIVATE).edit()
                    .putString("pendingBackupFile", backupFile.getAbsolutePath())
                    .apply();
                createBackupFileLauncher.launch(
                    filename == null || filename.trim().isEmpty()
                        ? "evolve-backup.json"
                        : filename
                );
            } catch (java.io.IOException e) {
                Log.e(TAG, "Failed to prepare backup file", e);
                Toast.makeText(this, "Could not prepare backup file", Toast.LENGTH_LONG).show();
            }
        });
    }

    private void writeBackupFile(Uri uri) {
        String path = getPreferences(MODE_PRIVATE).getString("pendingBackupFile", null);
        getPreferences(MODE_PRIVATE).edit().remove("pendingBackupFile").apply();
        if (path == null) {
            return;
        }
        java.io.File backupFile = new java.io.File(path);
        if (uri == null) {
            backupFile.delete();
            return;
        }
        try (java.io.InputStream input = new java.io.FileInputStream(backupFile);
             java.io.OutputStream output = getContentResolver().openOutputStream(uri)) {
            if (output == null) {
                throw new java.io.IOException("Unable to open selected backup file");
            }
            byte[] buffer = new byte[8192];
            int bytesRead;
            while ((bytesRead = input.read(buffer)) != -1) {
                output.write(buffer, 0, bytesRead);
            }
            Toast.makeText(this, "Backup exported successfully", Toast.LENGTH_SHORT).show();
        } catch (java.io.IOException e) {
            Log.e(TAG, "Failed to write backup file", e);
            Toast.makeText(this, "Could not save backup file", Toast.LENGTH_LONG).show();
        } finally {
            backupFile.delete();
        }
    }

    private void configureSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        boolean isLightTheme = getSharedPreferences("evolve", MODE_PRIVATE)
            .getBoolean("lightTheme", !isSystemInDarkTheme());
        applySystemBarAppearance(isLightTheme);
    }

    private boolean isSystemInDarkTheme() {
        int nightMode = getResources().getConfiguration().uiMode
            & Configuration.UI_MODE_NIGHT_MASK;
        return nightMode == Configuration.UI_MODE_NIGHT_YES;
    }

    private void applySystemBarAppearance(boolean isLightTheme) {
        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (controller != null) {
            controller.setAppearanceLightNavigationBars(isLightTheme);
            controller.setAppearanceLightStatusBars(isLightTheme);
        }

        // Transparent system bars let the WebView's themed surface extend beneath
        // them on legacy Android versions as well as modern edge-to-edge devices.
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            getWindow().setNavigationBarContrastEnforced(false);
        }

        // The WebView does not paint beneath the transparent bars on every
        // device, so the strip above the app shows the WINDOW background. With
        // a Light app theme that is AppCompat's #FAFAFA, which left a light
        // strip above a dark app. Drive it from the app's own theme instead.
        int appBackground = isLightTheme ? 0xFFEEF0F3 : 0xFF18181B; // --bg light / dark
        getWindow().getDecorView().setBackgroundColor(appBackground);
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().setBackgroundColor(appBackground);
        }
    }

    private static final String PACKAGE_NAME = "com.harpreetsingh29.habittracker";
    
    // Activity alias class names (two states: Default and Attention)
    private static final String ALIAS_DEFAULT = PACKAGE_NAME + ".launcher.DefaultIcon";
    private static final String ALIAS_ATTENTION = PACKAGE_NAME + ".launcher.AttentionIcon";
    
    // Icon states: DEFAULT (normal/complete) and ATTENTION (incomplete due today)
    private enum IconState { DEFAULT, ATTENTION }
    
    @Override
    public void onResume() {
        super.onResume();
        // Update icon when app comes to foreground
        updateIconFromWebView();
    }
    
    @Override
    public void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        // Handle date change or data refresh
        updateIconFromWebView();
    }
    
    /**
     * Called from JavaScript via @JavascriptInterface to update the launcher icon.
     * @param stateString One of "DEFAULT", "ATTENTION"
     */
    @JavascriptInterface
    public void updateIconState(String stateString) {
        Log.d(TAG, "updateIconState called from JS: " + stateString);
        if (stateString == null) {
            return;
        }
        try {
            IconState state = IconState.valueOf(stateString.trim().toUpperCase(Locale.ROOT));
            setEnabledAlias(this, state);
        } catch (IllegalArgumentException e) {
            Log.e(TAG, "Invalid icon state: " + stateString);
        }
    }
    
    /**
     * Request the web view to compute and send the current icon state.
     * This is called on resume and can be called from JS when data changes.
     */
    private void updateIconFromWebView() {
        // Execute JavaScript in the web view to compute icon state
        // The web side has access to the store (localStorage) and can compute
        runOnUiThread(() -> {
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().evaluateJavascript(
                    "window.EvolveNative && window.EvolveNative.requestIconUpdate()",
                    result -> Log.d(TAG, "JS icon update request result: " + result)
                );
            }
        });
    }
    
    /**
     * Enable the activity alias for the given state and disable the other alias.
     * Skips PackageManager updates when the desired state is already active, and
     * enables the target alias before disabling the previous one so launchers
     * never observe zero enabled launcher entries.
     */
    private static void setEnabledAlias(Context context, IconState state) {
        PackageManager pm = context.getPackageManager();
        ComponentName defaultAlias = new ComponentName(context, ALIAS_DEFAULT);
        ComponentName attentionAlias = new ComponentName(context, ALIAS_ATTENTION);

        int defaultSetting = pm.getComponentEnabledSetting(defaultAlias);
        int attentionSetting = pm.getComponentEnabledSetting(attentionAlias);

        // In AndroidManifest.xml, DefaultIcon has enabled="true" and AttentionIcon has enabled="false".
        boolean defaultIsEnabled =
            defaultSetting == PackageManager.COMPONENT_ENABLED_STATE_ENABLED ||
            defaultSetting == PackageManager.COMPONENT_ENABLED_STATE_DEFAULT;
        boolean attentionIsEnabled =
            attentionSetting == PackageManager.COMPONENT_ENABLED_STATE_ENABLED;

        if (state == IconState.ATTENTION) {
            if (attentionIsEnabled && !defaultIsEnabled) {
                return;
            }
            pm.setComponentEnabledSetting(attentionAlias,
                PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                PackageManager.DONT_KILL_APP);
            pm.setComponentEnabledSetting(defaultAlias,
                PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                PackageManager.DONT_KILL_APP);
            Log.d(TAG, "Enabled launcher alias: " + attentionAlias.getClassName());
        } else {
            if (defaultIsEnabled && !attentionIsEnabled) {
                return;
            }
            pm.setComponentEnabledSetting(defaultAlias,
                PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
                PackageManager.DONT_KILL_APP);
            pm.setComponentEnabledSetting(attentionAlias,
                PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
                PackageManager.DONT_KILL_APP);
            Log.d(TAG, "Enabled launcher alias: " + defaultAlias.getClassName());
        }
    }
    
    /**
     * Get today's date in YYYY-MM-DD format (local timezone).
     * This matches the format used by the web store.
     */
    private String getTodayLocal() {
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault());
        return sdf.format(new Date());
    }
    
    /**
     * Static method to be called from Capacitor plugins if needed.
     */
    public static void updateIconFromPlugin(Context context, String state) {
        if (state == null) {
            return;
        }
        try {
            IconState iconState = IconState.valueOf(state.trim().toUpperCase(Locale.ROOT));
            setEnabledAlias(context, iconState);
        } catch (Exception e) {
            Log.e(TAG, "Error updating icon from plugin", e);
        }
    }
    
    /**
     * Compare two semantic version strings.
     * Returns -1 if v1 < v2, 0 if equal, 1 if v1 > v2.
     */
    private int compareVersions(String v1, String v2) {
        if (v1 == null || v2 == null) return 0;
        
        // Strip 'v' prefix if present
        v1 = v1.replaceFirst("^v", "");
        v2 = v2.replaceFirst("^v", "");
        
        String[] parts1 = v1.split("\\.");
        String[] parts2 = v2.split("\\.");
        
        int maxLen = Math.max(parts1.length, parts2.length);
        for (int i = 0; i < maxLen; i++) {
            int n1 = i < parts1.length ? parseIntSafe(parts1[i]) : 0;
            int n2 = i < parts2.length ? parseIntSafe(parts2[i]) : 0;
            if (n1 != n2) return Integer.compare(n1, n2);
        }
        return 0;
    }
    
    private int parseIntSafe(String s) {
        try {
            return Integer.parseInt(s);
        } catch (NumberFormatException e) {
            return 0;
        }
    }
}