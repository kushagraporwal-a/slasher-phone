package com.slasher.controller

import android.os.Handler
import android.os.Looper
import java.util.concurrent.TimeUnit
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener

enum class ConnectionState { DISCONNECTED, CONNECTING, CONNECTED }

/**
 * Manages the WebSocket connection to the laptop relay server. Streams raw
 * rotation-rate samples; all game logic lives on the web side.
 *
 * Auto-reconnects every [RECONNECT_DELAY_MS] while the user hasn't pressed
 * Disconnect, so a brief Wi-Fi hiccup self-heals. [pause]/[resume] are for
 * Activity lifecycle events (screen lock, app switch) — they stop network
 * activity without discarding the user's "should be connected" intent, so
 * [resume] reopens the same connection.
 */
class SocketClient(private val onStateChanged: (ConnectionState) -> Unit) {

    private val client = OkHttpClient.Builder()
        .pingInterval(20, TimeUnit.SECONDS)
        .build()

    private val mainHandler = Handler(Looper.getMainLooper())
    private val reconnectRunnable = Runnable { openSocket() }

    private var webSocket: WebSocket? = null
    private var host: String = ""
    private var port: Int = 8080
    private var shouldStayConnected = false
    private var isPaused = false

    fun connect(host: String, port: Int) {
        this.host = host
        this.port = port
        shouldStayConnected = true
        isPaused = false
        mainHandler.removeCallbacks(reconnectRunnable)
        openSocket()
    }

    fun disconnect() {
        shouldStayConnected = false
        mainHandler.removeCallbacks(reconnectRunnable)
        webSocket?.close(1000, "user disconnected")
        webSocket = null
        setState(ConnectionState.DISCONNECTED)
    }

    fun pause() {
        isPaused = true
        mainHandler.removeCallbacks(reconnectRunnable)
        webSocket?.cancel()
        webSocket = null
    }

    fun resume() {
        isPaused = false
        if (shouldStayConnected) openSocket()
    }

    fun sendMotion(yawRate: Float, pitchRate: Float, timestampMs: Long) {
        // Kotlin's Float.toString() is locale-independent (always uses '.'),
        // so plain string interpolation is safe JSON here.
        webSocket?.send(
            """{"type":"motion","yawRate":$yawRate,"pitchRate":$pitchRate,"t":$timestampMs}""",
        )
    }

    private fun openSocket() {
        setState(ConnectionState.CONNECTING)
        val request = Request.Builder().url("ws://$host:$port").build()
        webSocket = client.newWebSocket(
            request,
            object : WebSocketListener() {
                override fun onOpen(webSocket: WebSocket, response: Response) {
                    webSocket.send("""{"type":"hello","role":"phone"}""")
                    setState(ConnectionState.CONNECTED)
                }

                override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                    scheduleReconnect()
                }

                override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                    scheduleReconnect()
                }
            },
        )
    }

    private fun scheduleReconnect() {
        setState(ConnectionState.DISCONNECTED)
        if (!shouldStayConnected || isPaused) return
        mainHandler.removeCallbacks(reconnectRunnable)
        mainHandler.postDelayed(reconnectRunnable, RECONNECT_DELAY_MS)
    }

    private fun setState(state: ConnectionState) {
        mainHandler.post { onStateChanged(state) }
    }

    companion object {
        private const val RECONNECT_DELAY_MS = 2000L
    }
}
