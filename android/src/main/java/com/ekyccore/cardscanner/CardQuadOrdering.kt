package com.ekyccore.cardscanner

import org.opencv.core.Point
import kotlin.math.max

/**
 * Order quad: top-left, top-right, bottom-right, bottom-left (screen coords, y down).
 * Shared by OpenCV and [TfLiteCardDetector].
 */
internal object CardQuadOrdering {
    fun orderQuadPoints(pts: Array<Point>): Array<Point> {
        val sortedBySum = pts.sortedBy { it.x + it.y }
        val tl = sortedBySum.first()
        val br = sortedBySum.last()
        val remaining = pts.filter { it != tl && it != br }
        if (remaining.size >= 2) {
            val tr = remaining.maxByOrNull { it.x }!!
            val bl = remaining.minByOrNull { it.x }!!
            return arrayOf(tl, tr, br, bl)
        }
        val byY = pts.sortedBy { it.y }
        val top = byY.take(2).sortedBy { it.x }.toTypedArray()
        val bottom = byY.takeLast(2).sortedBy { it.x }.toTypedArray()
        return arrayOf(top[0], top[1], bottom[1], bottom[0])
    }
}
