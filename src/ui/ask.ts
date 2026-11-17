import { Alert, Platform } from 'react-native';

export interface AskButton {
  text: string;
  style?: 'cancel' | 'destructive' | 'default';
  onPress?: () => void;
}

/**
 * Confirmation dialog on all platforms. React Native's Alert does nothing in the
 * browser, so the web version asks with the browser's own dialogs, one per action
 * (most important action first).
 */
export function ask(title: string, message: string, buttons: AskButton[]) {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }
  const actions = buttons.filter((b) => b.style !== 'cancel').reverse();
  for (const b of actions) {
    const question = actions.length > 1 ? `${title}\n\n${message}\n\n→ ${b.text}?` : `${title}\n\n${message}`;
    if (globalThis.confirm?.(question)) {
      b.onPress?.();
      return;
    }
  }
}

/** Simple message without a choice. */
export function tell(title: string, message: string) {
  if (Platform.OS !== 'web') Alert.alert(title, message);
  else globalThis.alert?.(`${title}\n\n${message}`);
}
