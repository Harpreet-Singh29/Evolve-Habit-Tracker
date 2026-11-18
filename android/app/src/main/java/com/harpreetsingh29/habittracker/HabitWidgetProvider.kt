package com.harpreetsingh29.habittracker

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.res.Configuration
import android.graphics.Color
import android.util.Log
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject

/**
 * Home screen widget showing a mountain with checkpoint tiers for today's habits/tasks.
 * Completed tiers (bottom) are pure black; incomplete tiers (top) are soft gray.
 * Data comes from SharedPreferences written by the main app via @JavascriptInterface.
 */
class HabitWidgetProvider : AppWidgetProvider() {

    companion object {
        private const val TAG = "HabitWidgetProvider"
        private const val PREFS_NAME = "habit_widget_cache"
        private const val KEY_TODAY_DATA = "today_data"

        /** Call this from MainActivity after the web layer writes new data */
        @JvmStatic
        fun updateWidget(context: Context, manager: AppWidgetManager, id: Int) {
            val instance = HabitWidgetProvider()
            instance.updateWidgetInternal(context, manager, id)
        }

        @JvmStatic
        fun triggerUpdate(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val component = ComponentName(context, HabitWidgetProvider::class.java)
            for (id in manager.getAppWidgetIds(component)) {
                updateWidget(context, manager, id)
            }
        }
    }

    override fun onUpdate(context: Context, manager: AppWidgetManager, appWidgetIds: IntArray) {
        Log.d(TAG, "onUpdate called with ${appWidgetIds.size} widget(s): ${appWidgetIds.joinToString()}")
        for (id in appWidgetIds) {
            updateWidgetInternal(context, manager, id)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == "WIDGET_TOGGLE_ITEM") {
            val itemId = intent.getStringExtra("item_id") ?: return
            val date = intent.getStringExtra("date") ?: return
            // Broadcast to main app to toggle the item
            val toggleIntent = Intent("com.harpreetsingh29.habittracker.WIDGET_TOGGLE")
                .putExtra("item_id", itemId)
                .putExtra("date", date)
                .setPackage(context.packageName)
            context.sendBroadcast(toggleIntent)
            return
        }
        super.onReceive(context, intent)
    }

    private fun updateWidgetInternal(context: Context, manager: AppWidgetManager, id: Int) {
        Log.d(TAG, "updateWidgetInternal called for widget id=$id")
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val json = prefs.getString(KEY_TODAY_DATA, "{}") ?: "{}"
        Log.d(TAG, "Read JSON from prefs: $json")

        var total = 0
        var completed = 0
        var itemsJson = ""

        try {
            val obj = JSONObject(json)
            total = obj.optInt("total", 0)
            completed = obj.optInt("completed", 0)
            itemsJson = obj.optString("items", "[]")
        } catch (e: Exception) {
            Log.e(TAG, "Error parsing JSON", e)
            // Use defaults
        }

        Log.d(TAG, "Parsed: total=$total, completed=$completed, itemsJson=$itemsJson")

        // Detect current theme (light/dark)
        val isDarkTheme = (context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        Log.d(TAG, "isDarkTheme=$isDarkTheme")
        
        val bgColor = if (isDarkTheme) Color.parseColor("#1A1A1A") else Color.parseColor("#F5F5F5")
        val labelColor = if (isDarkTheme) Color.WHITE else Color.BLACK
        val checkpointDrawable = if (isDarkTheme) R.drawable.widget_checkpoint else R.drawable.widget_checkpoint

        val views = RemoteViews(context.packageName, R.layout.habit_widget_layout)

        // Set theme-aware background
        views.setInt(R.id.widget_root, "setBackgroundColor", bgColor)

        // Handle empty state (no habits/tasks for today)
        if (total == 0) {
            views.setTextViewText(R.id.widget_progress, "No habits today")
            views.setInt(R.id.widget_progress, "setTextColor", labelColor)
            // Hide all tier views (up to 8)
            for (i in 0 until 8) {
                val tierId = context.resources.getIdentifier("widget_tier_$i", "id", context.packageName)
                val leftMarkerId = context.resources.getIdentifier("widget_checkpoint_left_$i", "id", context.packageName)
                val rightMarkerId = context.resources.getIdentifier("widget_checkpoint_right_$i", "id", context.packageName)
                views.setViewVisibility(tierId, View.GONE)
                views.setViewVisibility(leftMarkerId, View.GONE)
                views.setViewVisibility(rightMarkerId, View.GONE)
            }
        } else {
            // Clamp total to max 8 tiers
            val displayTotal = minOf(total, 8)
            
            // Update the container's weightSum to match the number of tiers
            views.setFloat(R.id.widget_tiers_container, "setWeightSum", displayTotal.toFloat())

            // Progress label
            views.setTextViewText(R.id.widget_progress, "$completed/$total complete")
            views.setInt(R.id.widget_progress, "setTextColor", labelColor)

            // Update tier slots based on actual total
            for (i in 0 until 8) {
                val tierId = context.resources.getIdentifier("widget_tier_$i", "id", context.packageName)
                val leftMarkerId = context.resources.getIdentifier("widget_checkpoint_left_$i", "id", context.packageName)
                val rightMarkerId = context.resources.getIdentifier("widget_checkpoint_right_$i", "id", context.packageName)

                if (i < displayTotal) {
                    // Show tier views
                    views.setViewVisibility(tierId, View.VISIBLE)
                    views.setViewVisibility(leftMarkerId, View.VISIBLE)
                    views.setViewVisibility(rightMarkerId, View.VISIBLE)

                    val isComplete = i < completed
                    val tierDrawable = if (isComplete) R.drawable.widget_tier_complete else R.drawable.widget_tier_incomplete

                    views.setInt(tierId, "setBackgroundResource", tierDrawable)
                    views.setInt(leftMarkerId, "setBackgroundResource", checkpointDrawable)
                    views.setInt(rightMarkerId, "setBackgroundResource", checkpointDrawable)

                    // Click listener for toggling (only if there's an item at this position)
                    if (i < total) {
                        try {
                            val itemsArray = org.json.JSONArray(itemsJson)
                            if (i < itemsArray.length()) {
                                val item = itemsArray.getJSONObject(i)
                                val itemId = item.optString("id", "")
                                val itemDone = item.optBoolean("done", false)
                                val date = org.json.JSONObject(json).optString("date", "")

                                if (itemId.isNotEmpty()) {
                                    val toggleIntent = Intent("WIDGET_TOGGLE_ITEM")
                                        .putExtra("item_id", itemId)
                                        .putExtra("date", date)
                                    val pendingIntent = android.app.PendingIntent.getBroadcast(
                                        context, i, toggleIntent,
                                        android.app.PendingIntent.FLAG_IMMUTABLE or android.app.PendingIntent.FLAG_UPDATE_CURRENT
                                    )
                                    views.setOnClickPendingIntent(tierId, pendingIntent)
                                }
                            }
                        } catch (e: Exception) {
                            // Ignore click setup errors
                        }
                    }
                } else {
                    // Hide unused tiers
                    views.setViewVisibility(tierId, View.GONE)
                    views.setViewVisibility(leftMarkerId, View.GONE)
                    views.setViewVisibility(rightMarkerId, View.GONE)
                }
            }
        }

        // Tap mountain → open app
        val openIntent = Intent(context, MainActivity::class.java).apply {
            action = Intent.ACTION_MAIN
            addCategory(Intent.CATEGORY_LAUNCHER)
        }
        val openPendingIntent = android.app.PendingIntent.getActivity(
            context, 0, openIntent,
            android.app.PendingIntent.FLAG_IMMUTABLE or android.app.PendingIntent.FLAG_UPDATE_CURRENT
        )
        views.setOnClickPendingIntent(R.id.widget_root, openPendingIntent)

        Log.d(TAG, "Calling updateAppWidget for widget id=$id")
        manager.updateAppWidget(id, views)
        Log.d(TAG, "updateAppWidget completed for widget id=$id")
    }
}