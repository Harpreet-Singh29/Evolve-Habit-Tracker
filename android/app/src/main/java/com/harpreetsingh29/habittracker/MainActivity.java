package com.harpreetsingh29.habittracker;

import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

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
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Add JavaScript interface for dynamic icon updates
        // This must be done after super.onCreate() initializes the bridge
        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            webView.addJavascriptInterface(this, "Android");
            Log.d(TAG, "Added JavaScript interface 'Android' for dynamic icon");
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
        try {
            IconState state = IconState.valueOf(stateString.toUpperCase());
            setEnabledAlias(state);
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
     * Enable the activity alias for the given state, disable others.
     */
    private void setEnabledAlias(IconState state) {
        PackageManager pm = getPackageManager();
        ComponentName defaultAlias = new ComponentName(this, ALIAS_DEFAULT);
        ComponentName attentionAlias = new ComponentName(this, ALIAS_ATTENTION);
        
        // Disable all first
        pm.setComponentEnabledSetting(defaultAlias, 
            PackageManager.COMPONENT_ENABLED_STATE_DISABLED, 
            PackageManager.DONT_KILL_APP);
        pm.setComponentEnabledSetting(attentionAlias, 
            PackageManager.COMPONENT_ENABLED_STATE_DISABLED, 
            PackageManager.DONT_KILL_APP);
        
        // Enable the target
        ComponentName targetAlias;
        switch (state) {
            case ATTENTION:
                targetAlias = attentionAlias;
                break;
            case DEFAULT:
            default:
                targetAlias = defaultAlias;
                break;
        }
        
        pm.setComponentEnabledSetting(targetAlias, 
            PackageManager.COMPONENT_ENABLED_STATE_ENABLED, 
            PackageManager.DONT_KILL_APP);
        
        Log.d(TAG, "Enabled launcher alias: " + targetAlias.getClassName());
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
        try {
            IconState iconState = IconState.valueOf(state.toUpperCase());
            PackageManager pm = context.getPackageManager();
            
            ComponentName defaultAlias = new ComponentName(context, ALIAS_DEFAULT);
            ComponentName attentionAlias = new ComponentName(context, ALIAS_ATTENTION);
            
            pm.setComponentEnabledSetting(defaultAlias, 
                PackageManager.COMPONENT_ENABLED_STATE_DISABLED, 
                PackageManager.DONT_KILL_APP);
            pm.setComponentEnabledSetting(attentionAlias, 
                PackageManager.COMPONENT_ENABLED_STATE_DISABLED, 
                PackageManager.DONT_KILL_APP);
            
            ComponentName targetAlias;
            switch (iconState) {
                case ATTENTION:
                    targetAlias = attentionAlias;
                    break;
                case DEFAULT:
                default:
                    targetAlias = defaultAlias;
                    break;
            }
            
            pm.setComponentEnabledSetting(targetAlias, 
                PackageManager.COMPONENT_ENABLED_STATE_ENABLED, 
                PackageManager.DONT_KILL_APP);
                
            Log.d(TAG, "Plugin updated launcher alias: " + targetAlias.getClassName());
        } catch (Exception e) {
            Log.e(TAG, "Error updating icon from plugin", e);
        }
    }
}