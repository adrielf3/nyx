package com.nyx

import android.Manifest
import android.app.Activity
import android.app.SearchManager
import android.content.ComponentName
import android.content.Intent
import android.content.pm.PackageManager
import android.media.MediaMetadata
import android.media.session.MediaController
import android.media.session.MediaSessionManager
import android.media.session.PlaybackState
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import android.provider.Settings
import android.speech.RecognizerIntent
import android.util.Log
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.Arguments

class NyxNativeModule(
  private val context: ReactApplicationContext,
) : ReactContextBaseJavaModule(context) {
  companion object {
    private const val SPEECH_REQUEST_CODE = 7301
    private const val YOUTUBE_MUSIC_PACKAGE = "com.google.android.apps.youtube.music"
    private const val MUSIC_PLAYBACK_CONFIRMATION_DELAY_MS = 2_500L
    private const val LOG_TAG = "NyxMusic"
    private val allowedApps = mapOf(
      "youtube" to "com.google.android.youtube",
      "chrome" to "com.android.chrome",
      "maps" to "com.google.android.apps.maps",
      "gmail" to "com.google.android.gm",
    )
  }

  private var speechPromise: Promise? = null
  private val textToSpeech = NyxTextToSpeech(context)
  private val activityListener: ActivityEventListener = object : BaseActivityEventListener() {
    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
      if (requestCode != SPEECH_REQUEST_CODE) return
      val promise = speechPromise ?: return
      speechPromise = null

      if (resultCode == Activity.RESULT_CANCELED) {
        promise.reject("E_SPEECH_CANCELLED", "O reconhecimento de voz foi cancelado.")
        return
      }
      if (resultCode != Activity.RESULT_OK) {
        promise.reject("E_SPEECH_FAILED", "O reconhecimento de voz não retornou um resultado válido.")
        return
      }

      val results = data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)
      val transcript = results?.firstOrNull()?.trim()
      if (transcript.isNullOrEmpty()) {
        promise.reject("E_SPEECH_EMPTY", "Nenhuma fala foi reconhecida.")
      } else {
        promise.resolve(transcript)
      }
    }
  }

  init {
    context.addActivityEventListener(activityListener)
    NyxOverlayEventBridge.attach(context)
  }

  override fun getName(): String = "NyxNative"

  @ReactMethod
  fun hasOverlayPermission(promise: Promise) {
    promise.resolve(Settings.canDrawOverlays(context))
  }

  @ReactMethod
  fun isOverlayRunning(promise: Promise) {
    promise.resolve(NyxOverlayService.isRunning)
  }

  @ReactMethod
  fun getAiConfiguration(promise: Promise) {
    promise.resolve(
      Arguments.createMap().apply {
        putBoolean("enabled", BuildConfig.GEMINI_API_KEY.isNotBlank())
        putString("apiKey", BuildConfig.GEMINI_API_KEY)
      },
    )
  }

  @ReactMethod
  fun getTextToSpeechStatus(promise: Promise) {
    textToSpeech.getStatus(promise)
  }

  @ReactMethod
  fun speak(text: String, promise: Promise) {
    textToSpeech.speak(text, promise)
  }

  @ReactMethod
  fun stopSpeaking(promise: Promise) {
    textToSpeech.stop(promise)
  }

  @ReactMethod
  fun updateOverlayState(stateName: String, message: String, promise: Promise) {
    if (!NyxOverlayService.isRunning) {
      promise.reject("E_OVERLAY_INACTIVE", "A sobreposição não está ativa.")
      return
    }
    if (OverlayUiState.fromWireName(stateName) == null || message.isBlank()) {
      promise.reject("E_OVERLAY_STATE", "Estado ou mensagem da sobreposição inválidos.")
      return
    }

    try {
      context.sendBroadcast(
        Intent(NyxOverlayService.ACTION_UPDATE_STATE).apply {
          setPackage(context.packageName)
          putExtra(NyxOverlayService.EXTRA_STATE, stateName)
          putExtra(NyxOverlayService.EXTRA_MESSAGE, message)
        },
      )
      promise.resolve(null)
    } catch (error: RuntimeException) {
      promise.reject("E_OVERLAY_UPDATE", "Não foi possível atualizar a sobreposição.", error)
    }
  }

  @ReactMethod
  fun addListener(eventName: String) {
    if (
      eventName == NyxOverlayEventBridge.VOICE_COMMAND_EVENT ||
      eventName == NyxOverlayEventBridge.STOP_SPEAKING_EVENT
    ) {
      NyxOverlayEventBridge.addListener()
    }
  }

  @ReactMethod
  fun removeListeners(count: Double) {
    NyxOverlayEventBridge.removeListeners(count.toInt())
  }

  @ReactMethod
  fun openOverlaySettings(promise: Promise) {
    try {
      val intent = Intent(
        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
        Uri.parse("package:${context.packageName}"),
      ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
      promise.resolve(null)
    } catch (error: RuntimeException) {
      promise.reject("E_OVERLAY_SETTINGS", "Não foi possível abrir as configurações de sobreposição.", error)
    }
  }

  @ReactMethod
  fun startOverlay(promise: Promise) {
    if (!Settings.canDrawOverlays(context)) {
      promise.reject("E_OVERLAY_PERMISSION", "A permissão de sobreposição não foi concedida.")
      return
    }

    try {
      context.startService(Intent(context, NyxOverlayService::class.java))
      promise.resolve(result(success = true, message = "Nyx está visível sobre outros aplicativos."))
    } catch (error: RuntimeException) {
      promise.reject("E_OVERLAY_START", "Não foi possível iniciar a sobreposição.", error)
    }
  }

  @ReactMethod
  fun stopOverlay(promise: Promise) {
    try {
      val stopped = context.stopService(Intent(context, NyxOverlayService::class.java))
      promise.resolve(
        result(
          success = true,
          message = if (stopped) "Sobreposição encerrada." else "A sobreposição já estava inativa.",
        ),
      )
    } catch (error: RuntimeException) {
      promise.reject("E_OVERLAY_STOP", "Não foi possível encerrar a sobreposição.", error)
    }
  }

  @ReactMethod
  fun openAllowedApp(appId: String, promise: Promise) {
    val packageName = allowedApps[appId]
    if (packageName == null) {
      promise.reject("E_APP_NOT_ALLOWED", "O aplicativo solicitado não está autorizado.")
      return
    }

    val launchIntent = context.packageManager.getLaunchIntentForPackage(packageName)
    if (launchIntent == null) {
      promise.resolve(
        result(success = false, appId = appId, message = "O aplicativo não está instalado ou disponível."),
      )
      return
    }

    try {
      launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(launchIntent)
      promise.resolve(result(success = true, appId = appId, message = "Aplicativo aberto."))
    } catch (error: RuntimeException) {
      promise.reject("E_APP_OPEN", "Não foi possível abrir o aplicativo.", error)
    }
  }

  @ReactMethod
  fun hasMediaControlPermission(promise: Promise) {
    promise.resolve(isNotificationListenerEnabled())
  }

  @ReactMethod
  fun openMediaControlSettings(promise: Promise) {
    try {
      context.startActivity(
        Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
      )
      promise.resolve(null)
    } catch (error: RuntimeException) {
      promise.reject(
        "E_MEDIA_CONTROL_SETTINGS",
        "Não foi possível abrir as configurações de acesso às notificações.",
        error,
      )
    }
  }

  @ReactMethod
  fun openYouTubeMusic(promise: Promise) {
    val launchIntent = context.packageManager.getLaunchIntentForPackage(YOUTUBE_MUSIC_PACKAGE)
    if (launchIntent == null) {
      promise.resolve(
        musicResult(
          success = false,
          action = "open",
          message = "O YouTube Music não está instalado ou disponível.",
          errorCode = "E_YOUTUBE_MUSIC_UNAVAILABLE",
        ),
      )
      return
    }

    try {
      launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(launchIntent)
      promise.resolve(
        musicResult(
          success = true,
          action = "open",
          message = "Abrindo o YouTube Music.",
        ),
      )
    } catch (error: RuntimeException) {
      promise.resolve(
        musicResult(
          success = false,
          action = "open",
          message = "Não foi possível abrir o YouTube Music.",
          errorCode = "E_YOUTUBE_MUSIC_OPEN",
        ),
      )
    }
  }

  @ReactMethod
  fun searchYouTubeMusic(searchUrl: String, promise: Promise) {
    val uri = validatedSearchUri(searchUrl)
    if (uri == null) {
      promise.resolve(
        musicResult(
          success = false,
          action = "search",
          message = "A pesquisa solicitada não é válida.",
          errorCode = "E_MUSIC_SEARCH_INVALID",
        ),
      )
      return
    }

    val intent = Intent(Intent.ACTION_VIEW, uri).apply {
      setPackage(YOUTUBE_MUSIC_PACKAGE)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    if (intent.resolveActivity(context.packageManager) == null) {
      promise.resolve(
        musicResult(
          success = false,
          action = "search",
          message = "O YouTube Music não está instalado ou não aceitou a pesquisa.",
          errorCode = "E_YOUTUBE_MUSIC_UNAVAILABLE",
        ),
      )
      return
    }

    try {
      context.startActivity(intent)
      promise.resolve(
        musicResult(
          success = true,
          action = "search",
          message = "Pesquisa aberta no YouTube Music.",
        ),
      )
    } catch (error: RuntimeException) {
      promise.resolve(
        musicResult(
          success = false,
          action = "search",
          message = "Não foi possível abrir a pesquisa no YouTube Music.",
          errorCode = "E_MUSIC_SEARCH_OPEN",
        ),
      )
    }
  }

  @ReactMethod
  fun playYouTubeMusic(title: String, artist: String?, promise: Promise) {
    val cleanTitle = title.trim()
    val cleanArtist = artist?.trim()?.takeIf { it.isNotEmpty() }
    val query = listOfNotNull(cleanTitle, cleanArtist).joinToString(" ")
    if (cleanTitle.isEmpty()) {
      Log.d(LOG_TAG, "strategy=play_from_search result=invalid_request")
      promise.resolve(
        musicResult(
          success = false,
          action = "play",
          message = "Informe uma música válida para reprodução.",
          errorCode = "INVALID_MUSIC_REQUEST",
          status = "INVALID_MUSIC_REQUEST",
        ),
      )
      return
    }

    if (context.packageManager.getLaunchIntentForPackage(YOUTUBE_MUSIC_PACKAGE) == null) {
      Log.d(LOG_TAG, "strategy=play_from_search app_available=false")
      promise.resolve(
        musicResult(
          success = false,
          action = "play",
          message = "O YouTube Music não está instalado ou disponível.",
          errorCode = "APP_NOT_INSTALLED",
          status = "APP_NOT_INSTALLED",
        ),
      )
      return
    }

    val playbackIntent = Intent(MediaStore.INTENT_ACTION_MEDIA_PLAY_FROM_SEARCH).apply {
      setPackage(YOUTUBE_MUSIC_PACKAGE)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      putExtra(MediaStore.EXTRA_MEDIA_FOCUS, MediaStore.Audio.Media.ENTRY_CONTENT_TYPE)
      putExtra(MediaStore.EXTRA_MEDIA_TITLE, cleanTitle)
      cleanArtist?.let { putExtra(MediaStore.EXTRA_MEDIA_ARTIST, it) }
      putExtra(SearchManager.QUERY, query)
    }
    val compatibleHandlers = context.packageManager.queryIntentActivities(
      playbackIntent,
      PackageManager.MATCH_DEFAULT_ONLY,
    )
    Log.d(
      LOG_TAG,
      "strategy=play_from_search app_available=true compatible_handlers=${compatibleHandlers.size}",
    )
    if (compatibleHandlers.none { it.activityInfo.packageName == YOUTUBE_MUSIC_PACKAGE }) {
      openPlaySearchFallback(cleanTitle, cleanArtist, promise, "NO_COMPATIBLE_HANDLER")
      return
    }

    try {
      context.startActivity(playbackIntent)
      Log.d(LOG_TAG, "strategy=play_from_search request_sent=true")
    } catch (_: RuntimeException) {
      Log.d(LOG_TAG, "strategy=play_from_search result=open_failed")
      openPlaySearchFallback(cleanTitle, cleanArtist, promise, "OPEN_FAILED")
      return
    }

    Handler(Looper.getMainLooper()).postDelayed({
      val controller = if (isNotificationListenerEnabled()) {
        try {
          youtubeMusicController()
        } catch (_: RuntimeException) {
          null
        }
      } else {
        null
      }
      val state = controller?.playbackState?.state
      val actualTitle = normalizeMediaText(
        controller?.metadata?.getString(MediaMetadata.METADATA_KEY_TITLE).orEmpty(),
      )
      val requestedTitle = normalizeMediaText(cleanTitle)
      val isPlaying = state == PlaybackState.STATE_PLAYING ||
        state == PlaybackState.STATE_BUFFERING ||
        state == PlaybackState.STATE_CONNECTING
      val titleMatches = actualTitle == requestedTitle || actualTitle.contains(requestedTitle)
      if (isPlaying && titleMatches) {
        Log.d(LOG_TAG, "strategy=play_from_search result=playback_confirmed")
        promise.resolve(
          musicResult(
            success = true,
            action = "play",
            message = "O YouTube Music começou a reproduzir $cleanTitle.",
            status = "PLAYBACK_CONFIRMED",
          ),
        )
      } else {
        Log.d(LOG_TAG, "strategy=play_from_search result=playback_unconfirmed")
        openPlaySearchFallback(cleanTitle, cleanArtist, promise, "PLAYBACK_UNCONFIRMED")
      }
    }, MUSIC_PLAYBACK_CONFIRMATION_DELAY_MS)
  }

  @ReactMethod
  fun controlYouTubeMusic(action: String, promise: Promise) {
    val requestedAction = mediaAction(action)
    if (requestedAction == null) {
      promise.resolve(
        musicResult(
          success = false,
          action = action,
          message = "Esse controle de mídia não é permitido.",
          errorCode = "E_MEDIA_ACTION_INVALID",
        ),
      )
      return
    }
    if (!isNotificationListenerEnabled()) {
      promise.resolve(
        musicResult(
          success = false,
          action = action,
          message = "Autorize o acesso de controle de mídia da Nyx nas configurações para controlar o YouTube Music.",
          requiresUserInteraction = true,
          errorCode = "E_MEDIA_CONTROL_PERMISSION",
        ),
      )
      return
    }

    try {
      val controller = youtubeMusicController()
      if (controller == null) {
        promise.resolve(
          musicResult(
            success = false,
            action = action,
            message = "Não encontrei uma sessão ativa do YouTube Music. Inicie uma música no aplicativo primeiro.",
            requiresUserInteraction = true,
            errorCode = "E_NO_YOUTUBE_MUSIC_SESSION",
          ),
        )
        return
      }

      val availableActions = controller.playbackState?.actions ?: 0L
      val supported = availableActions and requestedAction != 0L ||
        ((action == "pause" || action == "resume") &&
          availableActions and PlaybackState.ACTION_PLAY_PAUSE != 0L)
      if (!supported) {
        promise.resolve(
          musicResult(
            success = false,
            action = action,
            message = "O YouTube Music não disponibilizou esse controle agora.",
            errorCode = "E_MEDIA_ACTION_UNSUPPORTED",
          ),
        )
        return
      }

      when (action) {
        "pause" -> controller.transportControls.pause()
        "resume" -> controller.transportControls.play()
        "next" -> controller.transportControls.skipToNext()
        "previous" -> controller.transportControls.skipToPrevious()
        "stop" -> controller.transportControls.stop()
      }
      val labels = mapOf(
        "pause" to "Pausa enviada ao YouTube Music.",
        "resume" to "Reprodução enviada ao YouTube Music.",
        "next" to "Avanço enviado ao YouTube Music.",
        "previous" to "Retorno enviado ao YouTube Music.",
        "stop" to "Parada enviada ao YouTube Music.",
      )
      promise.resolve(
        musicResult(
          success = true,
          action = action,
          message = labels.getValue(action),
        ),
      )
    } catch (error: SecurityException) {
      promise.resolve(
        musicResult(
          success = false,
          action = action,
          message = "O Android não autorizou o acesso à sessão de mídia. Revise a permissão da Nyx.",
          requiresUserInteraction = true,
          errorCode = "E_MEDIA_CONTROL_PERMISSION",
        ),
      )
    } catch (error: RuntimeException) {
      promise.resolve(
        musicResult(
          success = false,
          action = action,
          message = "Não foi possível enviar o controle ao YouTube Music.",
          errorCode = "E_MEDIA_CONTROL_FAILED",
        ),
      )
    }
  }

  @ReactMethod
  fun startSpeechRecognition(promise: Promise) {
    if (speechPromise != null) {
      promise.reject("E_SPEECH_BUSY", "Já existe um reconhecimento de voz em andamento.")
      return
    }
    if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
      promise.reject("E_MIC_PERMISSION", "A permissão de microfone não foi concedida.")
      return
    }

    val activity = context.currentActivity
    if (activity == null) {
      promise.reject("E_NO_ACTIVITY", "A tela do Nyx precisa estar aberta para iniciar o reconhecimento.")
      return
    }

    val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
      putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
      putExtra(RecognizerIntent.EXTRA_LANGUAGE, "pt-BR")
      putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "pt-BR")
      putExtra(RecognizerIntent.EXTRA_PROMPT, "Fale com o Nyx")
      putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
    }
    if (intent.resolveActivity(context.packageManager) == null) {
      promise.reject("E_SPEECH_UNAVAILABLE", "Nenhum serviço de reconhecimento de voz está disponível.")
      return
    }

    try {
      speechPromise = promise
      activity.startActivityForResult(intent, SPEECH_REQUEST_CODE)
    } catch (error: RuntimeException) {
      speechPromise = null
      promise.reject("E_SPEECH_START", "Não foi possível iniciar o reconhecimento de voz.", error)
    }
  }

  override fun invalidate() {
    speechPromise?.reject("E_MODULE_INVALIDATED", "O reconhecimento foi interrompido.")
    speechPromise = null
    context.removeActivityEventListener(activityListener)
    NyxOverlayEventBridge.detach(context)
    textToSpeech.shutdown()
    super.invalidate()
  }

  private fun result(success: Boolean, message: String, appId: String? = null): WritableMap =
    Arguments.createMap().apply {
      putBoolean("success", success)
      putString("message", message)
      appId?.let { putString("appId", it) }
    }

  private fun isNotificationListenerEnabled(): Boolean {
    val component = ComponentName(context, NyxNotificationListenerService::class.java)
    val enabledListeners = Settings.Secure.getString(
      context.contentResolver,
      "enabled_notification_listeners",
    ) ?: return false
    return enabledListeners
      .split(':')
      .mapNotNull(ComponentName::unflattenFromString)
      .any { it == component }
  }

  private fun validatedSearchUri(searchUrl: String): Uri? {
    val uri = Uri.parse(searchUrl)
    val valid = uri.scheme == "https" &&
      uri.host == "music.youtube.com" &&
      uri.path == "/search" &&
      uri.queryParameterNames == setOf("q") &&
      !uri.getQueryParameter("q").isNullOrBlank()
    return uri.takeIf { valid }
  }

  private fun openPlaySearchFallback(
    title: String,
    artist: String?,
    promise: Promise,
    playbackErrorCode: String,
  ) {
    val query = listOfNotNull(title, artist).joinToString(" ")
    val uri = Uri.Builder()
      .scheme("https")
      .authority("music.youtube.com")
      .appendPath("search")
      .appendQueryParameter("q", query)
      .build()
    val searchIntent = Intent(Intent.ACTION_VIEW, uri).apply {
      setPackage(YOUTUBE_MUSIC_PACKAGE)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    }
    if (searchIntent.resolveActivity(context.packageManager) == null) {
      promise.resolve(
        musicResult(
          success = false,
          action = "play_search",
          message = "O YouTube Music não está instalado ou não aceitou a reprodução.",
          errorCode = "NO_COMPATIBLE_HANDLER",
          status = "NO_COMPATIBLE_HANDLER",
        ),
      )
      return
    }

    try {
      context.startActivity(searchIntent)
      Log.d(LOG_TAG, "strategy=search_fallback result=search_opened cause=$playbackErrorCode")
      promise.resolve(
        musicResult(
          success = true,
          action = "play_search",
          message = "Abri a pesquisa de $title${artist?.let { ", de $it" } ?: ""} no YouTube Music. Selecione a faixa para tocar.",
          requiresUserInteraction = true,
          errorCode = playbackErrorCode,
          status = "SEARCH_OPENED",
        ),
      )
    } catch (_: RuntimeException) {
      promise.resolve(
        musicResult(
          success = false,
          action = "play_search",
          message = "Não foi possível abrir a música no YouTube Music.",
          errorCode = "OPEN_FAILED",
          status = "OPEN_FAILED",
        ),
      )
    }
  }

  private fun normalizeMediaText(value: String): String = java.text.Normalizer
    .normalize(value, java.text.Normalizer.Form.NFD)
    .replace("\\p{M}+".toRegex(), "")
    .lowercase()
    .replace("[^a-z0-9 ]".toRegex(), " ")
    .replace("\\s+".toRegex(), " ")
    .trim()

  private fun youtubeMusicController(): MediaController? {
    val manager = context.getSystemService(MediaSessionManager::class.java)
    val listener = ComponentName(context, NyxNotificationListenerService::class.java)
    return manager.getActiveSessions(listener)
      .firstOrNull { it.packageName == YOUTUBE_MUSIC_PACKAGE }
  }

  private fun mediaAction(action: String): Long? = when (action) {
    "pause" -> PlaybackState.ACTION_PAUSE
    "resume" -> PlaybackState.ACTION_PLAY
    "next" -> PlaybackState.ACTION_SKIP_TO_NEXT
    "previous" -> PlaybackState.ACTION_SKIP_TO_PREVIOUS
    "stop" -> PlaybackState.ACTION_STOP
    else -> null
  }

  private fun musicResult(
    success: Boolean,
    action: String,
    message: String,
    requiresUserInteraction: Boolean = false,
    errorCode: String? = null,
    status: String? = null,
  ): WritableMap = Arguments.createMap().apply {
    putBoolean("success", success)
    putString("action", action)
    putString("message", message)
    putBoolean("requiresUserInteraction", requiresUserInteraction)
    errorCode?.let { putString("errorCode", it) }
    status?.let { putString("status", it) }
  }
}
