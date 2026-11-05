import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Image,
  Animated,
  Vibration,
  AppState,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useBudget } from '../context/BudgetContext';
import { lightTheme, darkTheme, M3Shape, M3Elevation } from '../theme';

export const AppLockOverlay: React.FC = () => {
  const {
    settings,
    isAppLocked,
    unlockApp,
    verifyAppPin,
    authenticateBiometrics,
  } = useBudget();

  const theme = settings.theme_mode === 'dark' ? darkTheme : lightTheme;
  const isDark = settings.theme_mode === 'dark';

  const [enteredPin, setEnteredPin] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const isPromptingRef = useRef(false);

  const triggerBiometricAuth = async () => {
    // Never prompt if the app is going into background or not currently active
    if (AppState.currentState !== 'active') return;
    if (isPromptingRef.current) return;
    isPromptingRef.current = true;
    try {
      const success = await authenticateBiometrics();
      if (success) {
        unlockApp();
      }
    } finally {
      isPromptingRef.current = false;
    }
  };

  // Reset inputs and auto-trigger ONLY when app is locked AND active in foreground
  useEffect(() => {
    setEnteredPin('');
    setErrorMsg('');
    if (isAppLocked && settings.biometrics_enabled && AppState.currentState === 'active') {
      triggerBiometricAuth();
    }
  }, [isAppLocked, settings.biometrics_enabled]);

  // When returning from background/minimized to foreground active, prompt for biometric unlock
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && isAppLocked && settings.biometrics_enabled) {
        setTimeout(() => {
          if (AppState.currentState === 'active' && !isPromptingRef.current) {
            triggerBiometricAuth();
          }
        }, 150);
      }
    });

    return () => {
      sub.remove();
    };
  }, [isAppLocked, settings.biometrics_enabled]);

  const triggerShake = () => {
    Vibration.vibrate(100);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleKeyPress = async (key: string) => {
    if (enteredPin.length >= 6) return;
    const nextPin = enteredPin + key;
    setEnteredPin(nextPin);
    setErrorMsg('');

    // If reached 4 digits (or configured length), verify
    if (nextPin.length >= 4) {
      const isValid = await verifyAppPin(nextPin);
      if (isValid) {
        unlockApp();
        setEnteredPin('');
      } else if (nextPin.length === 6) {
        // If 6 digits and invalid
        setErrorMsg('Incorrect PIN. Please try again.');
        triggerShake();
        setEnteredPin('');
      }
    }
  };

  const handleDelete = () => {
    if (enteredPin.length > 0) {
      setEnteredPin(enteredPin.slice(0, -1));
      setErrorMsg('');
    }
  };

  if (!isAppLocked || !settings.app_lock_enabled) return null;

  return (
    <Modal visible={isAppLocked} transparent={false} animationType="fade" statusBarTranslucent>
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {/* Top Branding & Lock Icon */}
        <View style={styles.header}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logo}
            resizeMode="cover"
          />
          <Text style={[styles.appTitle, { color: theme.onSurface }]}>just budget</Text>
          <View style={[styles.lockBadge, { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : theme.primaryContainer }]}>
            <MaterialCommunityIcons name="shield-lock" size={16} color={theme.primary} />
            <Text style={[styles.lockBadgeText, { color: theme.primary }]}>App Locked</Text>
          </View>
          <Text style={[styles.subtitle, { color: theme.onSurfaceVariant }]}>
            Enter your passcode or use fingerprint to unlock
          </Text>
        </View>

        {/* PIN Dots Display */}
        <Animated.View style={[styles.dotsContainer, { transform: [{ translateX: shakeAnim }] }]}>
          {[0, 1, 2, 3].map((idx) => {
            const isFilled = idx < enteredPin.length;
            return (
              <View
                key={idx}
                style={[
                  styles.dot,
                  {
                    borderColor: errorMsg ? theme.error : theme.primary,
                    backgroundColor: isFilled
                      ? (errorMsg ? theme.error : theme.primary)
                      : 'transparent',
                  },
                ]}
              />
            );
          })}
        </Animated.View>

        {errorMsg ? (
          <Text style={[styles.errorText, { color: theme.error }]}>{errorMsg}</Text>
        ) : (
          <View style={{ height: 20 }} />
        )}

        {/* Number Keypad */}
        <View style={styles.keypad}>
          {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']].map((row, rIdx) => (
            <View key={rIdx} style={styles.keypadRow}>
              {row.map((num) => (
                <TouchableOpacity
                  key={num}
                  style={[styles.keyBtn, { backgroundColor: theme.cardBg }, M3Elevation.level1]}
                  onPress={() => handleKeyPress(num)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.keyText, { color: theme.onSurface }]}>{num}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}

          {/* Bottom Row: Biometrics, 0, Backspace */}
          <View style={styles.keypadRow}>
            {/* Biometric Button */}
            {settings.biometrics_enabled ? (
              <TouchableOpacity
                style={[styles.keyBtnSpecial, { backgroundColor: theme.primaryContainer }]}
                onPress={triggerBiometricAuth}
                activeOpacity={0.7}
                accessibilityLabel="Unlock with Biometrics"
              >
                <MaterialCommunityIcons name="fingerprint" size={28} color={theme.onPrimaryContainer} />
              </TouchableOpacity>
            ) : (
              <View style={styles.keyBtnSpecial} />
            )}

            {/* Zero Key */}
            <TouchableOpacity
              style={[styles.keyBtn, { backgroundColor: theme.cardBg }, M3Elevation.level1]}
              onPress={() => handleKeyPress('0')}
              activeOpacity={0.7}
            >
              <Text style={[styles.keyText, { color: theme.onSurface }]}>0</Text>
            </TouchableOpacity>

            {/* Backspace Key */}
            <TouchableOpacity
              style={styles.keyBtnSpecial}
              onPress={handleDelete}
              activeOpacity={0.7}
              accessibilityLabel="Backspace"
            >
              <MaterialCommunityIcons name="backspace-outline" size={24} color={theme.onSurfaceVariant} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: 12,
  },
  appTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: M3Shape.full,
    marginTop: 8,
  },
  lockBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    marginVertical: 12,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  errorText: {
    fontSize: 12.5,
    fontWeight: '700',
    textAlign: 'center',
    height: 20,
  },
  keypad: {
    width: '100%',
    maxWidth: 320,
    gap: 14,
    marginBottom: 20,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
  },
  keyBtn: {
    flex: 1,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyBtnSpecial: {
    flex: 1,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontSize: 24,
    fontWeight: '700',
  },
});

