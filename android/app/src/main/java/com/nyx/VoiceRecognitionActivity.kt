package com.nyx

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class VoiceRecognitionActivity : Activity(), RecognitionListener {
  companion object {
    private const val MICROPHONE_REQUEST_CODE = 7401
  }

  private var speechRecognizer: SpeechRecognizer? = null
  private var recognitionFinished = false

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    if (savedInstanceState == null) {
      ensureMicrophonePermission()
    } else {
      finishWithError("O reconhecimento foi interrompido. Tente novamente.")
    }
  }

  private fun ensureMicrophonePermission() {
    if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) ==
      PackageManager.PERMISSION_GRANTED
    ) {
      startRecognition()
      return
    }

    ActivityCompat.requestPermissions(
      this,
      arrayOf(Manifest.permission.RECORD_AUDIO),
      MICROPHONE_REQUEST_CODE,
    )
  }

  override fun onRequestPermissionsResult(
    requestCode: Int,
    permissions: Array<out String>,
    grantResults: IntArray,
  ) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults)
    if (requestCode != MICROPHONE_REQUEST_CODE) return

    if (grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) {
      startRecognition()
    } else {
      finishWithError("Permissão de microfone não concedida.")
    }
  }

  private fun startRecognition() {
    if (!SpeechRecognizer.isRecognitionAvailable(this)) {
      finishWithError("Reconhecimento de voz indisponível neste aparelho.")
      return
    }

    try {
      speechRecognizer = createSpeechRecognizer().also {
        it.setRecognitionListener(this)
        it.startListening(recognitionIntent())
      }
    } catch (_: RuntimeException) {
      finishWithError("Não foi possível iniciar o reconhecimento de voz.")
    }
  }

  private fun createSpeechRecognizer(): SpeechRecognizer =
    if (
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
      SpeechRecognizer.isOnDeviceRecognitionAvailable(this)
    ) {
      SpeechRecognizer.createOnDeviceSpeechRecognizer(this)
    } else {
      SpeechRecognizer.createSpeechRecognizer(this)
    }

  private fun recognitionIntent(): Intent =
    Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
      putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
      putExtra(RecognizerIntent.EXTRA_LANGUAGE, "pt-BR")
      putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "pt-BR")
      putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
      putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
    }

  override fun onReadyForSpeech(params: Bundle?) {
    sendState(OverlayUiState.LISTENING, "Pode falar...")
  }

  override fun onBeginningOfSpeech() {
    sendState(OverlayUiState.LISTENING, "Estou ouvindo...")
  }

  override fun onRmsChanged(rmsdB: Float) = Unit

  override fun onBufferReceived(buffer: ByteArray?) = Unit

  override fun onEndOfSpeech() {
    sendState(OverlayUiState.PROCESSING, "Entendi, só um instante...")
  }

  override fun onError(error: Int) {
    finishWithError(errorMessage(error))
  }

  override fun onResults(results: Bundle?) {
    val transcript = results
      ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
      ?.firstOrNull()
      ?.trim()

    if (transcript.isNullOrEmpty()) {
      finishWithError("Não entendi. Pode repetir?")
    } else {
      finishWithTranscript(transcript)
    }
  }

  override fun onPartialResults(partialResults: Bundle?) = Unit

  override fun onEvent(eventType: Int, params: Bundle?) = Unit

  private fun errorMessage(error: Int): String =
    when (error) {
      SpeechRecognizer.ERROR_AUDIO -> "Não foi possível acessar o áudio."
      SpeechRecognizer.ERROR_CLIENT -> "O reconhecimento foi interrompido."
      SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Permissão de microfone não concedida."
      SpeechRecognizer.ERROR_NETWORK,
      SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Falha de conexão durante o reconhecimento."
      SpeechRecognizer.ERROR_NO_MATCH -> "Não entendi. Pode repetir?"
      SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "O reconhecedor de voz está ocupado. Tente novamente."
      SpeechRecognizer.ERROR_SERVER,
      SpeechRecognizer.ERROR_SERVER_DISCONNECTED -> "O serviço de voz não respondeu."
      SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "Não ouvi nada. Tente novamente."
      SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED -> "O idioma pt-BR não é suportado neste aparelho."
      SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE -> "O idioma pt-BR não está disponível neste aparelho."
      else -> "Não foi possível reconhecer sua fala."
    }

  private fun finishWithTranscript(transcript: String) {
    if (recognitionFinished) return
    recognitionFinished = true
    sendToOverlay(
      NyxOverlayService.ACTION_VOICE_RESULT,
      NyxOverlayService.EXTRA_TRANSCRIPT,
      transcript,
    )
    finishVoiceTask()
  }

  private fun finishWithError(message: String) {
    if (recognitionFinished) return
    recognitionFinished = true
    sendToOverlay(
      NyxOverlayService.ACTION_VOICE_ERROR,
      NyxOverlayService.EXTRA_MESSAGE,
      message,
    )
    finishVoiceTask()
  }

  private fun sendState(state: OverlayUiState, message: String) {
    sendBroadcast(
      Intent(NyxOverlayService.ACTION_UPDATE_STATE).apply {
        setPackage(packageName)
        putExtra(NyxOverlayService.EXTRA_STATE, state.wireName)
        putExtra(NyxOverlayService.EXTRA_MESSAGE, message)
      },
    )
  }

  private fun sendToOverlay(action: String, key: String, value: String) {
    sendBroadcast(
      Intent(action).apply {
        setPackage(packageName)
        putExtra(key, value)
      },
    )
  }

  private fun finishVoiceTask() {
    speechRecognizer?.cancel()
    finishAndRemoveTask()
  }

  override fun onDestroy() {
    speechRecognizer?.destroy()
    speechRecognizer = null
    super.onDestroy()
  }
}
