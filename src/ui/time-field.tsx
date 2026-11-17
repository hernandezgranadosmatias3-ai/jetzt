import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, Text } from 'react-native';

import { fmtTime } from '@/domain/time';

import { type, useColors } from './theme';

function dateFor(minutes: number): Date {
  const d = new Date();
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d;
}

/** Native time picker: compact inline control on iOS, dialog on Android. */
export function TimeField({ value, onChange, accessibilityLabel }: { value: number; onChange: (minutes: number) => void; accessibilityLabel?: string }) {
  const c = useColors();
  if (Platform.OS === 'ios') {
    return (
      <DateTimePicker
        accessibilityLabel={accessibilityLabel}
        value={dateFor(value)}
        mode="time"
        display="compact"
        locale="de-DE"
        accentColor={c.accent}
        onValueChange={(_, d) => onChange(d.getHours() * 60 + d.getMinutes())}
      />
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() =>
        DateTimePickerAndroid.open({
          value: dateFor(value),
          mode: 'time',
          is24Hour: true,
          onValueChange: (_, d) => onChange(d.getHours() * 60 + d.getMinutes()),
        })
      }
      style={{ backgroundColor: c.fill, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}>
      <Text style={[type.body, { color: c.text, fontVariant: ['tabular-nums'] }]}>{fmtTime(value)}</Text>
    </Pressable>
  );
}
