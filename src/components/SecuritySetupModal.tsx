import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useBudget } from '../context/BudgetContext';
import { checkBiometricsAvailable } from '../services/security';
import { M3Shape, M3Elevation } from '../theme';

interface SecuritySetupModalProps {
  visible: boolean;
  onClose: () => void;
}

export const SecuritySetupModal: React.FC<SecuritySetupModalProps> = ({ visible, onClose }) => {
  const {
    settings,
    setAppLock,
    disableAppLock,
    verifyAppPin,
    updateSettings,
  } = useBudget();

  const isEnabled = Boolean(settings.app_lock_enabled);
  const theme = settings.theme_mode === 'dark' ? {
    surface: '#1E293B',
    onSurface: '#F8FAFC',
    onSurfaceVariant: '#94A3B8',
    primary: '#818CF8',
    onPrimary: '#0F172A',
    primaryContainer: 'rgba(99, 102, 241, 0.2)',
    onPrimaryContainer: '#C7D2FE',
    pillBg: 'rgba(255, 255, 255, 0.06)',
    divider: 'rgba(255, 255, 255, 0.08)',
    cardBg: '#1E293B',
    error: '#F87171',
    errorContainer: 'rgba(239, 68, 68, 0.2)',
    onErrorContainer: '#FCA5A5',
  } : {
    surface: '#FFFFFF',
    onSurface: '#0F172A',
    onSurfaceVariant: '#64748B',
    primary: '#4F46E5',
    onPrimary: '#FFFFFF',
    primaryContainer: '#EEF2FF',
    onPrimaryContainer: '#3730A3',
    pillBg: '#F1F5F9',
    divider: '#E2E8F0',
    cardBg: '#FFFFFF',
    error: '#DC2626',
    errorContainer: '#FEE2E2',
    onErrorContainer: '#B91C1C',
  };

  const [mode, setMode] = useState<'main' | 'set_pin' | 'change_pin' | 'disable_confirm'>('main');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [currentPinVerify, setCurrentPinVerify] = useState('');
  const [enableBiometrics, setEnableBiometrics] = useState(true);
  const [hasBiometricsHardware, setHasBiometricsHardware] = useState(false);
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    if (visible) {
      setMode('main');
      setPin('');
      setConfirmPin('');
      setCurrentPinVerify('');
      setErrorText('');
      setEnableBiometrics(settings.biometrics_enabled !== false);
      checkBiometrics();
    }
  }, [visible, settings]);

  const checkBiometrics = async () => {
    const { hasHardware, isEnrolled } = await checkBiometricsAvailable();
    setHasBiometricsHardware(hasHardware && isEnrolled);
  };

  const handleSavePin = async () => {
    if (pin.length < 4) {
      setErrorText('PIN must be at least 4 digits');
      return;
    }
    if (pin !== confirmPin) {
      setErrorText('PINs do not match. Please re-enter.');
      return;
    }

    await setAppLock(pin, hasBiometricsHardware && enableBiometrics);
    Alert.alert('Security Enabled', 'App lock passcode has been configured successfully.');
    onClose();
  };

  const handleDisableLock = async () => {
    const isValid = await verifyAppPin(currentPinVerify);
    if (!isValid) {
      setErrorText('Incorrect current PIN');
      return;
    }
    await disableAppLock();
    Alert.alert('Security Disabled', 'App lock has been turned off.');
    onClose();
  };

  const handleToggleEncryption = async (val: boolean) => {
    await updateSettings({ data_encryption_enabled: val });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalBox, { backgroundColor: theme.surface }]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MaterialCommunityIcons name="shield-lock-outline" size={22} color={theme.primary} />
              <Text style={[styles.modalTitle, { color: theme.onSurface }]}>Security & Encryption</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialCommunityIcons name="close" size={22} color={theme.onSurface} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* MAIN STATUS VIEW */}
            {mode === 'main' && (
              <View style={{ gap: 14 }}>
                {/* Status Hero Card */}
                <View
                  style={[
                    styles.statusHero,
                    {
                      backgroundColor: isEnabled ? theme.primaryContainer : theme.pillBg,
                      borderColor: isEnabled ? theme.primary : theme.divider,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={isEnabled ? 'shield-check' : 'shield-off-outline'}
                    size={32}
                    color={isEnabled ? theme.primary : theme.onSurfaceVariant}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.statusHeroTitle, { color: theme.onSurface }]}>
                      {isEnabled ? 'App Lock is Active' : 'App Lock is Off'}
                    </Text>
                    <Text style={[styles.statusHeroSub, { color: theme.onSurfaceVariant }]}>
                      {isEnabled
                        ? `Protected with Passcode ${settings.biometrics_enabled ? '+ Fingerprint/Face ID' : ''}`
                        : 'Secure your financial logs with a fingerprint or passcode'}
                    </Text>
                  </View>
                </View>

                {/* Actions */}
                {!isEnabled ? (
                  <TouchableOpacity
                    style={[styles.primaryActionBtn, { backgroundColor: theme.primary }]}
                    onPress={() => {
                      setPin('');
                      setConfirmPin('');
                      setErrorText('');
                      setMode('set_pin');
                    }}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons name="lock-plus" size={18} color={theme.onPrimary} />
                    <Text style={[styles.primaryActionBtnText, { color: theme.onPrimary }]}>
                      Set Up Passcode & Fingerprint
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View style={{ gap: 8 }}>
                    <TouchableOpacity
                      style={[styles.optionRow, { backgroundColor: theme.pillBg }]}
                      onPress={() => {
                        setPin('');
                        setConfirmPin('');
                        setErrorText('');
                        setMode('set_pin');
                      }}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons name="form-textbox-password" size={20} color={theme.primary} />
                      <Text style={[styles.optionRowText, { color: theme.onSurface }]}>Change Passcode PIN</Text>
                      <MaterialCommunityIcons name="chevron-right" size={20} color={theme.onSurfaceVariant} />
                    </TouchableOpacity>

                    {hasBiometricsHardware && (
                      <View style={[styles.optionRow, { backgroundColor: theme.pillBg }]}>
                        <MaterialCommunityIcons name="fingerprint" size={20} color={theme.primary} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.optionRowText, { color: theme.onSurface }]}>Biometric Unlock</Text>
                          <Text style={[styles.optionRowSub, { color: theme.onSurfaceVariant }]}>
                            Use fingerprint or Face ID
                          </Text>
                        </View>
                        <Switch
                          value={Boolean(settings.biometrics_enabled)}
                          onValueChange={(val) => updateSettings({ biometrics_enabled: val })}
                          trackColor={{ false: theme.divider, true: theme.primaryContainer }}
                          thumbColor={settings.biometrics_enabled ? theme.primary : '#FFFFFF'}
                        />
                      </View>
                    )}

                    <TouchableOpacity
                      style={[styles.optionRow, { backgroundColor: theme.errorContainer }]}
                      onPress={() => {
                        setCurrentPinVerify('');
                        setErrorText('');
                        setMode('disable_confirm');
                      }}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons name="lock-open-outline" size={20} color={theme.onErrorContainer} />
                      <Text style={[styles.optionRowText, { color: theme.onErrorContainer }]}>
                        Disable App Lock
                      </Text>
                      <MaterialCommunityIcons name="chevron-right" size={20} color={theme.onErrorContainer} />
                    </TouchableOpacity>
                  </View>
                )}

                {/* Encrypted Backup Option */}
                <View style={[styles.encryptionCard, { borderColor: theme.divider, backgroundColor: theme.pillBg }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <MaterialCommunityIcons name="lock-check-outline" size={22} color={theme.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.encryptionTitle, { color: theme.onSurface }]}>
                        Encrypted Backup Export
                      </Text>
                      <Text style={[styles.encryptionSub, { color: theme.onSurfaceVariant }]}>
                        Prompt for password protection when creating backup archives
                      </Text>
                    </View>
                    <Switch
                      value={Boolean(settings.data_encryption_enabled)}
                      onValueChange={handleToggleEncryption}
                      trackColor={{ false: theme.divider, true: theme.primaryContainer }}
                      thumbColor={settings.data_encryption_enabled ? theme.primary : '#FFFFFF'}
                    />
                  </View>
                </View>
              </View>
            )}

            {/* SET PIN VIEW */}
            {mode === 'set_pin' && (
              <View style={{ gap: 12 }}>
                <Text style={[styles.sectionSubtitle, { color: theme.onSurfaceVariant }]}>
                  Create a 4-to-6 digit passcode to secure your app.
                </Text>

                <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>New PIN</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.pillBg, color: theme.onSurface }]}
                  placeholder="Enter 4-6 digits"
                  placeholderTextColor={theme.onSurfaceVariant}
                  keyboardType="numeric"
                  secureTextEntry
                  maxLength={6}
                  value={pin}
                  onChangeText={(t) => {
                    setPin(t);
                    setErrorText('');
                  }}
                />

                <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>Confirm PIN</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.pillBg, color: theme.onSurface }]}
                  placeholder="Re-enter PIN"
                  placeholderTextColor={theme.onSurfaceVariant}
                  keyboardType="numeric"
                  secureTextEntry
                  maxLength={6}
                  value={confirmPin}
                  onChangeText={(t) => {
                    setConfirmPin(t);
                    setErrorText('');
                  }}
                />

                {hasBiometricsHardware && (
                  <View style={[styles.toggleRow, { backgroundColor: theme.pillBg }]}>
                    <MaterialCommunityIcons name="fingerprint" size={20} color={theme.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionRowText, { color: theme.onSurface }]}>Enable Biometrics</Text>
                      <Text style={[styles.optionRowSub, { color: theme.onSurfaceVariant }]}>
                        Unlock with fingerprint / Face ID
                      </Text>
                    </View>
                    <Switch
                      value={enableBiometrics}
                      onValueChange={setEnableBiometrics}
                      trackColor={{ false: theme.divider, true: theme.primaryContainer }}
                      thumbColor={enableBiometrics ? theme.primary : '#FFFFFF'}
                    />
                  </View>
                )}

                {errorText ? (
                  <Text style={[styles.errorMsg, { color: theme.error }]}>{errorText}</Text>
                ) : null}

                <View style={styles.btnRow}>
                  <TouchableOpacity
                    style={[styles.cancelBtn, { backgroundColor: theme.pillBg }]}
                    onPress={() => setMode('main')}
                  >
                    <Text style={{ color: theme.onSurface, fontWeight: '700' }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveBtn, { backgroundColor: theme.primary }]}
                    onPress={handleSavePin}
                  >
                    <Text style={{ color: theme.onPrimary, fontWeight: '700' }}>Save Lock</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* DISABLE CONFIRM VIEW */}
            {mode === 'disable_confirm' && (
              <View style={{ gap: 12 }}>
                <Text style={[styles.sectionSubtitle, { color: theme.onSurfaceVariant }]}>
                  Please enter your current PIN to turn off app lock.
                </Text>

                <Text style={[styles.inputLabel, { color: theme.onSurfaceVariant }]}>Current PIN</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.pillBg, color: theme.onSurface }]}
                  placeholder="Enter current PIN"
                  placeholderTextColor={theme.onSurfaceVariant}
                  keyboardType="numeric"
                  secureTextEntry
                  maxLength={6}
                  value={currentPinVerify}
                  onChangeText={(t) => {
                    setCurrentPinVerify(t);
                    setErrorText('');
                  }}
                />

                {errorText ? (
                  <Text style={[styles.errorMsg, { color: theme.error }]}>{errorText}</Text>
                ) : null}

                <View style={styles.btnRow}>
                  <TouchableOpacity
                    style={[styles.cancelBtn, { backgroundColor: theme.pillBg }]}
                    onPress={() => setMode('main')}
                  >
                    <Text style={{ color: theme.onSurface, fontWeight: '700' }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveBtn, { backgroundColor: theme.error }]}
                    onPress={handleDisableLock}
                  >
                    <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Turn Off</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 16,
  },
  modalBox: {
    borderRadius: M3Shape.extraLarge,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  statusHero: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: M3Shape.large,
    borderWidth: 1,
    gap: 12,
  },
  statusHeroTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  statusHeroSub: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: M3Shape.full,
    marginTop: 6,
  },
  primaryActionBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: M3Shape.medium,
    gap: 10,
  },
  optionRowText: {
    fontSize: 14,
    fontWeight: '700',
  },
  optionRowSub: {
    fontSize: 11,
    marginTop: 1,
  },
  encryptionCard: {
    borderWidth: 1,
    borderRadius: M3Shape.large,
    padding: 14,
    marginTop: 6,
  },
  encryptionTitle: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  encryptionSub: {
    fontSize: 11.5,
    marginTop: 2,
    lineHeight: 15,
  },
  sectionSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    marginBottom: 4,
  },
  input: {
    height: 44,
    borderRadius: M3Shape.medium,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: M3Shape.medium,
    gap: 10,
    marginTop: 4,
  },
  errorMsg: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  cancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: M3Shape.full,
  },
  saveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: M3Shape.full,
  },
});

