package expo.modules.jetztalarm

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Full-screen alarm over the lock screen with "Schlummern" and "Stopp". */
class AlarmActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
    }
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

    val options = AlarmScheduler.loadOptions(this)
    val density = resources.displayMetrics.density
    fun dp(v: Int) = (v * density).toInt()

    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setBackgroundColor(Color.parseColor("#0C1210"))
      setPadding(dp(32), dp(48), dp(32), dp(48))
    }
    val time = TextView(this).apply {
      text = SimpleDateFormat("HH:mm", Locale.GERMANY).format(Date())
      setTextColor(Color.WHITE)
      textSize = 84f
      typeface = Typeface.create("sans-serif-thin", Typeface.NORMAL)
      gravity = Gravity.CENTER
    }
    val title = TextView(this).apply {
      text = options.title
      setTextColor(Color.parseColor("#B8C7BF"))
      textSize = 22f
      gravity = Gravity.CENTER
      setPadding(0, dp(8), 0, dp(64))
    }

    fun pill(label: String, background: String, foreground: String, action: String) = Button(this).apply {
      text = label
      isAllCaps = false
      textSize = 18f
      setTextColor(Color.parseColor(foreground))
      background = GradientDrawable().apply {
        cornerRadius = dp(28).toFloat()
        setColor(Color.parseColor(background))
      }
      layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(56)).apply { topMargin = dp(12) }
      setOnClickListener {
        sendBroadcast(Intent(this@AlarmActivity, AlarmReceiver::class.java).setAction(action))
        finish()
      }
    }

    root.addView(time)
    root.addView(title)
    root.addView(pill(options.snoozeLabel, "#26332D", "#FFFFFF", AlarmScheduler.ACTION_SNOOZE))
    root.addView(pill(options.stopLabel, "#43C08D", "#03150D", AlarmScheduler.ACTION_STOP))
    setContentView(root)
  }

  @Deprecated("Back closes the screen but keeps ringing until Stopp or Schlummern.")
  override fun onBackPressed() {
    // Intentionally ignored: the alarm must be stopped or snoozed explicitly.
  }
}
