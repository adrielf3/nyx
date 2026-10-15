package com.nyx

import android.service.notification.NotificationListenerService

/**
 * Grants MediaSessionManager access after explicit user authorization.
 * Nyx deliberately does not inspect, copy, or persist notification contents.
 */
class NyxNotificationListenerService : NotificationListenerService()
