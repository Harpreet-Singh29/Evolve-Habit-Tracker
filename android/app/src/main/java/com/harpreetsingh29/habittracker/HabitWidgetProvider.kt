package com.harpreetsingh29.habittracker

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.res.Configuration
import android.graphics.Bitmap
import android.util.Log
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject

/**
 * Home screen widget: a mountain whose filled height is today's habit/task
 * progress, with checkpoint markers along a trail and an "M/N complete" label.
 *
 * All artwork is rendered into a Bitmap by HabitWidgetArt (RemoteViews cannot
 * draw) and pushed with setImageViewBitmap. Tapping the card opens the app.
 */
class HabitWidgetProvider : AppWidgetProvider() {

    companion object {
        private const val TAG = "HabitWidgetProvider"
        private const val PREFS_NAME = "habit_widget_cache"
        private const val KEY_TODAY_DATA = "today_data"

        /** Strong reference so the launcher can still draw the last render. */
        @Volatile
        private var lastArt: Bitmap? = null

        /** Call this from MainActivity after the web layer writes new data. */
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
        for (id in appWidgetIds) {
            updateWidgetInternal(context, manager, id)
        }
    }

    private fun updateWidgetInternal(context: Context, manager: AppWidgetManager, id: Int) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val json = prefs.getString(KEY_TODAY_DATA, "{}") ?: "{}"

        var total = 0
        var completed = 0

        try {
            val obj = JSONObject(json)
            total = obj.optInt("total", 0)
            completed = obj.optInt("completed", 0)
        } catch (e: Exception) {
            Log.e(TAG, "Error parsing JSON", e)
        }

        val (wPx, hPx) = widgetSizePx(context, manager, id)
        val isDarkTheme =
            (context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
                Configuration.UI_MODE_NIGHT_YES

        val art: Bitmap = try {
            HabitWidgetArt.render(wPx, hPx, total, completed, isDarkTheme)
        } catch (e: Exception) {
            Log.e(TAG, "Error rendering widget art", e)
            HabitWidgetArt.render(wPx, hPx, 0, 0, isDarkTheme)
        }

        val views = RemoteViews(context.packageName, R.layout.habit_widget_layout)
        // Keep a strong reference: a launcher that pulls the bitmap into another
        // process must not find it already collected.
        lastArt = art
        views.setImageViewBitmap(R.id.widget_art, art)

        if (total > 0) {
            views.setViewVisibility(R.id.widget_progress, View.GONE)
        } else {
            views.setViewVisibility(R.id.widget_progress, View.VISIBLE)
            views.setTextViewText(R.id.widget_progress, "No habits today")
        }

        // RemoteViews cannot position per-marker tap targets (no margin support),
        // and 20dp markers are below the 48dp touch-target minimum anyway, so a
        // single tap opens the app where the item can be completed properly.
        val openIntent = Intent(context, MainActivity::class.java).apply {
            action = Intent.ACTION_MAIN
            addCategory(Intent.CATEGORY_LAUNCHER)
        }
        val openPi = android.app.PendingIntent.getActivity(
            context, 0, openIntent,
            android.app.PendingIntent.FLAG_IMMUTABLE or android.app.PendingIntent.FLAG_UPDATE_CURRENT
        )
        views.setOnClickPendingIntent(R.id.widget_art, openPi)

        manager.updateAppWidget(id, views)
    }

    private fun widgetSizePx(context: Context, manager: AppWidgetManager, id: Int): Pair<Int, Int> {
        val density = context.resources.displayMetrics.density
        val opts = manager.getAppWidgetOptions(id)
        val wDp = listOf(
            opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 0),
            opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0),
        ).firstOrNull { it > 0 } ?: 250
        val hDp = listOf(
            opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0),
            opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0),
        ).firstOrNull { it > 0 } ?: 110
        return Pair((wDp * density).toInt().coerceAtLeast(1), (hDp * density).toInt().coerceAtLeast(1))
    }
}