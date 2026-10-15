package com.nyx

import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.WindowManager
import androidx.core.content.ContextCompat
import kotlin.math.abs

class NyxOverlayService : Service() {
  companion object {
    const val ACTION_VOICE_RESULT = "com.nyx.overlay.VOICE_RESULT"
    const val ACTION_VOICE_ERROR = "com.nyx.overlay.VOICE_ERROR"
    const val ACTION_UPDATE_STATE = "com.nyx.overlay.UPDATE_STATE"
    const val EXTRA_TRANSCRIPT = "transcript"
    const val EXTRA_MESSAGE = "message"
    const val EXTRA_STATE = "state"

    private const val PROCESSING_TIMEOUT_MS = 15_000L
    private const val SUCCESS_AUTO_CLOSE_DELAY_MS = 1_200L

    @Volatile
    var isRunning: Boolean = false
      private set
  }

  private val mainHandler = Handler(Looper.getMainLooper())
  private val processingTimeout = Runnable {
    updatePanel(
      OverlayUiState.ERROR,
      "O processamento demorou demais. Abra o Nyx e tente novamente.",
    )
  }
  private val closePanelAfterSuccess = Runnable {
    overlayView?.apply {
      updateState(OverlayUiState.IDLE, "Pronta para ajudar.")
      closePanel()
    }
    refreshWindowBounds()
  }
  private var windowManager: WindowManager? = null
  private var overlayView: NyxOverlayView? = null
  private var windowParams: WindowManager.LayoutParams? = null
  private var receiverRegistered = false
  private val overlayReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      handleOverlayAction(intent)
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()

    if (!Settings.canDrawOverlays(this)) {
      stopSelf()
      return
    }

    try {
      ContextCompat.registerReceiver(
        this,
        overlayReceiver,
        IntentFilter().apply {
          addAction(ACTION_VOICE_RESULT)
          addAction(ACTION_VOICE_ERROR)
          addAction(ACTION_UPDATE_STATE)
        },
        ContextCompat.RECEIVER_NOT_EXPORTED,
      )
      receiverRegistered = true
      showOverlay()
    } catch (_: RuntimeException) {
      removeOverlay()
      stopSelf()
    }
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    handleOverlayAction(intent)
    return START_NOT_STICKY
  }

  private fun handleOverlayAction(intent: Intent?) {
    mainHandler.removeCallbacks(closePanelAfterSuccess)
    when (intent?.action) {
      ACTION_VOICE_RESULT -> handleVoiceResult(intent.getStringExtra(EXTRA_TRANSCRIPT))
      ACTION_VOICE_ERROR -> updatePanel(
        OverlayUiState.ERROR,
        intent.getStringExtra(EXTRA_MESSAGE) ?: "Não foi possível reconhecer sua fala.",
      )
      ACTION_UPDATE_STATE -> {
        val state = OverlayUiState.fromWireName(intent.getStringExtra(EXTRA_STATE))
        val message = intent.getStringExtra(EXTRA_MESSAGE)
        if (state != null && !message.isNullOrBlank()) {
          mainHandler.removeCallbacks(processingTimeout)
          updatePanel(state, message)
          if (state == OverlayUiState.SUCCESS) {
            mainHandler.postDelayed(
              closePanelAfterSuccess,
              SUCCESS_AUTO_CLOSE_DELAY_MS,
            )
          }
        }
      }
    }
  }

  private fun showOverlay() {
    if (overlayView != null) return

    val view = NyxOverlayView(
      context = this,
      onMicrophoneClick = ::startVoiceRecognition,
      onStopSpeakingClick = ::stopSpeaking,
      onCloseClick = ::refreshWindowBounds,
    )
    val params = WindowManager.LayoutParams(
      WindowManager.LayoutParams.WRAP_CONTENT,
      WindowManager.LayoutParams.WRAP_CONTENT,
      overlayWindowType(),
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
        WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
        WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
      PixelFormat.TRANSLUCENT,
    ).apply {
      gravity = Gravity.TOP or Gravity.START
      x = dp(16)
      y = dp(160)
    }

    view.setBubbleTouchListener(createBubbleTouchListener(params))
    windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
    windowManager?.addView(view, params)
    overlayView = view
    windowParams = params
    isRunning = true
  }

  private fun createBubbleTouchListener(
    params: WindowManager.LayoutParams,
  ): View.OnTouchListener {
    val touchSlop = ViewConfiguration.get(this).scaledTouchSlop
    var initialX = 0
    var initialY = 0
    var initialTouchX = 0f
    var initialTouchY = 0f
    var dragging = false

    return View.OnTouchListener { _, event ->
      when (event.action) {
        MotionEvent.ACTION_DOWN -> {
          initialX = params.x
          initialY = params.y
          initialTouchX = event.rawX
          initialTouchY = event.rawY
          dragging = false
          true
        }
        MotionEvent.ACTION_MOVE -> {
          val deltaX = event.rawX - initialTouchX
          val deltaY = event.rawY - initialTouchY
          if (!dragging && (abs(deltaX) >= touchSlop || abs(deltaY) >= touchSlop)) {
            dragging = true
          }
          if (dragging) {
            params.x = initialX + deltaX.toInt()
            params.y = initialY + deltaY.toInt()
            updateWindowLayout()
          }
          true
        }
        MotionEvent.ACTION_UP -> {
          if (!dragging) {
            overlayView?.togglePanel()
            refreshWindowBounds()
          }
          true
        }
        MotionEvent.ACTION_CANCEL -> true
        else -> false
      }
    }
  }

  private fun startVoiceRecognition() {
    updatePanel(OverlayUiState.LISTENING, "Estou ouvindo...")
    try {
      startActivity(
        Intent(this, VoiceRecognitionActivity::class.java).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_ANIMATION)
        },
      )
    } catch (_: RuntimeException) {
      updatePanel(
        OverlayUiState.ERROR,
        "Não foi possível abrir o reconhecimento de voz.",
      )
    }
  }

  private fun stopSpeaking() {
    if (!NyxOverlayEventBridge.emitStopSpeaking()) {
      updatePanel(OverlayUiState.ERROR, "Não foi possível interromper a fala.")
    }
  }

  private fun handleVoiceResult(transcript: String?) {
    if (transcript.isNullOrBlank()) {
      updatePanel(OverlayUiState.ERROR, "Não entendi. Pode repetir?")
      return
    }

    updatePanel(OverlayUiState.PROCESSING, "Processando: “$transcript”")
    mainHandler.removeCallbacks(processingTimeout)
    mainHandler.postDelayed(processingTimeout, PROCESSING_TIMEOUT_MS)

    if (!NyxOverlayEventBridge.emitVoiceCommand(transcript)) {
      mainHandler.removeCallbacks(processingTimeout)
      updatePanel(
        OverlayUiState.ERROR,
        "Abra o Nyx para reativar os comandos e tente novamente.",
      )
    }
  }

  private fun updatePanel(state: OverlayUiState, message: String) {
    overlayView?.apply {
      openPanel()
      updateState(state, message)
    }
    refreshWindowBounds()
  }

  private fun refreshWindowBounds() {
    overlayView?.post {
      clampWindowPosition()
      updateWindowLayout()
    }
  }

  private fun clampWindowPosition() {
    val view = overlayView ?: return
    val params = windowParams ?: return
    val screenWidth = resources.displayMetrics.widthPixels
    val screenHeight = resources.displayMetrics.heightPixels
    params.x = params.x.coerceIn(0, (screenWidth - view.width).coerceAtLeast(0))
    params.y = params.y.coerceIn(0, (screenHeight - view.height).coerceAtLeast(0))
  }

  private fun updateWindowLayout() {
    val view = overlayView ?: return
    val params = windowParams ?: return
    try {
      windowManager?.updateViewLayout(view, params)
    } catch (_: IllegalArgumentException) {
      stopSelf()
    }
  }

  private fun removeOverlay() {
    mainHandler.removeCallbacks(processingTimeout)
    mainHandler.removeCallbacks(closePanelAfterSuccess)
    overlayView?.let { view ->
      try {
        windowManager?.removeView(view)
      } catch (_: IllegalArgumentException) {
        // The system may already have detached the window.
      }
    }
    overlayView = null
    windowParams = null
    windowManager = null
    isRunning = false
  }

  private fun overlayWindowType(): Int =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
    } else {
      @Suppress("DEPRECATION")
      WindowManager.LayoutParams.TYPE_PHONE
    }

  private fun dp(value: Int): Int =
    (value * resources.displayMetrics.density).toInt()

  override fun onDestroy() {
    if (receiverRegistered) {
      unregisterReceiver(overlayReceiver)
      receiverRegistered = false
    }
    removeOverlay()
    super.onDestroy()
  }
}
