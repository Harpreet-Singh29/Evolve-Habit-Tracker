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
    private const val GRAY_FACET_DARK = 0xFF6B7280.toInt()   // darker facet for incomplete
    private const val GRAY_FACET_LIGHT = 0xFF9CA3AF.toInt()  // lighter facet for incomplete (light theme)
    private const val BLACK = 0xFF000000.toInt()             // completed area
    private val TRAIL_DARK = 0xE5E7EB.toInt()                // light trail on dark card
    private val TRAIL_LIGHT = 0xFF4B5563.toInt()             // dark trail on light card
    private const val MARKER_ON_DARK = 0xFFFFFFFF.toInt()
    private const val MARKER_OFF_DARK = 0x80FFFFFF.toInt()   // translucent white marker
    private const val MARKER_ON_LIGHT = 0xFFFFFFFF.toInt()
    private const val MARKER_OFF_LIGHT = 0xFF9CA3AF.toInt()  // gray marker on light
    private const val MARKER_RING_DARK = 0xFFFFFFFF.toInt()
    private const val MARKER_RING_LIGHT = 0xFF1F2937.toInt()
    private const val CHECK_INK_DARK = 0xFF1C1C1E.toInt()
    private const val CHECK_INK_LIGHT = 0xFF1C1C1E.toInt()

    /** Trail control points as fractions of mountain height (0=top, 1=base) */
    private val TRAIL_KNOTS = listOf(0.08f, 0.28f, 0.48f, 0.68f, 0.88f)

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
        val radius = h * 0.14f
        canvas.drawRoundRect(cardRect, radius, radius, cardPaint)
        if (!isLight) {
            val edge = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = 0xFF2C2C2E.toInt(); style = Paint.Style.STROKE; strokeWidth = s * 0.006f
            }
            canvas.drawRoundRect(cardRect, radius, radius, edge)
        }

        // ---------- mountain geometry ----------
        // Text on left ~28%, mountain on right ~72%
        val textWidth = w * 0.28f
        val marginX = w * 0.04f
        val topY = h * 0.10f
        val baseline = h * 0.88f
        val mLeft = textWidth + marginX * 0.5f
        val mRight = w - marginX * 0.6f
        val mountainHeight = baseline - topY

        // Mountain silhouette with multiple facets (asymmetric, natural)
        val mountain = buildMountainPath(mLeft, mRight, apexX(mLeft, mRight), topY, baseline)

        // ---------- incomplete mountain (full silhouette in soft gray) ----------
        val grayPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = GRAY_INCOMPLETE }
        canvas.drawPath(mountain, grayPaint)

        // ---------- facet shading on incomplete area ----------
        drawFacets(canvas, mountain, mLeft, mRight, apexX(mLeft, mRight), topY, baseline, isLight, false)

        // ---------- completed area (black) ----------
        val clampedCompleted = completed.coerceIn(0, max(total, 0))
        val progressRatio = if (total <= 0) 0f else clampedCompleted.toFloat() / total.toFloat()
        val boundaryY = baseline - mountainHeight * progressRatio

        val completedClip = canvas.save()
        canvas.clipRect(0f, boundaryY, w, h)
        val blackPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = BLACK }
        canvas.drawPath(mountain, blackPaint)
        // Subtle facet lines in the black area for depth
        drawFacets(canvas, mountain, mLeft, mRight, apexX(mLeft, mRight), boundaryY, baseline, isLight, true)
        canvas.restoreToCount(completedClip)

        // ---------- foreground ridge (always black, adds depth) ----------
        val ridge = buildRidgePath(w, h)
        canvas.drawPath(ridge, blackPaint)

        // ---------- mountain outline ----------
        val outlinePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.BLACK; style = Paint.Style.STROKE
            strokeWidth = s * 0.005f; alpha = if (isLight) 50 else 80
        }
        canvas.drawPath(mountain, outlinePaint)

        // ---------- winding trail ----------
        val trail = buildTrailPath(mLeft, mRight, apexX(mLeft, mRight), topY, baseline)
        val trailPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = if (isLight) TRAIL_LIGHT else TRAIL_DARK
            style = Paint.Style.STROKE
            strokeWidth = s * 0.020f
            strokeCap = Paint.Cap.ROUND
            strokeJoin = Paint.Join.ROUND
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
            
            // Ring
            val ringPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = if (isLight) MARKER_RING_LIGHT else MARKER_RING_DARK
                style = Paint.Style.STROKE
                strokeWidth = max(s * 0.005f, 1f); alpha = if (done) 255 else 140
            }
            canvas.drawCircle(m.cx, m.cy, m.r, ringPaint)

            if (done) {
                val ink = if (isLight) CHECK_INK_LIGHT else CHECK_INK_DARK
                val checkPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    color = ink; style = Paint.Style.STROKE
                    strokeWidth = max(m.r * 0.28f, 1.4f)
                    strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND
                }
                val checkPath = Path().apply {
                    moveTo(m.cx - m.r * 0.40f, m.cy + m.r * 0.05f)
                    lineTo(m.cx - m.r * 0.08f, m.cy + m.r * 0.38f)
                    lineTo(m.cx + m.r * 0.42f, m.cy - m.r * 0.35f)
                }
                canvas.drawPath(checkPath, checkPaint)
            }
        }

        // ---------- labels ----------
        val labelColor = if (isLight) 0xFF4B5563.toInt() else 0xFF9CA3AF.toInt()
        val numberColor = if (isLight) Color.BLACK else Color.WHITE
        if (total > 0) {
            val big = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = numberColor
                typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
                textSize = h * 0.38f
            }
            val small = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = labelColor
                typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.NORMAL)
                textSize = h * 0.12f
            }
            val x = w * 0.05f
            val baselineY = h * 0.50f
            canvas.drawText("$clampedCompleted/$total", x, baselineY, big)
            canvas.drawText("complete", x, baselineY + small.textSize * 1.6f, small)
        } else {
            val emptyLabel = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = labelColor
                typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.NORMAL)
                textSize = h * 0.12f
            }
            val line1 = Paint(emptyLabel).apply { 
                color = if (isLight) Color.BLACK else Color.WHITE; 
                textSize = h * 0.20f; 
                typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD) 
            }
            canvas.drawText("No habits", w * 0.05f, h * 0.46f, line1)
            canvas.drawText("today", w * 0.05f, h * 0.46f + emptyLabel.textSize * 1.6f, emptyLabel)
        }

        return bmp
    }

    /** Build the faceted mountain silhouette path. */
    private fun buildMountainPath(mLeft: Float, mRight: Float, apexX: Float, topY: Float, baseline: Float): Path {
        return Path().apply {
            moveTo(mLeft, baseline)
            // Left slope: gentle curve outward, then steeper inward
            lineTo(mLeft + (apexX - mLeft) * 0.15f, topY + (baseline - topY) * 0.75f)
            lineTo(mLeft + (apexX - mLeft) * 0.35f, topY + (baseline - topY) * 0.45f)
            lineTo(apexX, topY)
            // Right slope: steeper, more angular
            lineTo(mRight - (mRight - apexX) * 0.12f, topY + (baseline - topY) * 0.35f)
            lineTo(mRight - (mRight - apexX) * 0.28f, topY + (baseline - topY) * 0.65f)
            lineTo(mRight, baseline)
            close()
        }
    }

    /** Apex X position (slightly left of center for asymmetry). */
    private fun apexX(mLeft: Float, mRight: Float): Float = mLeft + (mRight - mLeft) * 0.52f

    /** Draw facet lines on mountain (incomplete or completed area). */
    private fun drawFacets(
        canvas: Canvas,
        mountain: Path,
        mLeft: Float, mRight: Float, apexX: Float, topY: Float, baseline: Float,
        isLight: Boolean,
        isCompleted: Boolean
    ) {
        val facetColor = if (isCompleted) Color.WHITE else (if (isLight) GRAY_FACET_LIGHT else GRAY_FACET_DARK)
        val facetAlpha = if (isCompleted) (if (isLight) 18 else 24) else (if (isLight) 100 else 140)

        val facetPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = facetColor; alpha = facetAlpha }

        // Left facet (main ridge)
        val leftFacet = Path().apply {
            moveTo(apexX, topY)
            lineTo(mLeft + (apexX - mLeft) * 0.22f, baseline)
            lineTo(mLeft + (apexX - mLeft) * 0.12f, baseline)
            close()
        }
        canvas.drawPath(leftFacet, facetPaint)

        // Right facet (steeper ridge)
        val rightFacet = Path().apply {
            moveTo(apexX, topY)
            lineTo(mRight - (mRight - apexX) * 0.18f, baseline)
            lineTo(mRight - (mRight - apexX) * 0.08f, baseline)
            close()
        }
        canvas.drawPath(rightFacet, facetPaint)

        // Center highlight ridge (subtle)
        if (!isCompleted) {
            val highlightPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = Color.WHITE; alpha = if (isLight) 35 else 25
            }
            val centerFacet = Path().apply {
                moveTo(apexX, topY)
                lineTo(apexX - (apexX - mLeft) * 0.06f, baseline)
                lineTo(mLeft + (apexX - mLeft) * 0.08f, baseline)
                close()
            }
            canvas.drawPath(centerFacet, highlightPaint)
        }
    }

    /** Build the foreground ridge path (bottom depth layer). */
    private fun buildRidgePath(w: Float, h: Float): Path {
        return Path().apply {
            moveTo(0f, h)
            lineTo(0f, h * 0.94f)
            quadTo(w * 0.12f, h * 0.88f, w * 0.28f, h * 0.94f)
            quadTo(w * 0.42f, h * 1.00f, w * 0.55f, h * 0.93f)
            quadTo(w * 0.72f, h * 0.85f, w * 0.85f, h * 0.95f)
            quadTo(w * 0.95f, h * 0.99f, w, h * 0.96f)
            lineTo(w, h)
            close()
        }
    }

    /** Build the serpentine trail path weaving up the mountain. */
    private fun buildTrailPath(mLeft: Float, mRight: Float, apexX: Float, topY: Float, baseline: Float): Path {
        val path = Path()
        var first = true
        
        for (knot in TRAIL_KNOTS) {
            val (x, y) = trailPointAtFraction(mLeft, mRight, apexX, topY, baseline, knot)
            if (first) {
                path.moveTo(x, y)
                first = false
            } else {
                // Smooth curve to next point
                path.lineTo(x, y)
            }
        }
        
        // Smooth the path with quadratic curves between points
        return smoothPath(path)
    }

    /** Get trail point at a fraction (0=top, 1=base) following mountain contour. */
    private fun trailPointAtFraction(
        mLeft: Float, mRight: Float, apexX: Float, topY: Float, baseline: Float, f: Float
    ): Pair<Float, Float> {
        // Mountain narrows toward apex - trail follows the slope
        val y = baseline - (baseline - topY) * f
        
        // Left and right edges of mountain at this height
        val leftEdgeX = mLeft + (apexX - mLeft) * f
        val rightEdgeX = mRight + (apexX - mRight) * f
        val width = rightEdgeX - leftEdgeX
        
        // Trail position: 35% from left edge (slightly left of center for natural look)
        var x = leftEdgeX + width * 0.35f
        
        // Add organic sway - serpentine weaving
        val swayAmplitude = width * 0.08f
        val sway = kotlin.math.sin(f * Math.PI * 2.5).toFloat() * swayAmplitude
        x += sway
        
        // Secondary subtle sway
        val sway2 = kotlin.math.sin(f * Math.PI * 5.0 + 1.2).toFloat() * (swayAmplitude * 0.3f)
        x += sway2
        
        // Clamp to stay within mountain bounds (with small margin)
        val margin = width * 0.06f
        x = x.coerceIn(leftEdgeX + margin, rightEdgeX - margin)
        
        return Pair(x, y)
    }

    /** Smooth a path by converting line segments to quadratic curves. */
    private fun smoothPath(path: Path): Path {
        val measure = PathMeasure(path, false)
        val length = measure.length
        val smoothed = Path()
        
        // Sample points along the path
        val numSamples = 20
        val points = mutableListOf<Pair<Float, Float>>()
        
        for (i in 0..numSamples) {
            val dist = length * i / numSamples
            val pos = FloatArray(2)
            measure.getPosTan(dist, pos, null)
            points.add(Pair(pos[0], pos[1]))
        }
        
        if (points.isNotEmpty()) {
            smoothed.moveTo(points[0].first, points[0].second)
            for (i in 1 until points.size - 1) {
                val p0 = points[i - 1]
                val p1 = points[i]
                val p2 = points[i + 1]
                
                // Quadratic curve through p1 with control point between p0 and p2
                val ctrlX = (p0.first + p2.first) * 0.5f
                val ctrlY = (p0.second + p2.second) * 0.5f
                smoothed.quadTo(ctrlX, ctrlY, p1.first, p1.second)
            }
            // Last segment
            if (points.size >= 2) {
                val last = points.last()
                val prev = points[points.size - 2]
                smoothed.lineTo(last.first, last.second)
            }
        }
        
        return smoothed
    }

    /** Checkpoint centres for the current geometry. */
    fun markerCenters(widthPx: Int, heightPx: Int, total: Int): List<Marker> {
        val w = max(widthPx, 1).toFloat()
        val h = max(heightPx, 1).toFloat()
        val s = min(w, h)
        val n = total.coerceIn(0, 8)

        val textWidth = w * 0.28f
        val marginX = w * 0.04f
        val topY = h * 0.10f
        val baseline = h * 0.88f
        val mLeft = textWidth + marginX * 0.5f
        val mRight = w - marginX * 0.6f
        val aX = apexX(mLeft, mRight)

        val trail = buildTrailPath(mLeft, mRight, aX, topY, baseline)

        if (n == 0) return emptyList()
        val measure = PathMeasure(trail, false)
        val length = measure.length
        
        // Distribute markers along trail: first near bottom, last near top
        val first = 0.08f
        val last = 0.92f
        val step = (last - first) / (n - 1).coerceAtLeast(1)
        val r = s * 0.038f * (1f - 0.10f * n / 8f)
        
        return (0 until n).map { i ->
            val d = length * (first + step * i)
            val pos = FloatArray(2)
            measure.getPosTan(d, pos, null)
            Marker(pos[0], pos[1], r)
        }
    }
}