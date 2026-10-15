package com.nyx

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.core.DeviceEventManagerModule

object NyxOverlayEventBridge {
  const val VOICE_COMMAND_EVENT = "nyxOverlayVoiceCommand"
  const val STOP_SPEAKING_EVENT = "nyxOverlayStopSpeaking"

  private var reactContext: ReactApplicationContext? = null
  private var listenerCount = 0

  @Synchronized
  fun attach(context: ReactApplicationContext) {
    reactContext = context
  }

  @Synchronized
  fun detach(context: ReactApplicationContext) {
    if (reactContext === context) {
      reactContext = null
      listenerCount = 0
    }
  }

  @Synchronized
  fun addListener() {
    listenerCount += 1
  }

  @Synchronized
  fun removeListeners(count: Int) {
    listenerCount = (listenerCount - count).coerceAtLeast(0)
  }

  @Synchronized
  fun emitVoiceCommand(transcript: String): Boolean {
    val context = reactContext
    if (context == null || listenerCount == 0 || !context.hasActiveReactInstance()) {
      return false
    }

    val payload = Arguments.createMap().apply {
      putString("transcript", transcript)
    }
    context
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(VOICE_COMMAND_EVENT, payload)
    return true
  }

  @Synchronized
  fun emitStopSpeaking(): Boolean {
    val context = reactContext
    if (context == null || listenerCount == 0 || !context.hasActiveReactInstance()) {
      return false
    }

    context
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(STOP_SPEAKING_EVENT, null)
    return true
  }
}
