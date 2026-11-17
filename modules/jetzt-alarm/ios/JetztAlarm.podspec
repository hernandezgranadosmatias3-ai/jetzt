Pod::Spec.new do |s|
  s.name           = 'JetztAlarm'
  s.version        = '1.0.0'
  s.summary        = 'Native wake-up alarms (AlarmKit) for Jetzt'
  s.description    = 'Schedules real alarms with AlarmKit on iOS 26 and later.'
  s.author         = 'Jetzt'
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.license        = 'MIT'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
