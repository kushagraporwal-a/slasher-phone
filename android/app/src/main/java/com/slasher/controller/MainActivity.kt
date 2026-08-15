package com.slasher.controller

import android.content.Context
import android.content.SharedPreferences
import android.os.Bundle
import android.view.Choreographer
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp

class MainActivity : ComponentActivity() {

    private lateinit var motionSensor: MotionSensor
    private lateinit var socketClient: SocketClient
    private lateinit var prefs: SharedPreferences

    private val connectionState = mutableStateOf(ConnectionState.DISCONNECTED)

    private val frameCallback = object : Choreographer.FrameCallback {
        override fun doFrame(frameTimeNanos: Long) {
            if (connectionState.value == ConnectionState.CONNECTED) {
                socketClient.sendMotion(
                    motionSensor.latestYawRate,
                    motionSensor.latestPitchRate,
                    System.currentTimeMillis(),
                )
            }
            Choreographer.getInstance().postFrameCallback(this)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        prefs = getSharedPreferences("slasher_prefs", Context.MODE_PRIVATE)
        motionSensor = MotionSensor(this)
        socketClient = SocketClient { state -> connectionState.value = state }

        setContent {
            MaterialTheme {
                ControllerScreen(
                    connectionState = connectionState.value,
                    initialHost = prefs.getString(PREF_HOST, "") ?: "",
                    initialPort = prefs.getString(PREF_PORT, "8080") ?: "8080",
                    sensorAvailable = motionSensor.isAvailable,
                    onConnect = { host, port ->
                        prefs.edit().putString(PREF_HOST, host).putString(PREF_PORT, port).apply()
                        socketClient.connect(host, port.toIntOrNull() ?: 8080)
                    },
                    onDisconnect = { socketClient.disconnect() },
                )
            }
        }
    }

    override fun onResume() {
        super.onResume()
        motionSensor.start()
        socketClient.resume()
        Choreographer.getInstance().postFrameCallback(frameCallback)
    }

    override fun onPause() {
        super.onPause()
        Choreographer.getInstance().removeFrameCallback(frameCallback)
        motionSensor.stop()
        socketClient.pause()
    }

    private companion object {
        const val PREF_HOST = "host"
        const val PREF_PORT = "port"
    }
}

@Composable
private fun ControllerScreen(
    connectionState: ConnectionState,
    initialHost: String,
    initialPort: String,
    sensorAvailable: Boolean,
    onConnect: (host: String, port: String) -> Unit,
    onDisconnect: () -> Unit,
) {
    var host by remember { mutableStateOf(initialHost) }
    var port by remember { mutableStateOf(initialPort) }
    val editable = connectionState == ConnectionState.DISCONNECTED

    Surface(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text("Slasher Controller", style = MaterialTheme.typography.headlineSmall)

            if (!sensorAvailable) {
                Text(
                    "This device has no gyroscope — the controller cannot work.",
                    color = MaterialTheme.colorScheme.error,
                )
            }

            StatusRow(connectionState)

            OutlinedTextField(
                value = host,
                onValueChange = { host = it },
                label = { Text("Laptop IP address") },
                singleLine = true,
                enabled = editable,
                modifier = Modifier.fillMaxWidth(),
            )

            OutlinedTextField(
                value = port,
                onValueChange = { port = it.filter(Char::isDigit) },
                label = { Text("Port") },
                singleLine = true,
                enabled = editable,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth(),
            )

            Button(
                onClick = {
                    if (editable) onConnect(host.trim(), port.trim()) else onDisconnect()
                },
                enabled = sensorAvailable && (editable && host.isNotBlank() && port.isNotBlank() || !editable),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(if (editable) "Connect" else "Disconnect")
            }

            Text(
                "Hold the phone upright like a remote pointed at the laptop screen. " +
                    "Once connected, press Calibrate on the web page to start playing.",
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}

@Composable
private fun StatusRow(state: ConnectionState) {
    val (label, color) = when (state) {
        ConnectionState.DISCONNECTED -> "Disconnected" to MaterialTheme.colorScheme.error
        ConnectionState.CONNECTING -> "Connecting…" to MaterialTheme.colorScheme.tertiary
        ConnectionState.CONNECTED -> "Connected" to MaterialTheme.colorScheme.primary
    }
    Row(verticalAlignment = Alignment.CenterVertically) {
        Spacer(
            modifier = Modifier
                .size(12.dp)
                .background(color, shape = CircleShape),
        )
        Spacer(modifier = Modifier.width(8.dp))
        Text(label)
    }
}
