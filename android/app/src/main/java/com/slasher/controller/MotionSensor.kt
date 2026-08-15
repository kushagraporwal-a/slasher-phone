package com.slasher.controller

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.util.Log
import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.sign

/**
 * Streams the phone's rotation RATE (radians/second) around two axes,
 * for use as a relative "air mouse" rather than an absolute pointer.
 *
 * This intentionally does not compute or send any absolute orientation.
 * Absolute-angle pointing (phone tilt -> absolute cursor position) was
 * tried first and abandoned: it requires a drift-free absolute reference,
 * which a bare phone doesn't have — the gyroscope alone drifts over time
 * (no reference to correct it), and adding the magnetometer to fix drift
 * introduces noise from nearby electronics. A rate-based "nudge the cursor"
 * model sidesteps both: nothing is ever integrated into a long-lived
 * absolute angle, so a small residual bias just needs to be zeroed (see
 * zero-velocity bias re-estimation below), not fought indefinitely.
 *
 * Axis mapping is grip-specific — it depends on which way the phone is
 * physically held, not just "portrait vs landscape." This is tuned for a
 * horizontal "sword" grip: phone held roughly flat, long axis (top-to-
 * bottom) pointing forward at the target like a blade, screen facing to
 * the side rather than up at the user. For that grip:
 *  - A horizontal slash rotates the blade around the vertical axis, which
 *    for this grip is the device's SHORT axis (values[0]) -> yaw.
 *  - A vertical chop rotates around the axis running screen-to-back,
 *    which is the device's Z axis (values[2]) -> pitch.
 *  - Twisting the wrist around the blade's own forward-pointing axis
 *    (device Y, values[1]) is roll, and is never read, so it cannot leak
 *    into the cursor by construction, not just "in theory."
 * (An earlier version of this file assumed an upright "TV remote" grip —
 * top-to-bottom axis = yaw — which is why twisting the wrist was being
 * misread as a left-right swing for this grip.)
 */
class MotionSensor(context: Context) : SensorEventListener {

    private val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
    private val gyroscope: Sensor? = sensorManager.getDefaultSensor(Sensor.TYPE_GYROSCOPE)

    private var biasPitchRate = 0f
    private var biasYawRate = 0f
    private var smoothedPitchRate = 0f
    private var smoothedYawRate = 0f
    private var stillSinceNanos = 0L
    private var lastLogNanos = 0L

    @Volatile
    var latestYawRate: Float = 0f
        private set

    @Volatile
    var latestPitchRate: Float = 0f
        private set

    val isAvailable: Boolean
        get() = gyroscope != null

    fun start() {
        gyroscope?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME)
        }
    }

    fun stop() {
        sensorManager.unregisterListener(this)
        stillSinceNanos = 0L
    }

    override fun onSensorChanged(event: SensorEvent) {
        // See the sword-grip axis mapping explained in the class doc above.
        // If left/right or up/down comes out backwards, flip the sign on
        // the corresponding line below (that's the fast, safe fix — the
        // AXIS choice itself, i.e. which values[i] to read, is the part
        // that's specific to how the phone is held).
        val rawYawRate = event.values[0]
        val rawPitchRate = event.values[2]

        // Zero-velocity bias re-estimation: whenever the raw signal has
        // been near-zero for a sustained stretch, slowly pull the bias
        // estimate towards the current reading. This is what actually
        // cancels the gyro's resting bias (the root cause of drift),
        // rather than just filtering its symptoms — and it keeps adapting
        // if the true bias wanders (e.g. with temperature), with no
        // explicit calibration step required from the user.
        val magnitude = hypot(rawPitchRate.toDouble(), rawYawRate.toDouble())
        if (magnitude < STILLNESS_THRESHOLD_RAD_S) {
            if (stillSinceNanos == 0L) stillSinceNanos = event.timestamp
            if (event.timestamp - stillSinceNanos > STILLNESS_DURATION_NANOS) {
                biasPitchRate += BIAS_LEARN_RATE * (rawPitchRate - biasPitchRate)
                biasYawRate += BIAS_LEARN_RATE * (rawYawRate - biasYawRate)
            }
        } else {
            stillSinceNanos = 0L
        }

        val correctedPitchRate = rawPitchRate - biasPitchRate
        val correctedYawRate = rawYawRate - biasYawRate

        smoothedPitchRate += SMOOTHING_ALPHA * (correctedPitchRate - smoothedPitchRate)
        smoothedYawRate += SMOOTHING_ALPHA * (correctedYawRate - smoothedYawRate)

        // Final dead zone: absorbs whatever residual noise is left so a
        // genuinely still phone contributes exactly zero cursor velocity.
        latestPitchRate = deadzone(smoothedPitchRate, RATE_DEADZONE_RAD_S)
        latestYawRate = deadzone(smoothedYawRate, RATE_DEADZONE_RAD_S)

        // Throttled diagnostic log (~6Hz) — filter logcat with
        // `adb logcat -s SlasherMotion` while doing a specific test motion
        // to see the actual raw axis values and signs, instead of
        // inferring them from a description after the fact.
        if (event.timestamp - lastLogNanos > LOG_INTERVAL_NANOS) {
            lastLogNanos = event.timestamp
            Log.d(
                TAG,
                "raw=(%.2f, %.2f, %.2f) yawRate=%.2f pitchRate=%.2f".format(
                    event.values[0],
                    event.values[1],
                    event.values[2],
                    latestYawRate,
                    latestPitchRate,
                ),
            )
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

    private fun deadzone(value: Float, threshold: Float): Float {
        val magnitude = (abs(value) - threshold).coerceAtLeast(0f)
        return sign(value) * magnitude
    }

    private companion object {
        const val SMOOTHING_ALPHA = 0.3f

        // Below this combined rate, the phone is considered "still" for
        // bias re-estimation purposes (~2.9 deg/s).
        const val STILLNESS_THRESHOLD_RAD_S = 0.05f

        // How long the phone must stay under the stillness threshold
        // before we start trusting it as a bias sample.
        const val STILLNESS_DURATION_NANOS = 300_000_000L

        // How fast the bias estimate adapts once stillness is confirmed —
        // slow enough that a deliberate stop-and-hold doesn't overcorrect
        // in one sample.
        const val BIAS_LEARN_RATE = 0.05f

        // Final safety-net dead zone in rad/s (~0.6 deg/s).
        const val RATE_DEADZONE_RAD_S = 0.01f

        private const val TAG = "SlasherMotion"
        private const val LOG_INTERVAL_NANOS = 150_000_000L
    }
}
