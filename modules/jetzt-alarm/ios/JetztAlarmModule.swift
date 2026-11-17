import ExpoModulesCore
import Foundation
import SwiftUI
import UIKit
#if canImport(AlarmKit)
import ActivityKit
import AlarmKit
#endif

/// One alarm as sent from JavaScript.
struct AlarmRecord: Record {
  @Field var id: String = ""
  /// ISO weekday 1–7 for weekly alarms, 0 for a single date.
  @Field var weekday: Int = 0
  @Field var hour: Int = 0
  @Field var minute: Int = 0
  /// Epoch milliseconds for single-date alarms.
  @Field var timestamp: Double = 0
}

struct AlarmOptions: Record {
  @Field var title: String = "Guten Morgen"
  @Field var sound: String = "default"
  @Field var snoozeMinutes: Int = 9
  @Field var tintColor: String = "#1F7A57"
  @Field var stopLabel: String = "Stopp"
  @Field var snoozeLabel: String = "Schlummern"
}

/// Real wake-up alarms with AlarmKit (iOS 26+). Alarms are owned by the system: they
/// ring in silent mode and Focus, show the system alarm UI and survive app termination
/// and device restarts. On older iOS versions the module reports "unavailable" and the
/// JavaScript side falls back to local notifications.
public class JetztAlarmModule: Module {
  public func definition() -> ModuleDefinition {
    Name("JetztAlarm")

    AsyncFunction("getStatus") { () -> [String: String] in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        return ["engine": "alarmkit", "authorization": Self.describe(AlarmManager.shared.authorizationState)]
      }
      #endif
      return ["engine": "alarmkit", "authorization": "unavailable", "detail": "iOS \(UIDevice.current.systemVersion)"]
    }

    AsyncFunction("requestAuthorization") { () async throws -> String in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        let state = try await AlarmManager.shared.requestAuthorization()
        return Self.describe(state)
      }
      #endif
      return "unavailable"
    }

    AsyncFunction("setAlarms") { (alarms: [AlarmRecord], options: AlarmOptions) async throws -> Int in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        return try await AlarmKitScheduler.replaceAll(alarms, options: options)
      }
      #endif
      throw AlarmUnavailableException()
    }

    AsyncFunction("cancelAll") { () in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        AlarmKitScheduler.cancelAll()
      }
      #endif
    }

    AsyncFunction("openSettings") { () in
      guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
      await UIApplication.shared.open(url)
    }
  }

  #if canImport(AlarmKit)
  @available(iOS 26.0, *)
  static func describe(_ state: AlarmManager.AuthorizationState) -> String {
    switch state {
    case .authorized: return "authorized"
    case .denied: return "denied"
    case .notDetermined: return "notDetermined"
    @unknown default: return "notDetermined"
    }
  }
  #endif
}

final class AlarmUnavailableException: Exception, @unchecked Sendable {
  override var reason: String {
    "AlarmKit requires iOS 26 or later"
  }
}

#if canImport(AlarmKit)
@available(iOS 26.0, *)
struct JetztAlarmMetadata: AlarmMetadata {
  var label: String
}

@available(iOS 26.0, *)
enum AlarmKitScheduler {
  private static let weekdays: [Int: Locale.Weekday] = [
    1: .monday, 2: .tuesday, 3: .wednesday, 4: .thursday, 5: .friday, 6: .saturday, 7: .sunday,
  ]

  /// AlarmKit has no "replace", so all alarms of this app are cancelled and added again.
  static func replaceAll(_ alarms: [AlarmRecord], options: AlarmOptions) async throws -> Int {
    cancelAll()
    let attributes = AlarmAttributes<JetztAlarmMetadata>(
      presentation: AlarmPresentation(alert: makeAlert(options)),
      metadata: JetztAlarmMetadata(label: options.title),
      tintColor: Color(hex: options.tintColor)
    )
    let sound: AlertConfiguration.AlertSound = options.sound == "default" ? .default : .named("\(options.sound).wav")
    let snooze = Alarm.CountdownDuration(preAlert: nil, postAlert: TimeInterval(max(1, options.snoozeMinutes) * 60))

    var scheduled = 0
    for record in alarms {
      let schedule: Alarm.Schedule
      if record.weekday > 0, let day = weekdays[record.weekday] {
        // A relative schedule follows the local wall clock, so daylight-saving and
        // time-zone changes keep the alarm at 06:20.
        schedule = .relative(.init(time: .init(hour: record.hour, minute: record.minute), repeats: .weekly([day])))
      } else {
        let date = Date(timeIntervalSince1970: record.timestamp / 1000)
        guard date > Date() else { continue }
        schedule = .fixed(date)
      }
      let configuration = AlarmManager.AlarmConfiguration<JetztAlarmMetadata>(
        countdownDuration: snooze,
        schedule: schedule,
        attributes: attributes,
        sound: sound
      )
      _ = try await AlarmManager.shared.schedule(id: UUID(), configuration: configuration)
      scheduled += 1
    }
    return scheduled
  }

  static func cancelAll() {
    guard let existing = try? AlarmManager.shared.alarms else { return }
    for alarm in existing {
      try? AlarmManager.shared.cancel(id: alarm.id)
    }
  }

  private static func makeAlert(_ options: AlarmOptions) -> AlarmPresentation.Alert {
    let snoozeButton = AlarmButton(
      text: LocalizedStringResource(stringLiteral: options.snoozeLabel),
      textColor: .white,
      systemImageName: "zzz"
    )
    let title = LocalizedStringResource(stringLiteral: options.title)
    if #available(iOS 26.1, *) {
      return AlarmPresentation.Alert(title: title, secondaryButton: snoozeButton, secondaryButtonBehavior: .countdown)
    }
    let stopButton = AlarmButton(
      text: LocalizedStringResource(stringLiteral: options.stopLabel),
      textColor: .white,
      systemImageName: "stop.circle"
    )
    return AlarmPresentation.Alert(title: title, stopButton: stopButton, secondaryButton: snoozeButton, secondaryButtonBehavior: .countdown)
  }
}

private extension Color {
  init(hex: String) {
    var value: UInt64 = 0
    Scanner(string: hex.trimmingCharacters(in: CharacterSet(charactersIn: "#"))).scanHexInt64(&value)
    self.init(
      red: Double((value >> 16) & 0xFF) / 255,
      green: Double((value >> 8) & 0xFF) / 255,
      blue: Double(value & 0xFF) / 255
    )
  }
}
#endif
