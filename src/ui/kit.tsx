/**
 * Small, native-feeling UI kit: text styles, cards, buttons, inset grouped lists,
 * chips, segmented control, progress ring and a time field.
 */
import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import React from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  type ScrollViewProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { radius, space, type, useColors, type Colors, type TypeName } from './theme';

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

export const ICONS = {
  alarm: { sf: 'alarm', md: 'alarm' },
  location: { sf: 'location.fill', md: 'location_on' },
  bell: { sf: 'bell.fill', md: 'notifications' },
  bellOff: { sf: 'bell.slash', md: 'notifications_off' },
  paint: { sf: 'paintbrush.fill', md: 'palette' },
  list: { sf: 'list.bullet', md: 'list' },
  trash: { sf: 'trash', md: 'delete' },
  chevron: { sf: 'chevron.right', md: 'chevron_right' },
  chevronLeft: { sf: 'chevron.left', md: 'chevron_left' },
  play: { sf: 'play.fill', md: 'play_arrow' },
  pause: { sf: 'pause.fill', md: 'pause' },
  check: { sf: 'checkmark', md: 'check' },
  checkCircle: { sf: 'checkmark.circle.fill', md: 'check_circle' },
  circle: { sf: 'circle', md: 'radio_button_unchecked' },
  plus: { sf: 'plus', md: 'add' },
  skip: { sf: 'forward.fill', md: 'skip_next' },
  skipped: { sf: 'arrow.uturn.forward.circle', md: 'redo' },
  clock: { sf: 'clock', md: 'schedule' },
  undo: { sf: 'arrow.uturn.backward', md: 'undo' },
  home: { sf: 'house.fill', md: 'home' },
  moon: { sf: 'moon.fill', md: 'dark_mode' },
  calendar: { sf: 'calendar', md: 'calendar_month' },
  chart: { sf: 'chart.bar.fill', md: 'bar_chart' },
  gear: { sf: 'gearshape.fill', md: 'settings' },
  close: { sf: 'xmark', md: 'close' },
  timer: { sf: 'timer', md: 'timer' },
  extend: { sf: 'plus.circle', md: 'more_time' },
  stop: { sf: 'stop.fill', md: 'stop' },
  warn: { sf: 'exclamationmark.triangle.fill', md: 'warning' },
  info: { sf: 'info.circle', md: 'info' },
  sparkles: { sf: 'sparkles', md: 'auto_awesome' },
  lock: { sf: 'lock.fill', md: 'lock' },
  pin: { sf: 'mappin.circle.fill', md: 'place' },
  school: { sf: 'graduationcap.fill', md: 'school' },
  sun: { sf: 'sun.max.fill', md: 'light_mode' },
  shield: { sf: 'hand.raised.fill', md: 'privacy_tip' },
  arrowRight: { sf: 'arrow.right', md: 'arrow_forward' },
  walk: { sf: 'figure.walk', md: 'directions_walk' },
  speaker: { sf: 'speaker.wave.2.fill', md: 'volume_up' },
  review: { sf: 'text.badge.checkmark', md: 'fact_check' },
  person: { sf: 'person.fill', md: 'person' },
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  symbol,
  size = 20,
  color,
  weight,
  style,
}: {
  name?: IconName;
  symbol?: { sf: string; md: string };
  size?: number;
  color?: string;
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const src = symbol ?? (name ? ICONS[name] : ICONS.circle);
  return (
    <SymbolView
      // The symbol names are checked by hand above; the packages type them as string unions.
      name={{ ios: src.sf as never, android: src.md as never, web: src.md as never }}
      size={size}
      tintColor={color ?? c.text}
      weight={Platform.OS === 'ios' ? weight : undefined}
      style={[{ width: size, height: size }, style]}
    />
  );
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

type ColorKey = keyof Colors;

export function Txt({
  v = 'body',
  c,
  color,
  style,
  children,
  numberOfLines,
  tabular,
  center,
  weight,
  selectable,
  onPress,
  fit,
}: {
  onPress?: () => void;
  /** Shrink slightly instead of truncating (single line). */
  fit?: boolean;
  v?: TypeName;
  c?: ColorKey;
  color?: string;
  style?: StyleProp<TextStyle>;
  children: React.ReactNode;
  numberOfLines?: number;
  tabular?: boolean;
  center?: boolean;
  weight?: TextStyle['fontWeight'];
  selectable?: boolean;
}) {
  const colors = useColors();
  return (
    <Text
      numberOfLines={numberOfLines}
      selectable={selectable}
      onPress={onPress}
      adjustsFontSizeToFit={fit}
      minimumFontScale={fit ? 0.8 : undefined}
      suppressHighlighting
      accessibilityRole={onPress ? 'button' : undefined}
      style={[
        type[v],
        { color: color ?? colors[c ?? 'text'] },
        tabular && { fontVariant: ['tabular-nums'] },
        center && { textAlign: 'center' },
        weight && { fontWeight: weight },
        style,
      ]}>
      {children}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function Screen({ children, style, contentStyle, ...rest }: ScrollViewProps & { contentStyle?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      style={[{ flex: 1, backgroundColor: c.bg }, style]}
      contentContainerStyle={[{ padding: space.lg, paddingBottom: 48, gap: space.lg }, contentStyle]}
      {...rest}>
      {children}
    </ScrollView>
  );
}

export function Card({
  children,
  style,
  onPress,
  padded = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  padded?: boolean;
}) {
  const c = useColors();
  const base: ViewStyle = { backgroundColor: c.card, borderRadius: radius.lg, padding: padded ? space.lg : 0, borderCurve: 'continuous' };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [base, pressed && { backgroundColor: c.cardPressed }, style]}>
      {children}
    </Pressable>
  );
}

export function Gap({ h = space.md }: { h?: number }) {
  return <View style={{ height: h }} />;
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

export function tap() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function success() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function Button({
  label,
  onPress,
  icon,
  variant = 'filled',
  size = 'md',
  disabled,
  style,
  flex,
  stacked,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  /** Icon above a small label, for rows of three or more actions. */
  stacked?: boolean;
  variant?: 'filled' | 'tinted' | 'gray' | 'plain' | 'destructive' | 'blue';
  size?: 'lg' | 'md' | 'sm';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  flex?: boolean;
}) {
  const c = useColors();
  const bg = {
    filled: c.accent,
    tinted: c.accentSoft,
    gray: c.fill,
    plain: 'transparent',
    destructive: c.dangerSoft,
    blue: c.blueSoft,
  }[variant];
  const fg = {
    filled: c.onAccent,
    tinted: c.accent,
    gray: c.text,
    plain: c.accent,
    destructive: c.danger,
    blue: c.blue,
  }[variant];
  const height = stacked ? 58 : size === 'lg' ? 52 : size === 'md' ? 44 : 34;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [
        {
          height,
          paddingHorizontal: stacked ? 6 : size === 'sm' ? 12 : 16,
          borderRadius: size === 'sm' ? radius.sm : radius.md,
          borderCurve: 'continuous',
          backgroundColor: bg,
          flexDirection: stacked ? 'column' : 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: stacked ? 3 : 6,
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        flex && { flex: 1 },
        style,
      ]}>
      {icon && <Icon name={icon} size={stacked ? 18 : size === 'sm' ? 14 : 16} color={fg} weight="semibold" />}
      <Txt v={stacked ? (Platform.OS === 'web' ? 'caption' : 'footnote') : size === 'sm' ? 'subhead' : 'headline'} color={fg} weight="600" numberOfLines={1} fit={stacked}>
        {label}
      </Txt>
    </Pressable>
  );
}

export function IconButton({ name, onPress, label, color, size = 36 }: { name: IconName; onPress: () => void; label: string; color?: string; size?: number }) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: c.fill,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}>
      <Icon name={name} size={size * 0.45} color={color ?? c.text} weight="semibold" />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Inset grouped list
// ---------------------------------------------------------------------------

export function Section({ title, footer, children, style }: { title?: string; footer?: string; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={style}>
      {title && (
        <Txt v="footnote" c="text2" style={{ textTransform: 'uppercase', marginLeft: space.lg, marginBottom: 6 }}>
          {title}
        </Txt>
      )}
      <View style={{ backgroundColor: c.card, borderRadius: radius.md, overflow: 'hidden', borderCurve: 'continuous' }}>
        {items.map((child, i) => (
          <View key={i}>
            {i > 0 && <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.separator, marginLeft: space.lg }} />}
            {child}
          </View>
        ))}
      </View>
      {footer && (
        <Txt v="footnote" c="text2" style={{ marginHorizontal: space.lg, marginTop: 6 }}>
          {footer}
        </Txt>
      )}
    </View>
  );
}

export function Row({
  title,
  subtitle,
  value,
  icon,
  iconBg,
  symbol,
  onPress,
  right,
  chevron,
  destructive,
  left,
}: {
  title: string;
  subtitle?: string;
  value?: string;
  icon?: IconName;
  symbol?: { sf: string; md: string };
  iconBg?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  chevron?: boolean;
  destructive?: boolean;
  left?: React.ReactNode;
}) {
  const c = useColors();
  const content = (pressed: boolean) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingHorizontal: space.lg, paddingVertical: 10, gap: space.md, backgroundColor: pressed ? c.cardPressed : 'transparent' }}>
      {left}
      {(icon || symbol) && (
        <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: iconBg ?? c.accent, alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' }}>
          <Icon name={icon} symbol={symbol} size={16} color="#FFFFFF" weight="semibold" />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Txt v="body" color={destructive ? c.danger : undefined} numberOfLines={2}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt v="footnote" c="text2" style={{ marginTop: 1 }}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {value != null && (
        <Txt v="body" c="text2" numberOfLines={1} tabular>
          {value}
        </Txt>
      )}
      {right}
      {(chevron ?? !!onPress) && !right && <Icon name="chevron" size={13} color={c.text3} weight="semibold" />}
    </View>
  );
  if (!onPress) return content(false);
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {({ pressed }) => content(pressed)}
    </Pressable>
  );
}

export function SwitchRow({ title, subtitle, value, onChange, icon, iconBg, disabled }: { title: string; subtitle?: string; value: boolean; onChange: (v: boolean) => void; icon?: IconName; iconBg?: string; disabled?: boolean }) {
  const c = useColors();
  return (
    <Row
      title={title}
      subtitle={subtitle}
      icon={icon}
      iconBg={iconBg}
      right={<Switch value={value} onValueChange={(v) => { tap(); onChange(v); }} disabled={disabled} trackColor={{ true: c.accent }} />}
    />
  );
}

// ---------------------------------------------------------------------------
// Chips, segmented control
// ---------------------------------------------------------------------------

export function Chip({ label, selected, onPress, color, small }: { label: string; selected: boolean; onPress: () => void; color?: string; small?: boolean }) {
  const c = useColors();
  const tint = color ?? c.accent;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => ({
        paddingHorizontal: small ? 10 : 14,
        height: small ? 30 : 36,
        borderRadius: 999,
        justifyContent: 'center',
        backgroundColor: selected ? tint : c.fill,
        opacity: pressed ? 0.7 : 1,
      })}>
      <Txt v={small ? 'footnote' : 'subhead'} color={selected ? '#FFFFFF' : c.text} weight={selected ? '600' : '500'}>
        {label}
      </Txt>
    </Pressable>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const c = useColors();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: c.fill, borderRadius: 9, padding: 2 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => {
              tap();
              onChange(o.value);
            }}
            style={{
              flex: 1,
              height: 30,
              borderRadius: 7,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: active ? c.card : 'transparent',
              boxShadow: active ? '0 1px 3px rgba(0,0,0,0.12)' : undefined,
            }}>
            <Txt v="footnote" weight={active ? '600' : '500'}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Progress ring
// ---------------------------------------------------------------------------

export function ProgressRing({
  size = 64,
  stroke = 7,
  progress,
  color,
  children,
}: {
  size?: number;
  stroke?: number;
  progress: number;
  color?: string;
  children?: React.ReactNode;
}) {
  const c = useColors();
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.ring} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color ?? c.accent}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={circ * (1 - p)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

export function Bar({ value, color, height = 6 }: { value: number; color?: string; height?: number }) {
  const c = useColors();
  return (
    <View style={{ height, borderRadius: height, backgroundColor: c.ring, overflow: 'hidden' }}>
      <View style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, height, borderRadius: height, backgroundColor: color ?? c.accent }} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Banner
// ---------------------------------------------------------------------------

export function Banner({
  tone = 'accent',
  icon,
  title,
  message,
  children,
}: {
  tone?: 'accent' | 'warn' | 'blue' | 'gray';
  icon?: IconName;
  title: string;
  message?: string;
  children?: React.ReactNode;
}) {
  const c = useColors();
  const bg = { accent: c.accentSoft, warn: c.warnSoft, blue: c.blueSoft, gray: c.card }[tone];
  const fg = { accent: c.accent, warn: c.warn, blue: c.blue, gray: c.text2 }[tone];
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.lg, padding: space.lg, gap: space.sm, borderCurve: 'continuous' }}>
      <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
        {icon && <Icon name={icon} size={18} color={fg} weight="semibold" style={{ marginTop: 2 }} />}
        <View style={{ flex: 1, gap: 2 }}>
          <Txt v="headline">{title}</Txt>
          {message ? <Txt v="subhead" c="text2">{message}</Txt> : null}
        </View>
      </View>
      {children ? <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', marginTop: 4 }}>{children}</View> : null}
    </View>
  );
}

export { TimeField } from './time-field';

export function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

/** Text button for navigation bars (iOS wraps header items in glass buttons; Text onPress is unreliable there). */
export function HeaderButton({ label, onPress, bold, disabled }: { label: string; onPress: () => void; bold?: boolean; disabled?: boolean }) {
  const c = useColors();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={disabled} hitSlop={12} style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
      <Txt v={bold ? 'headline' : 'body'} color={disabled ? c.text3 : c.accent}>
        {label}
      </Txt>
    </Pressable>
  );
}
