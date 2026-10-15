package com.nyx

enum class OverlayUiState(val wireName: String) {
  IDLE("idle"),
  LISTENING("listening"),
  PROCESSING("processing"),
  SPEAKING("speaking"),
  SUCCESS("success"),
  ERROR("error");

  companion object {
    fun fromWireName(value: String?): OverlayUiState? =
      entries.firstOrNull { it.wireName == value }
  }
}
