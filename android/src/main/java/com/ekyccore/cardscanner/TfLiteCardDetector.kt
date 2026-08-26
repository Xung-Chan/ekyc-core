package com.ekyccore.cardscanner

import android.content.Context
import android.util.Log
import org.opencv.core.Mat
import org.opencv.core.Point
import org.opencv.core.Size
import org.opencv.imgproc.Imgproc
import org.tensorflow.lite.Interpreter
import java.io.FileInputStream
import java.nio.ByteBuffer
import java.nio.MappedByteBuffer
import java.nio.channels.FileChannel
import java.util.Locale
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

data class CornersResult(
    val points: List<Point>?,
    val boundingLeft: Double,
    val boundingTop: Double,
    val boundingWidth: Double,
    val boundingHeight: Double,
    val detectionScale: Double
)

class TfLiteCardDetector(context: Context) {

    private val modelBuffer: MappedByteBuffer?
    private val interpreter: Interpreter?
    private val rgbDirect: ByteBuffer?

    private val tfliteBoxes = Array(1) { Array(NUM_CANDIDATES) { FloatArray(4) } }
    private val tfliteClasses = Array(1) { FloatArray(NUM_CANDIDATES) }
    private val tfliteScores = Array(1) { FloatArray(NUM_CANDIDATES) }
    private val tfliteCount = FloatArray(1)
    private val tfliteOutputs: HashMap<Int, Any>

    init {
        var buf: MappedByteBuffer? = null
        var interp: Interpreter? = null
        var rgb: ByteBuffer? = null
        val outMap = HashMap<Int, Any>(4)
        try {
            buf = loadMappedModel(context, MODEL_ASSET_PATH)
            val options = Interpreter.Options().setNumThreads(4).apply {
                try {
                    setUseNNAPI(true)
                } catch (_: Throwable) {}
            }
            interp = Interpreter(buf, options)
            rgb = ByteBuffer.allocateDirect(DET_INPUT * DET_INPUT * 3)
            outMap[0] = tfliteBoxes
            outMap[1] = tfliteClasses
            outMap[2] = tfliteScores
            outMap[3] = tfliteCount
            Log.i(TAG, "TfLite init OK asset=$MODEL_ASSET_PATH — model loaded successfully.")
        } catch (e: Throwable) {
            Log.w(TAG, "TfLite init FAILED asset=$MODEL_ASSET_PATH err=${e.message} — using OpenCV fallback.", e)
            buf = null
            interp = null
            rgb = null
            outMap.clear()
        }
        modelBuffer = buf
        interpreter = interp
        rgbDirect = rgb
        tfliteOutputs = outMap
    }

    fun detectFromBgr(bgr: Mat, scaleToOriginal: Double): CornersResult {
        if (bgr.empty()) {
            return emptyResult(scaleToOriginal)
        }
        val w = bgr.cols()
        val h = bgr.rows()
        if (w <= 0 || h <= 0) {
            return emptyResult(scaleToOriginal)
        }

        val interp = interpreter
        if (interp == null) {
            return emptyResult(scaleToOriginal)
        }

        val resized = Mat()
        try {
            Imgproc.resize(
                bgr,
                resized,
                Size(DET_INPUT.toDouble(), DET_INPUT.toDouble()),
                0.0,
                0.0,
                Imgproc.INTER_LINEAR
            )

            val matBytes = ByteArray((resized.total() * resized.channels()).toInt())
            resized.get(0, 0, matBytes)

            val rgb = rgbDirect!!
            rgb.clear()
            val rowStride = DET_INPUT * 3
            for (y in 0 until DET_INPUT) {
                val row = y * rowStride
                for (x in 0 until DET_INPUT) {
                    val i = row + x * 3
                    rgb.put(matBytes[i + 2])
                    rgb.put(matBytes[i + 1])
                    rgb.put(matBytes[i])
                }
            }
            rgb.rewind()

            interp.runForMultipleInputsOutputs(arrayOf(rgb), tfliteOutputs)

            val n = tfliteCount[0].roundToInt().coerceIn(0, NUM_CANDIDATES)
            val bestScore = HashMap<Int, Float>(4)
            val bestBox = HashMap<Int, FloatArray>(4)

            for (i in 0 until n) {
                val clsId = tfliteClasses[0][i].roundToInt()
                if (clsId < 0 || clsId > 3) {
                    continue
                }
                val s = tfliteScores[0][i]
                val prev = bestScore[clsId] ?: -1f
                if (s > prev) {
                    bestScore[clsId] = s
                    bestBox[clsId] = tfliteBoxes[0][i].clone()
                }
            }

            val insufficientCorners = bestBox.size < 4
            if (insufficientCorners) {
                Log.d(TAG, "TFLite: Insufficient corners detected: ${bestBox.size}/4")
                return emptyResult(scaleToOriginal)
            }

            var ymin = 1.0
            var xmin = 1.0
            var ymax = 0.0
            var xmax = 0.0
            for (b in bestBox.values) {
                ymin = min(ymin, b[0].toDouble())
                xmin = min(xmin, b[1].toDouble())
                ymax = max(ymax, b[2].toDouble())
                xmax = max(xmax, b[3].toDouble())
            }

            val left = xmin * w
            val top = ymin * h
            val right = xmax * w
            val bottom = ymax * h

            val tl = Point(left, top)
            val tr = Point(right, top)
            val br = Point(right, bottom)
            val bl = Point(left, bottom)
            val ordered = CardQuadOrdering.orderQuadPoints(arrayOf(tl, tr, br, bl))
            val list = ordered.map { Point(it.x * scaleToOriginal, it.y * scaleToOriginal) }

            var minX = Double.MAX_VALUE
            var minY = Double.MAX_VALUE
            var maxX = 0.0
            var maxY = 0.0
            for (p in list) {
                minX = min(minX, p.x)
                minY = min(minY, p.y)
                maxX = max(maxX, p.x)
                maxY = max(maxY, p.y)
            }

            val result = CornersResult(
                points = list,
                boundingLeft = minX,
                boundingTop = minY,
                boundingWidth = max(1.0, maxX - minX),
                boundingHeight = max(1.0, maxY - minY),
                detectionScale = scaleToOriginal
            )
            return result
        } catch (e: Throwable) {
            Log.w(TAG, "TFLite invoke error: ${e.message}")
            return emptyResult(scaleToOriginal)
        } finally {
            resized.release()
        }
    }

    private fun emptyResult(scale: Double) = CornersResult(
        points = null,
        boundingLeft = 0.0,
        boundingTop = 0.0,
        boundingWidth = 0.0,
        boundingHeight = 0.0,
        detectionScale = scale
    )

    private fun loadMappedModel(context: Context, assetPath: String): MappedByteBuffer {
        context.assets.openFd(assetPath).use { fd ->
            FileInputStream(fd.fileDescriptor).use { fis ->
                return fis.channel.map(
                    FileChannel.MapMode.READ_ONLY,
                    fd.startOffset,
                    fd.declaredLength
                )
            }
        }
    }

    private companion object {
        const val TAG = "EkycCardDetect"
        const val MODEL_ASSET_PATH = "ml/model1.tflite"
        const val DET_INPUT = 512
        const val NUM_CANDIDATES = 40
    }
}
