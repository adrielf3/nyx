package com.nyx

import android.content.Context
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import java.util.Locale
import java.util.UUID

class NyxTextToSpeech(context: Context) {
  private enum class Status {
    INITIALIZING,
    READY,
    UNAVAILABLE,
    SHUTDOWN,
  }

  private data class PendingSpeech(
    val text: String,
    val promise: Promise,
  )

  private val mainHandler = Handler(Looper.getMainLooper())
  private var engine: TextToSpeech? = null
  private var status = Status.INITIALIZING
  private var statusMessage = "Inicializando síntese de voz."
  private var selectedLanguageTag: String? = null
  private var selectedVoiceName: String? = null
  private var pendingSpeech: PendingSpeech? = null
  private var activePromise: Promise? = null
  private var activeUtteranceId: String? = null
  private val statusPromises = mutableListOf<Promise>()

  init {
    mainHandler.post {
      engine = TextToSpeech(context.applicationContext) { initializationStatus ->
        mainHandler.post { configureEngine(initializationStatus) }
      }
    }
  }

  fun speak(text: String, promise: Promise) {
    if (text.isBlank()) {
      promise.reject("E_TTS_TEXT", "A resposta falada não pode estar vazia.")
      return
    }

    mainHandler.post {
      when (status) {
        Status.INITIALIZING -> {
          interruptPending("A fala anterior foi substituída.")
          pendingSpeech = PendingSpeech(text.trim(), promise)
        }
        Status.READY -> speakNow(text.trim(), promise)
        Status.UNAVAILABLE -> promise.reject("E_TTS_UNAVAILABLE", statusMessage)
        Status.SHUTDOWN -> promise.reject("E_TTS_SHUTDOWN", "A síntese de voz foi encerrada.")
      }
    }
  }

  fun stop(promise: Promise) {
    mainHandler.post {
      val hadSpeech = pendingSpeech != null || activePromise != null
      interruptPending("A fala foi interrompida.")
      engine?.stop()
      promise.resolve(hadSpeech)
    }
  }

  fun getStatus(promise: Promise) {
    mainHandler.post {
      if (status == Status.INITIALIZING) {
        statusPromises += promise
      } else {
        promise.resolve(statusResult())
      }
    }
  }

  fun shutdown() {
    mainHandler.post {
      if (status == Status.SHUTDOWN) return@post
      interruptPending("A síntese de voz foi encerrada.")
      statusPromises.forEach {
        it.reject("E_TTS_SHUTDOWN", "A síntese de voz foi encerrada.")
      }
      statusPromises.clear()
      engine?.stop()
      engine?.shutdown()
      engine = null
      status = Status.SHUTDOWN
    }
  }

  private fun configureEngine(initializationStatus: Int) {
    val currentEngine = engine
    if (initializationStatus != TextToSpeech.SUCCESS || currentEngine == null) {
      markUnavailable("O mecanismo de síntese de voz não está disponível.")
      return
    }

    currentEngine.setOnUtteranceProgressListener(progressListener)
    val preferredLocale = Locale.forLanguageTag("pt-BR")
    val languageResult = currentEngine.setLanguage(preferredLocale)
    if (
      languageResult == TextToSpeech.LANG_MISSING_DATA ||
      languageResult == TextToSpeech.LANG_NOT_SUPPORTED
    ) {
      markUnavailable("Nenhuma voz compatível com português está instalada.")
      return
    }

    val compatibleVoice = currentEngine.voices
      ?.filter { it.locale.language == preferredLocale.language }
      ?.sortedWith(
        compareBy(
          { it.locale.toLanguageTag() != preferredLocale.toLanguageTag() },
          { it.isNetworkConnectionRequired },
          { it.name },
        ),
      )
      ?.firstOrNull()
    if (compatibleVoice != null) {
      currentEngine.voice = compatibleVoice
    }

    val activeVoice = currentEngine.voice
    if (activeVoice == null || activeVoice.locale.language != preferredLocale.language) {
      markUnavailable("Nenhuma voz em português está disponível no aparelho.")
      return
    }

    selectedLanguageTag = activeVoice.locale.toLanguageTag()
    selectedVoiceName = activeVoice.name
    status = Status.READY
    statusMessage = "Síntese de voz disponível."
    resolveStatusPromises()

    pendingSpeech?.let {
      pendingSpeech = null
      speakNow(it.text, it.promise)
    }
  }

  private fun speakNow(text: String, promise: Promise) {
    val currentEngine = engine
    if (currentEngine == null) {
      promise.reject("E_TTS_UNAVAILABLE", "O mecanismo de síntese de voz não está disponível.")
      return
    }

    interruptPending("A fala anterior foi substituída.")
    currentEngine.stop()
    val utteranceId = UUID.randomUUID().toString()
    activeUtteranceId = utteranceId
    activePromise = promise
    val result = currentEngine.speak(
      text,
      TextToSpeech.QUEUE_FLUSH,
      Bundle(),
      utteranceId,
    )
    if (result == TextToSpeech.ERROR) {
      activeUtteranceId = null
      activePromise = null
      promise.reject("E_TTS_SPEAK", "Não foi possível reproduzir a resposta.")
    }
  }

  private fun markUnavailable(message: String) {
    status = Status.UNAVAILABLE
    statusMessage = message
    resolveStatusPromises()
    pendingSpeech?.promise?.reject("E_TTS_UNAVAILABLE", message)
    pendingSpeech = null
  }

  private fun resolveStatusPromises() {
    val result = statusResult()
    statusPromises.forEach { it.resolve(result.copy()) }
    statusPromises.clear()
  }

  private fun statusResult() = Arguments.createMap().apply {
    putBoolean("available", status == Status.READY)
    putString("message", statusMessage)
    selectedLanguageTag?.let { putString("languageTag", it) }
    selectedVoiceName?.let { putString("voiceName", it) }
  }

  private fun interruptPending(message: String) {
    pendingSpeech?.promise?.reject("E_TTS_INTERRUPTED", message)
    pendingSpeech = null
    activePromise?.reject("E_TTS_INTERRUPTED", message)
    activePromise = null
    activeUtteranceId = null
  }

  private val progressListener = object : UtteranceProgressListener() {
    override fun onStart(utteranceId: String?) = Unit

    override fun onDone(utteranceId: String?) {
      completeUtterance(utteranceId, null)
    }

    @Deprecated("Kept for compatibility with older Android versions.")
    override fun onError(utteranceId: String?) {
      completeUtterance(utteranceId, "Não foi possível reproduzir a resposta.")
    }

    override fun onError(utteranceId: String?, errorCode: Int) {
      completeUtterance(utteranceId, "Falha na síntese de voz (código $errorCode).")
    }
  }

  private fun completeUtterance(utteranceId: String?, error: String?) {
    mainHandler.post {
      if (utteranceId == null || utteranceId != activeUtteranceId) return@post
      val promise = activePromise
      activePromise = null
      activeUtteranceId = null
      if (error == null) {
        promise?.resolve(null)
      } else {
        promise?.reject("E_TTS_PLAYBACK", error)
      }
    }
  }
}
