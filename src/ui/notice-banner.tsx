import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { subscribeInAppNotices, type InAppNotice } from '@/services/in-app';

import { Icon, Txt } from './kit';
import { radius, space, useColors } from './theme';

/** Banner at the top of the screen for reminders shown while the app is open. */
export function NoticeBanner() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [notice, setNotice] = useState<InAppNotice | null>(null);

  useEffect(() => subscribeInAppNotices(setNotice), []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 8000);
    return () => clearTimeout(t);
  }, [notice]);

  if (!notice) return null;
  return (
    <Animated.View
      key={notice.id}
      entering={FadeInUp}
      exiting={FadeOutUp}
      style={{ position: 'absolute', top: insets.top + space.sm, left: space.md, right: space.md, zIndex: 100 }}>
      <Pressable
        accessibilityRole="alert"
        onPress={() => setNotice(null)}
        style={{
          flexDirection: 'row',
          gap: space.md,
          alignItems: 'center',
          backgroundColor: c.card,
          borderRadius: radius.lg,
          padding: space.lg,
          boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
        }}>
        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="bell" size={18} color={c.onAccent} />
        </View>
        <View style={{ flex: 1 }}>
          <Txt v="headline">{notice.title}</Txt>
          <Txt v="subhead" c="text2">
            {notice.body}
          </Txt>
        </View>
      </Pressable>
    </Animated.View>
  );
}
