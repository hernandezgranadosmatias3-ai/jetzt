package expo.modules.jetztalarm

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.ContentResolver
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Fires the alarm and handles "Stopp" / "Schlummern". */
class AlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      AlarmScheduler.ACTION_FIRE -> {
        AlarmNotifier.show(context)
        // Re-arm weekly alarms for next week (and drop single-date alarms that rang).
        AlarmScheduler.rescheduleAll(context, System.currentTimeMillis() + 60_000L)
      }
      AlarmScheduler.ACTION_STOP -> AlarmNotifier.dismiss(context)
      AlarmScheduler.ACTION_SNOOZE -> {
        AlarmNotifier.dismiss(context)
        AlarmScheduler.snooze(context)
      }
    }
  }
}

/** Re-arms alarms after reboot, app update, time or time-zone change, or a permission change. */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    AlarmScheduler.rescheduleAll(context)
  }
}

/**
 * The ringing alarm is a full-screen notification on an alarm-usage channel with an
 * insistent sound: it rings until "Stopp" or "Schlummern", plays at alarm volume and
 * opens [AlarmActivity] over the lock screen.
 */
object AlarmNotifier {
  private const val NOTIFICATION_ID = 0x4A41 // "JA"

  fun show(context: Context) {
    val options = AlarmScheduler.loadOptions(context)
    val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val channelId = ensureChannel(context, nm, options.sound)
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE

    val fullScreen = PendingIntent.getActivity(
      context,
      9001,
      Intent(context, AlarmActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_USER_ACTION),
      flags,
    )
    val stop = PendingIntent.getBroadcast(context, 9002, Intent(context, AlarmReceiver::class.java).setAction(AlarmScheduler.ACTION_STOP), flags)
    val snooze = PendingIntent.getBroadcast(context, 9003, Intent(context, AlarmReceiver::class.java).setAction(AlarmScheduler.ACTION_SNOOZE), flags)
    val time = SimpleDateFormat("HH:mm", Locale.GERMANY).format(Date())

    @Suppress("DEPRECATION")
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(context, channelId) else Notification.Builder(context)
    builder
      .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setContentTitle(options.title)
      .setContentText("Es ist $time – Zeit aufzustehen.")
      .setCategory(Notification.CATEGORY_ALARM)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setFullScreenIntent(fullScreen, true)
      .setContentIntent(fullScreen)
      .setOngoing(true)
      .setAutoCancel(false)
      .addAction(Notification.Action.Builder(null, options.snoozeLabel, snooze).build())
      .addAction(Notification.Action.Builder(null, options.stopLabel, stop).build())
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      @Suppress("DEPRECATION")
      builder.setPriority(Notification.PRIORITY_MAX).setSound(soundUri(context, options.sound))
    }
    val notification = builder.build()
    notification.flags = notification.flags or Notification.FLAG_INSISTENT
    nm.notify(NOTIFICATION_ID, notification)
  }

  fun dismiss(context: Context) {
    val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    nm.cancel(NOTIFICATION_ID)
  }

  private fun ensureChannel(context: Context, nm: NotificationManager, sound: String): String {
    val id = "jetzt_alarm_$sound"
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return id
    if (nm.getNotificationChannel(id) != null) return id
    val channel = NotificationChannel(id, "Wecker", NotificationManager.IMPORTANCE_HIGH).apply {
      description = "Klingelt zur Weckzeit, auch im Lautlos-Modus (Wecker-Lautstärke)"
      setSound(
        soundUri(context, sound),
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_ALARM)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build(),
      )
      enableVibration(true)
      vibrationPattern = longArrayOf(0, 700, 500, 700)
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      setBypassDnd(true)
    }
    nm.createNotificationChannel(channel)
    return id
  }

  private fun soundUri(context: Context, sound: String): Uri {
    if (sound != "default") {
      // Bundled by the expo-notifications config plugin into res/raw.
      val res = context.resources.getIdentifier(sound, "raw", context.packageName)
      if (res != 0) return Uri.parse("${ContentResolver.SCHEME_ANDROID_RESOURCE}://${context.packageName}/$res")
    }
    return RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
      ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
  }
}
