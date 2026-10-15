package com.nyx

import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView

class NyxOverlayView(
  context: Context,
  onMicrophoneClick: () -> Unit,
  onStopSpeakingClick: () -> Unit,
  onCloseClick: () -> Unit,
) : LinearLayout(context) {
  private val bubble: TextView
  private val panel: LinearLayout
  private val stateDot: View
  private val stateText: TextView
  private val microphoneButton: TextView
  private val stopSpeakingButton: TextView

  val isPanelOpen: Boolean
    get() = panel.visibility == VISIBLE

  init {
    orientation = VERTICAL
    gravity = Gravity.START

    bubble = TextView(context).apply {
      text = "N"
      textSize = 28f
      gravity = Gravity.CENTER
      setTextColor(Color.WHITE)
      contentDescription = context.getString(R.string.nyx_overlay_description)
      background = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        colors = intArrayOf(Color.rgb(118, 72, 214), Color.rgb(55, 29, 105))
        orientation = GradientDrawable.Orientation.TL_BR
        setStroke(dp(2), Color.rgb(191, 163, 255))
      }
      elevation = dp(12).toFloat()
      layoutParams = LayoutParams(dp(72), dp(72))
    }
    addView(bubble)

    stateDot = View(context).apply {
      background = circle(Color.rgb(143, 132, 168))
      layoutParams = LayoutParams(dp(10), dp(10)).apply {
        marginEnd = dp(9)
      }
    }
    stateText = TextView(context).apply {
      text = "Pronta para ajudar."
      textSize = 14f
      setTextColor(Color.WHITE)
      maxLines = 3
      layoutParams = LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f)
    }

    val statusRow = LinearLayout(context).apply {
      orientation = HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      addView(stateDot)
      addView(stateText)
    }
    microphoneButton = actionButton("🎙  Falar com Nyx").apply {
      contentDescription = "Iniciar reconhecimento de voz"
      setOnClickListener { onMicrophoneClick() }
    }
    stopSpeakingButton = actionButton("Interromper fala", secondary = true).apply {
      contentDescription = "Interromper a fala do Nyx"
      visibility = GONE
      setOnClickListener { onStopSpeakingClick() }
    }
    val closeButton = actionButton("Fechar painel ×", secondary = true).apply {
      contentDescription = "Fechar painel do Nyx"
      setOnClickListener {
        closePanel()
        onCloseClick()
      }
    }

    panel = LinearLayout(context).apply {
      orientation = VERTICAL
      setPadding(dp(16), dp(15), dp(16), dp(12))
      background = roundedRectangle(Color.rgb(35, 24, 57), dp(18).toFloat()).apply {
        setStroke(dp(1), Color.rgb(83, 61, 123))
      }
      elevation = dp(10).toFloat()
      visibility = GONE
      layoutParams = LayoutParams(dp(260), LayoutParams.WRAP_CONTENT).apply {
        topMargin = dp(8)
      }
      addView(statusRow)
      addView(microphoneButton)
      addView(stopSpeakingButton)
      addView(closeButton)
    }
    addView(panel)
  }

  fun setBubbleTouchListener(listener: OnTouchListener) {
    bubble.setOnTouchListener(listener)
  }

  fun togglePanel() {
    panel.visibility = if (isPanelOpen) GONE else VISIBLE
  }

  fun openPanel() {
    panel.visibility = VISIBLE
  }

  fun closePanel() {
    panel.visibility = GONE
  }

  fun updateState(state: OverlayUiState, message: String) {
    stateText.text = message
    val interactionActive = state == OverlayUiState.LISTENING ||
      state == OverlayUiState.PROCESSING ||
      state == OverlayUiState.SPEAKING
    microphoneButton.isEnabled = !interactionActive
    microphoneButton.alpha = if (interactionActive) 0.5f else 1f
    stopSpeakingButton.visibility = if (state == OverlayUiState.SPEAKING) VISIBLE else GONE
    val color = when (state) {
      OverlayUiState.IDLE -> Color.rgb(143, 132, 168)
      OverlayUiState.LISTENING -> Color.rgb(200, 173, 255)
      OverlayUiState.PROCESSING -> Color.rgb(241, 192, 92)
      OverlayUiState.SPEAKING -> Color.rgb(106, 183, 255)
      OverlayUiState.SUCCESS -> Color.rgb(114, 214, 160)
      OverlayUiState.ERROR -> Color.rgb(209, 106, 119)
    }
    stateDot.background = circle(color)
  }

  private fun actionButton(label: String, secondary: Boolean = false): TextView =
    TextView(context).apply {
      text = label
      textSize = 14f
      gravity = Gravity.CENTER
      typeface = Typeface.DEFAULT_BOLD
      setTextColor(if (secondary) Color.rgb(200, 173, 255) else Color.WHITE)
      isClickable = true
      isFocusable = true
      background = if (secondary) {
        roundedRectangle(Color.TRANSPARENT, dp(12).toFloat())
      } else {
        roundedRectangle(Color.rgb(117, 72, 214), dp(12).toFloat())
      }
      layoutParams = LayoutParams(LayoutParams.MATCH_PARENT, dp(44)).apply {
        topMargin = dp(12)
      }
    }

  private fun circle(color: Int) = GradientDrawable().apply {
    shape = GradientDrawable.OVAL
    setColor(color)
  }

  private fun roundedRectangle(color: Int, radius: Float) = GradientDrawable().apply {
    shape = GradientDrawable.RECTANGLE
    cornerRadius = radius
    setColor(color)
  }

  private fun dp(value: Int): Int =
    (value * resources.displayMetrics.density).toInt()
}
