package expo.modules.jetztalarm

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class AlarmRecord : Record {
  @Field val id: String = ""
  @Field val weekday: Int = 0
  @Field val hour: Int = 0
  @Field val minute: Int = 0
  @Field val timestamp: Double = 0.0
}

class AlarmOptionsRecord : Record {
  @Field val title: String = "Guten Morgen"
  @Field val sound: String = "default"
  @Field val snoozeMinutes: Int = 9
  @Field val tintColor: String = "#1F7A57"
  @Field val stopLabel: String = "Stopp"
  @Field val snoozeLabel: String = "Schlummern"
}

class JetztAlarmModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("JetztAlarm")

    AsyncFunction("getStatus") {
      val detail = detail(context)
      buildMap {
        put("engine", "android")
        put("authorization", authorization(context))
        if (detail != null) put("detail", detail)
      }
    }

    AsyncFunction("requestAuthorization") {
      val ctx = context
      // Notification permission itself is requested from JavaScript (expo-notifications).
      if (!AlarmScheduler.canScheduleExact(ctx)) openSettingsScreen(ctx)
      authorization(ctx)
    }

    AsyncFunction("setAlarms") { alarms: List<AlarmRecord>, options: AlarmOptionsRecord ->
      val ctx = context
      AlarmScheduler.save(
        ctx,
        alarms.map { StoredAlarm(it.id, it.weekday, it.hour, it.minute, it.timestamp.toLong()) },
        StoredOptions(options.title, options.sound, options.snoozeMinutes, options.stopLabel, options.snoozeLabel),
      )
      AlarmScheduler.rescheduleAll(ctx)
    }

    AsyncFunction("cancelAll") {
      AlarmScheduler.cancelAll(context)
    }

    AsyncFunction("openSettings") {
      openSettingsScreen(context)
    }
  }

  private fun authorization(ctx: Context): String {
    val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    return when {
      !AlarmScheduler.canScheduleExact(ctx) -> "denied"
      !nm.areNotificationsEnabled() -> "notDetermined"
      else -> "authorized"
    }
  }

  private fun detail(ctx: Context): String? {
    if (Build.VERSION.SDK_INT >= 34) {
      val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (!nm.canUseFullScreenIntent()) return "Vollbild-Wecker ist nicht erlaubt; der Wecker klingelt als Mitteilung"
    }
    return null
  }

  private fun openSettingsScreen(ctx: Context) {
    val pkg = ctx.packageName
    val intent = when {
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !AlarmScheduler.canScheduleExact(ctx) ->
        Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:$pkg"))
      Build.VERSION.SDK_INT >= 34 && !(ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).canUseFullScreenIntent() ->
        Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:$pkg"))
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.O ->
        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, pkg)
      else -> Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$pkg"))
    }
    val activity = appContext.currentActivity
    if (activity != null) activity.startActivity(intent)
    else ctx.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
  }
}
