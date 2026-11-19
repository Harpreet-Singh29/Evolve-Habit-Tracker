package com.harpreetsingh29.habittracker

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PathMeasure
import android.graphics.RectF
import android.graphics.Typeface
import kotlin.math.max
import kotlin.math.min

/**
 * Draws the home-screen widget art into a Bitmap so it can be pushed into the
 * RemoteViews with setImageViewBitmap. RemoteViews has no canvas access, so the
 * entire illustration (mountain facets, progress fill, winding trail and its
 * checkpoint markers, checkmarks and the "M/N complete" label) is rendered here.
 *
 * The scene adapts to any number of items:
 *  N = total habits/tasks for today, M = completed
 *  - the black/gray boundary sits at M/N of the mountain height
 *  - exactly N checkpoint markers sit on the trail, the first M carry a check
 * The proportions mirror the reference design (assets/widget_1 reference):
 * large rounded card, faceted mountain, pure-black completed area, soft gray
 * incomplete area, black foreground ridge, serpentine light trail.
 */
object HabitWidgetArt {

    data class Marker(val cx: Float, val cy: Float, val r: Float)

    // ---- palette (grayscale only, matching the reference) ----
    private const val BG_DARK = 0xFF1C1C1E.toInt()
    private const val BG_LIGHT = 0xFFF2F2F7.toInt()
    private const val GRAY_INCOMPLETE = 0xFF9CA3AF.toInt()   // noticeable soft gray, both themes
    private const val GRAY_FACET = 0xFF8B9099.toInt()        // darker facet shade
    private const val BLACK = 0xFF000000.toInt()             // completed area
    private val TRAIL_DARK = 0xC8C8CD                       // light gray trail on dark card
    private val TRAIL_LIGHT = 0xFF6B7280.toInt()            // dark gray trail on light card
    private const val MARKER_ON_DARK = 0xFFF2F2F7.toInt()
    private const val MARKER_OFF_DARK = 0xB8FFFFFF.toInt()     // translucent white marker
    private const val MARKER_ON_LIGHT = 0xFFFFFFFF.toInt()
    private const val MARKER_OFF_LIGHT = 0x991F1F1F.toInt()
    private const val CHECK_INK_DARK = 0xFF1C1C1E.toInt()
    private const val CHECK_INK_LIGHT = 0xFF1C1C1E.toInt()

    /** Where the trail path runs, as fractions of the mountain box. */
    private val TRAIL_FRACTIONS = listOf(0.16f, 0.42f, 0.60f, 0.88f)

    /**
     * Render one frame of the widget.
     *
     * @param widthPx / heightPx bitmap size, normally the widget's cell size in px
     * @param total items scheduled today (0 shows the empty state)
     * @param completed items done (clamped to total)
     */
    fun render(
        widthPx: Int,
        heightPx: Int,
        total: Int,
        completed: Int,
        isDark: Boolean
    ): Bitmap {
        val bmp = Bitmap.createBitmap(max(widthPx, 1), max(heightPx, 1), Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bmp)
        val w = bmp.width.toFloat()
        val h = bmp.height.toFloat()

        val s = min(w, h)                     // short side, drives all proportions
        val isLight = !isDark

        // ---------- card ----------
        val bg = if (isLight) BG_LIGHT else BG_DARK
        val cardPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = bg }
        val cardRect = RectF(0f, 0f, w, h)
        val radius = h * 0.16f
        canvas.drawRoundRect(cardRect, radius, radius, cardPaint)
        if (!isLight) {
            val edge = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = 0xFF2C2C2E.toInt(); style = Paint.Style.STROKE; strokeWidth = s * 0.008f
            }
            canvas.drawRoundRect(cardRect, radius, radius, edge)
        }

        // ---------- mountain box ----------
        // The text occupies the left third; the mountain fills the rest.
        val textWidth = w * 0.30f
        val marginX = w * 0.045f
        val topY = h * 0.13f
        val baseline = h * 0.84f
        val mLeft = textWidth + marginX * 0.6f
        val mRight = w - marginX * 0.7f
        val apexX = mLeft + (mRight - mLeft) * 0.56f
        val mountainHeight = baseline - topY

        val mountain = Path().apply {
            moveTo(apexX, topY)
            lineTo(mRight, baseline)
            lineTo(mLeft, baseline)
            close()
        }

        // incomplete side (whole silhouette), then facet shading over it
        val gray = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = GRAY_INCOMPLETE }
        canvas.drawPath(mountain, gray)

        // facet shading: a lighter band down the left slope, a darker one on the right
        val facetDark = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = GRAY_FACET
            alpha = if (isLight) 120 else 170
        }
        val facetLeft = Path().apply {           // left slope slice
            moveTo(apexX, topY)
            lineTo(mLeft + (apexX - mLeft) * 0.28f, baseline)
            lineTo(mLeft, baseline)
            close()
        }
        val facetRight = Path().apply {          // steeper right slice
            moveTo(apexX, topY)
            lineTo(mRight, baseline)
            lineTo(apexX + (mRight - apexX) * 0.28f, baseline)
            close()
        }
        canvas.drawPath(facetLeft, facetDark)
        canvas.drawPath(facetRight, facetDark)

        val highlight = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE; alpha = if (isLight) 46 else 30
        }
        val facetMid = Path().apply {
            moveTo(apexX, topY)
            lineTo(apexX - (apexX - mLeft) * 0.10f, baseline)
            lineTo(mLeft + (apexX - mLeft) * 0.16f, baseline)
            close()
        }
        canvas.drawPath(facetMid, highlight)

        // ---------- completed area ----------
        val clampedCompleted = completed.coerceIn(0, max(total, 0))
        val boundaryY = if (total <= 0) baseline
        else baseline - mountainHeight * (clampedCompleted.toFloat() / total.toFloat())

        val completedClip = canvas.save()
        canvas.clipRect(0f, boundaryY, w, h)
        val black = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = BLACK }
        canvas.drawPath(mountain, black)
        // subtle facet in the black mass so it is not a flat silhouette
        val blackFacet = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.WHITE; alpha = if (isLight) 14 else 20
        }
        val blackFacetPath = Path().apply {
            moveTo(apexX, boundaryY)
            lineTo(apexX - (apexX - mLeft) * 0.30f, baseline)
            lineTo(mLeft, baseline)
            close()
        }
        canvas.drawPath(blackFacetPath, blackFacet)
        canvas.restoreToCount(completedClip)

        // the black/gray boundary needs no drawn line: the two fills meet cleanly,
        // exactly as in the reference art.

        // ---------- foreground ridge (depth, always black) ----------
        val ridge = Path().apply {
            moveTo(0f, h)
            lineTo(0f, h * 0.93f)
            quadTo(w * 0.16f, h * 0.85f, w * 0.34f, h * 0.93f)
            quadTo(w * 0.46f, h * 0.99f, w * 0.60f, h * 0.93f)
            quadTo(w * 0.80f, h * 0.86f, w, h * 0.96f)
            lineTo(w, h)
            close()
        }
        canvas.drawPath(ridge, black)

        // mountain outline so it reads against the card
        val outline = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.BLACK; style = Paint.Style.STROKE
            strokeWidth = s * 0.007f; alpha = if (isLight) 60 else 90
        }
        canvas.drawPath(mountain, outline)

        // ---------- winding trail ----------
        val trail = Path().apply {
            val (x0, y0) = trailPoint(mLeft, mRight, apexX, topY, baseline, TRAIL_FRACTIONS[0])
            moveTo(x0, y0)
            var prevX = x0; var prevY = y0
            for (f in TRAIL_FRACTIONS.drop(1)) {
                val (nx, ny) = trailPoint(mLeft, mRight, apexX, topY, baseline, f)
                val sway = (nx - prevX) * 0.28f
                quadTo(prevX + sway, prevY - (prevY - ny) * 0.45f, nx, ny)
                prevX = nx; prevY = ny
            }
        }
        val trailPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = if (isLight) TRAIL_LIGHT else TRAIL_DARK
            style = Paint.Style.STROKE
            strokeWidth = s * 0.022f
            strokeCap = Paint.Cap.ROUND
        }
        canvas.drawPath(trail, trailPaint)

        // ---------- checkpoints ----------
        val markers = markerCenters(widthPx, heightPx, total)
        markers.forEachIndexed { i, m ->
            val done = i < clampedCompleted
            val fill = when {
                done && isLight -> MARKER_ON_LIGHT
                done -> MARKER_ON_DARK
                isLight -> MARKER_OFF_LIGHT
                else -> MARKER_OFF_DARK
            }
            val markerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = fill }
            canvas.drawCircle(m.cx, m.cy, m.r, markerPaint)
            val ring = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = if (isLight) Color.BLACK else Color.WHITE
                style = Paint.Style.STROKE
                strokeWidth = max(s * 0.006f, 1f); alpha = if (done) 255 else 110
            }
            canvas.drawCircle(m.cx, m.cy, m.r, ring)

            if (done) {
                val ink = if (isLight) CHECK_INK_LIGHT else CHECK_INK_DARK
                val check = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    color = ink; style = Paint.Style.STROKE
                    strokeWidth = max(m.r * 0.26f, 1.2f)
                    strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND
                }
                val p = Path().apply {
                    moveTo(m.cx - m.r * 0.42f, m.cy + m.r * 0.02f)
                    lineTo(m.cx - m.r * 0.10f, m.cy + m.r * 0.34f)
                    lineTo(m.cx + m.r * 0.45f, m.cy - m.r * 0.32f)
                }
                canvas.drawPath(p, check)
            }
        }

        // ---------- labels ----------
        val labelColor = if (isLight) 0xFF3F3F46.toInt() else 0xFF9CA3AF.toInt()
        val numberColor = if (isLight) Color.BLACK else Color.WHITE
        if (total > 0) {
            val big = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = numberColor
                typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
                textSize = h * 0.40f
            }
            val small = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = labelColor
                typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.NORMAL)
                textSize = h * 0.135f
            }
            val x = w * 0.06f
            canvas.drawText("$clampedCompleted/$total", x, h * 0.52f, big)
            canvas.drawText("complete", x, h * 0.52f + small.textSize * 1.5f, small)
        } else {
            val empty = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = labelColor
                typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.NORMAL)
                textSize = h * 0.13f
            }
            val line1 = Paint(empty).apply { color = if (isLight) Color.BLACK else Color.WHITE; textSize = h * 0.22f; typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD) }
            canvas.drawText("No habits", w * 0.06f, h * 0.48f, line1)
            canvas.drawText("today", w * 0.06f, h * 0.48f + empty.textSize * 1.5f, empty)
        }

        return bmp
    }

    /**
     * Checkpoint centres for the current geometry. The provider uses this to
     * build tap targets that line up with the drawn markers.
     */
    fun markerCenters(widthPx: Int, heightPx: Int, total: Int): List<Marker> {
        val w = max(widthPx, 1).toFloat()
        val h = max(heightPx, 1).toFloat()
        val s = min(w, h)
        val n = total.coerceIn(0, 8)

        val textWidth = w * 0.30f
        val marginX = w * 0.045f
        val topY = h * 0.13f
        val baseline = h * 0.84f
        val mLeft = textWidth + marginX * 0.6f
        val mRight = w - marginX * 0.7f
        val apexX = mLeft + (mRight - mLeft) * 0.56f

        val trail = Path().apply {
            val (x0, y0) = trailPoint(mLeft, mRight, apexX, topY, baseline, TRAIL_FRACTIONS[0])
            moveTo(x0, y0)
            var px = x0; var py = y0
            for (f in TRAIL_FRACTIONS.drop(1)) {
                val (nx, ny) = trailPoint(mLeft, mRight, apexX, topY, baseline, f)
                val sway = (nx - px) * 0.28f
                quadTo(px + sway, py - (py - ny) * 0.45f, nx, ny)
                px = nx; py = ny
            }
        }

        if (n == 0) return emptyList()
        val measure = PathMeasure(trail, false)
        val length = measure.length
        // keep the first marker just off the start and the last just before the summit
        val first = 0.06f
        val last = 0.94f
        val step = (last - first) / (n - 1).coerceAtLeast(1)
        val r = s * 0.040f * (1f - 0.12f * n / 8f)
        return (0 until n).map { i ->
            val d = length * (first + step * i)
            val pos = FloatArray(2)
            measure.getPosTan(d, pos, null)
            Marker(pos[0], pos[1], r)
        }
    }

    /** A point on the trail at a 0..1 fraction of the climb. */
    private fun trailPoint(
        mLeft: Float, mRight: Float, apexX: Float, topY: Float, baseline: Float, f: Float
    ): Pair<Float, Float> {
        // The mountain narrows toward the apex, so the trail follows that
        // taper: at each height it sits on the slope, never off the silhouette.
        val xLeft = mLeft + (apexX - mLeft) * f
        val xRight = mRight + (apexX - mRight) * f
        val width = xRight - xLeft
        val x = xLeft + width * 0.30f
        val y = baseline - (baseline - topY) * f
        // gentle sway so the trail snakes rather than running straight
        val sway = kotlin.math.sin(f * Math.PI).toFloat() * width * 0.05f
        return Pair(x + sway, y)
    }
}