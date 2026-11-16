package com.harpreetsingh29.habittracker;

import android.content.ComponentName;
import android.content.Context;
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

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;
import com.getcapacitor.Plugin;

import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class MainActivity extends BridgeActivity {
    
    private static final String TAG = "EvolveMainActivity";
    private ActivityResultLauncher<String> createBackupFileLauncher;
    
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
            Log.d(TAG, "Added JavaScript interface 'Android' for dynamic icon");
        }
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
            getPreferences(MODE_PRIVATE).edit().putString("pendingBackup", json).apply();
            createBackupFileLauncher.launch(
                filename == null || filename.trim().isEmpty()
                    ? "evolve-backup.json"
                    : filename
            );
        });
    }

    private void writeBackupFile(Uri uri) {
        if (uri == null) {
            getPreferences(MODE_PRIVATE).edit().remove("pendingBackup").apply();
            return;
        }
        String json = getPreferences(MODE_PRIVATE).getString("pendingBackup", null);
        getPreferences(MODE_PRIVATE).edit().remove("pendingBackup").apply();
        if (json == null) {
            return;
        }
        try (java.io.OutputStream output = getContentResolver().openOutputStream(uri)) {
            if (output == null) {
                throw new java.io.IOException("Unable to open selected backup file");
            }
            output.write(json.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            Toast.makeText(this, "Backup exported successfully", Toast.LENGTH_SHORT).show();
        } catch (java.io.IOException e) {
            Log.e(TAG, "Failed to write backup file", e);
            Toast.makeText(this, "Could not save backup file", Toast.LENGTH_LONG).show();
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
}