import { fmtTime, parseTime } from '@/domain/time';

import { useColors } from './theme';

/** Web: the browser's own time input (on the iPhone this opens the iOS time wheel). */
export function TimeField({ value, onChange, accessibilityLabel }: { value: number; onChange: (minutes: number) => void; accessibilityLabel?: string }) {
  const c = useColors();
  return (
    <input
      type="time"
      aria-label={accessibilityLabel}
      value={fmtTime(value)}
      onChange={(e) => {
        const m = parseTime(e.target.value);
        if (m != null) onChange(m);
      }}
      style={{
        font: '17px -apple-system, system-ui, sans-serif',
        fontVariantNumeric: 'tabular-nums',
        color: c.text,
        background: c.fill,
        border: 'none',
        borderRadius: 8,
        padding: '6px 10px',
        minWidth: 72,
        textAlign: 'center',
        colorScheme: 'light dark',
      }}
    />
  );
}
