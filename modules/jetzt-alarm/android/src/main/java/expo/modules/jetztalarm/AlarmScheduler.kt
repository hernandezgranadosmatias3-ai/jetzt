package expo.modules.jetztalarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

data class StoredAlarm(val id: String, val weekday: Int, val hour: Int, val minute: Int, val timestamp: Long)

data class StoredOptions(
  val title: String = "Guten Morgen",
  val sound: String = "default",
  val snoozeMinutes: Int = 9,
  val stopLabel: String = "Stopp",
  val snoozeLabel: String = "Schlummern",
)

/**
 * Persists the alarm plan in SharedPreferences and schedules it with
 * AlarmManager.setAlarmClock. setAlarmClock is exact, is not deferred by Doze and shows
 * the alarm icon in the status bar. Alarms are lost on reboot, so BootReceiver calls
 * [rescheduleAll] again; weekly alarms are re-armed for the next week each time they fire.
 */
object AlarmScheduler {
  const val ACTION_FIRE = "expo.modules.jetztalarm.FIRE"
  const val ACTION_STOP = "expo.modules.jetztalarm.STOP"
  const val ACTION_SNOOZE = "expo.modules.jetztalarm.SNOOZE"
  const val EXTRA_ID = "alarmId"
  private const val PREFS = "jetzt_alarm"
  private const val SNOOZE_ID = "snooze"

  fun canScheduleExact(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true
    val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    return am.canScheduleExactAlarms()
  }

  // -- persistence ---------------------------------------------------------

  fun save(context: Context, alarms: List<StoredAlarm>, options: StoredOptions) {
    val list = JSONArray()
    alarms.forEach {
      list.put(JSONObject().put("id", it.id).put("weekday", it.weekday).put("hour", it.hour).put("minute", it.minute).put("timestamp", it.timestamp))
    }
    val opts = JSONObject()
      .put("title", options.title)
      .put("sound", options.sound)
      .put("snoozeMinutes", options.snoozeMinutes)
      .put("stopLabel", options.stopLabel)
      .put("snoozeLabel", options.snoozeLabel)
    prefs(context).edit().putString("alarms", list.toString()).putString("options", opts.toString()).apply()
  }

  fun loadAlarms(context: Context): List<StoredAlarm> {
    val raw = prefs(context).getString("alarms", null) ?: return emptyList()
    val list = JSONArray(raw)
    return (0 until list.length()).map {
      val o = list.getJSONObject(it)
      StoredAlarm(o.getString("id"), o.getInt("weekday"), o.getInt("hour"), o.getInt("minute"), o.getLong("timestamp"))
    }
  }

  fun loadOptions(context: Context): StoredOptions {
    val raw = prefs(context).getString("options", null) ?: return StoredOptions()
    val o = JSONObject(raw)
    return StoredOptions(
      o.optString("title", "Guten Morgen"),
      o.optString("sound", "default"),
      o.optInt("snoozeMinutes", 9),
      o.optString("stopLabel", "Stopp"),
      o.optString("snoozeLabel", "Schlummern"),
    )
  }

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  // -- scheduling ----------------------------------------------------------

  /** Cancel what was scheduled before and arm every stored alarm for its next occurrence. */
  fun rescheduleAll(context: Context, notBefore: Long = System.currentTimeMillis()): Int {
    val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val previous = prefs(context).getStringSet("scheduled", emptySet()) ?: emptySet()
    previous.forEach { am.cancel(firePendingIntent(context, it)) }
    if (!canScheduleExact(context)) {
      prefs(context).edit().putStringSet("scheduled", emptySet()).apply()
      return 0
    }
    val scheduled = mutableSetOf<String>()
    for (alarm in loadAlarms(context)) {
      val trigger = nextTrigger(alarm, notBefore) ?: continue
      setAlarmClock(context, alarm.id, trigger)
      scheduled += alarm.id
    }
    prefs(context).edit().putStringSet("scheduled", scheduled).apply()
    return scheduled.size
  }

  fun cancelAll(context: Context) {
    save(context, emptyList(), loadOptions(context))
    rescheduleAll(context)
    val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    am.cancel(firePendingIntent(context, SNOOZE_ID))
  }

  fun snooze(context: Context) {
    if (!canScheduleExact(context)) return
    val minutes = loadOptions(context).snoozeMinutes.coerceAtLeast(1)
    setAlarmClock(context, SNOOZE_ID, System.currentTimeMillis() + minutes * 60_000L)
  }

  /**
   * Next wall-clock occurrence. Calendar arithmetic keeps 06:20 at 06:20 across
   * daylight-saving changes and follows the device's current time zone.
   */
  fun nextTrigger(alarm: StoredAlarm, notBefore: Long): Long? {
    if (alarm.weekday == 0) return alarm.timestamp.takeIf { it > notBefore }
    val cal = Calendar.getInstance().apply {
      timeInMillis = notBefore
      set(Calendar.HOUR_OF_DAY, alarm.hour)
      set(Calendar.MINUTE, alarm.minute)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
    }
    // ISO 1 = Monday … 7 = Sunday; Calendar.SUNDAY = 1 … SATURDAY = 7.
    val target = if (alarm.weekday == 7) Calendar.SUNDAY else alarm.weekday + 1
    val diff = (target - cal.get(Calendar.DAY_OF_WEEK) + 7) % 7
    cal.add(Calendar.DAY_OF_YEAR, diff)
    if (cal.timeInMillis <= notBefore) cal.add(Calendar.DAY_OF_YEAR, 7)
    return cal.timeInMillis
  }

  private fun setAlarmClock(context: Context, id: String, triggerAt: Long) {
    val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
    val show = PendingIntent.getActivity(
      context,
      requestCode(id) + 1,
      launch ?: Intent(),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    am.setAlarmClock(AlarmManager.AlarmClockInfo(triggerAt, show), firePendingIntent(context, id))
  }

  private fun firePendingIntent(context: Context, id: String): PendingIntent {
    val intent = Intent(context, AlarmReceiver::class.java).setAction(ACTION_FIRE).putExtra(EXTRA_ID, id)
    return PendingIntent.getBroadcast(context, requestCode(id), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  private fun requestCode(id: String): Int = (id.hashCode() and 0x0FFFFFFF) * 2
}
