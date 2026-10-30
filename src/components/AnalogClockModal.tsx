import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, PanResponder } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { M3Shape } from '../theme';

interface AnalogClockModalProps {
  visible: boolean;
  initialTime?: string;
  theme: any;
  onClose: () => void;
  onSave: (timeStr: string) => void;
}

const CLOCK_HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const CLOCK_MINUTES = [
  { label: '00', val: 0 },
  { label: '05', val: 5 },
  { label: '10', val: 10 },
  { label: '15', val: 15 },
  { label: '20', val: 20 },
  { label: '25', val: 25 },
  { label: '30', val: 30 },
  { label: '35', val: 35 },
  { label: '40', val: 40 },
  { label: '45', val: 45 },
  { label: '50', val: 50 },
  { label: '55', val: 55 },
];

export const AnalogClockModal: React.FC<AnalogClockModalProps> = ({
  visible,
  initialTime,
  theme,
  onClose,
  onSave,
}) => {
  const [clockMode, setClockMode] = useState<'hours' | 'minutes'>('hours');
  const [selectedHour, setSelectedHour] = useState(12);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>('PM');

  useEffect(() => {
    if (visible) {
      setClockMode('hours');
      const timeToParse = initialTime || new Date().toTimeString().slice(0, 5);
      const [hh, mm] = timeToParse.split(':');
      let h = parseInt(hh) || 0;
      const m = parseInt(mm) || 0;
      const isPm = h >= 12;
      if (h > 12) h -= 12;
      if (h === 0) h = 12;
      setSelectedHour(h);
      setSelectedMinute(m);
      setSelectedPeriod(isPm ? 'PM' : 'AM');
    }
  }, [visible, initialTime]);

  const handleSaveTime = () => {
    let h = selectedHour;
    if (selectedPeriod === 'PM' && h < 12) {
      h += 12;
    } else if (selectedPeriod === 'AM' && h === 12) {
      h = 0;
    }
    const finalTime = `${String(h).padStart(2, '0')}:${String(selectedMinute).padStart(2, '0')}`;
    onSave(finalTime);
    onClose();
  };

  const dialRadius = 115;
  const handleDialTouch = (x: number, y: number, isRelease = false) => {
    const dx = x - dialRadius;
    const dy = y - dialRadius;
    let rad = Math.atan2(dy, dx) + Math.PI / 2;
    if (rad < 0) rad += 2 * Math.PI;
    const deg = (rad * 180) / Math.PI;

    if (clockMode === 'hours') {
      let h = Math.round(deg / 30) % 12;
      if (h === 0) h = 12;
      setSelectedHour(h);
      if (isRelease) {
        setTimeout(() => setClockMode('minutes'), 160);
      }
    } else {
      let m = Math.round(deg / 6) % 60;
      setSelectedMinute(m);
    }
  };

  const clockDialPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          const { locationX, locationY } = e.nativeEvent;
          handleDialTouch(locationX, locationY, false);
        },
        onPanResponderMove: (e) => {
          const { locationX, locationY } = e.nativeEvent;
          handleDialTouch(locationX, locationY, false);
        },
        onPanResponderRelease: (e) => {
          const { locationX, locationY } = e.nativeEvent;
          handleDialTouch(locationX, locationY, true);
        },
      }),
    [clockMode]
  );

  const handAngle = clockMode === 'hours' ? (selectedHour % 12) * 30 : selectedMinute * 6;

  if (!visible) return null;

  return (
    <View style={styles.quickModalBackdrop}>
      <View style={[styles.quickModalBox, { backgroundColor: theme.surface }]}>
        {/* Modal Title Row */}
        <View style={styles.clockModalTitleRow}>
          <MaterialCommunityIcons name="alarm" size={20} color={theme.primary} />
          <Text style={[styles.quickModalTitle, { color: theme.onSurface }]}>Set Time</Text>
        </View>

        {/* Big Interactive Time Header + AM/PM Selector */}
        <View style={styles.clockHeader}>
          <View style={styles.clockTimeDisplay}>
            {/* Hour Segment */}
            <TouchableOpacity
              style={[
                styles.clockTimeSegment,
                clockMode === 'hours'
                  ? { backgroundColor: theme.primaryContainer, borderColor: theme.primary }
                  : { backgroundColor: theme.pillBg, borderColor: 'transparent' },
              ]}
              onPress={() => setClockMode('hours')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.clockTimeText,
                  { color: clockMode === 'hours' ? theme.primary : theme.onSurface },
                ]}
              >
                {String(selectedHour).padStart(2, '0')}
              </Text>
            </TouchableOpacity>

            <Text style={[styles.clockColon, { color: theme.onSurface }]}>:</Text>

            {/* Minute Segment */}
            <TouchableOpacity
              style={[
                styles.clockTimeSegment,
                clockMode === 'minutes'
                  ? { backgroundColor: theme.primaryContainer, borderColor: theme.primary }
                  : { backgroundColor: theme.pillBg, borderColor: 'transparent' },
              ]}
              onPress={() => setClockMode('minutes')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.clockTimeText,
                  { color: clockMode === 'minutes' ? theme.primary : theme.onSurface },
                ]}
              >
                {String(selectedMinute).padStart(2, '0')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* AM / PM Toggle Box */}
          <View style={[styles.periodToggleBox, { backgroundColor: theme.pillBg, borderColor: theme.divider }]}>
            <TouchableOpacity
              style={[
                styles.periodBtn,
                selectedPeriod === 'AM' && { backgroundColor: theme.primary },
              ]}
              onPress={() => setSelectedPeriod('AM')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.periodText,
                  { color: selectedPeriod === 'AM' ? '#FFFFFF' : theme.onSurfaceVariant },
                ]}
              >
                AM
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.periodBtn,
                selectedPeriod === 'PM' && { backgroundColor: theme.primary },
              ]}
              onPress={() => setSelectedPeriod('PM')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.periodText,
                  { color: selectedPeriod === 'PM' ? '#FFFFFF' : theme.onSurfaceVariant },
                ]}
              >
                PM
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Mode Guide Pill */}
        <View style={styles.clockModeBadgeRow}>
          <View style={[styles.clockModeBadge, { backgroundColor: theme.pillBg }]}>
            <Text style={[styles.clockModeBadgeText, { color: theme.primary }]}>
              {clockMode === 'hours' ? 'TOUCH OR DRAG TO PICK HOUR' : 'TOUCH OR DRAG TO PICK MINUTE'}
            </Text>
          </View>
        </View>

        {/* Analog Clock Dial Face */}
        <View
          style={[styles.clockDial, { backgroundColor: theme.pillBg }]}
          {...clockDialPanResponder.panHandlers}
        >
          {/* Rotating Clock Hand */}
          <View
            style={[
              styles.clockHandContainer,
              { transform: [{ rotate: `${handAngle}deg` }] },
            ]}
            pointerEvents="none"
          >
            <View style={[styles.clockHandLine, { backgroundColor: theme.primary }]} />
            <View style={[styles.clockHandCircle, { backgroundColor: theme.primary }]} />
          </View>

          {/* Center Pivot Pin */}
          <View style={[styles.clockCenterPin, { backgroundColor: theme.primary }]} pointerEvents="none" />

          {/* Dial Face Numbers */}
          {clockMode === 'hours'
            ? CLOCK_HOURS.map((h) => {
                const isSelected = selectedHour === h;
                const rad = ((h * 30 - 90) * Math.PI) / 180;
                const x = 115 + 84 * Math.cos(rad);
                const y = 115 + 84 * Math.sin(rad);
                return (
                  <View
                    key={h}
                    style={[styles.clockNumberItem, { left: x - 17, top: y - 17 }]}
                    pointerEvents="none"
                  >
                    <Text
                      style={[
                        styles.clockNumberText,
                        {
                          color: isSelected ? '#FFFFFF' : theme.onSurface,
                          fontWeight: isSelected ? '800' : '600',
                        },
                      ]}
                    >
                      {h}
                    </Text>
                  </View>
                );
              })
            : CLOCK_MINUTES.map(({ label, val }) => {
                const isSelected = selectedMinute === val;
                const rad = ((val * 6 - 90) * Math.PI) / 180;
                const x = 115 + 84 * Math.cos(rad);
                const y = 115 + 84 * Math.sin(rad);
                return (
                  <View
                    key={label}
                    style={[styles.clockNumberItem, { left: x - 17, top: y - 17 }]}
                    pointerEvents="none"
                  >
                    <Text
                      style={[
                        styles.clockNumberText,
                        {
                          color: isSelected ? '#FFFFFF' : theme.onSurface,
                          fontWeight: isSelected ? '800' : '600',
                          fontSize: 12.5,
                        },
                      ]}
                    >
                      {label}
                    </Text>
                  </View>
                );
              })}
        </View>

        {/* Quick Presets */}
        <View style={styles.timePresetsRow}>
          <TouchableOpacity
            style={[styles.timePresetChip, { backgroundColor: theme.pillBg }]}
            onPress={() => {
              const now = new Date();
              let h = now.getHours();
              const m = now.getMinutes();
              const isPm = h >= 12;
              if (h > 12) h -= 12;
              if (h === 0) h = 12;
              setSelectedHour(h);
              setSelectedMinute(m);
              setSelectedPeriod(isPm ? 'PM' : 'AM');
            }}
          >
            <MaterialCommunityIcons name="clock-outline" size={13} color={theme.primary} />
            <Text style={[styles.timePresetText, { color: theme.primary }]}>Now</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.timePresetChip, { backgroundColor: theme.pillBg }]}
            onPress={() => {
              setSelectedHour(9);
              setSelectedMinute(0);
              setSelectedPeriod('AM');
            }}
          >
            <Text style={[styles.timePresetText, { color: theme.onSurface }]}>09:00 AM</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.timePresetChip, { backgroundColor: theme.pillBg }]}
            onPress={() => {
              setSelectedHour(1);
              setSelectedMinute(0);
              setSelectedPeriod('PM');
            }}
          >
            <Text style={[styles.timePresetText, { color: theme.onSurface }]}>01:00 PM</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.timePresetChip, { backgroundColor: theme.pillBg }]}
            onPress={() => {
              setSelectedHour(8);
              setSelectedMinute(0);
              setSelectedPeriod('PM');
            }}
          >
            <Text style={[styles.timePresetText, { color: theme.onSurface }]}>08:00 PM</Text>
          </TouchableOpacity>
        </View>

        {/* Actions Row */}
        <View style={styles.quickModalBtnRow}>
          <TouchableOpacity
            style={[styles.quickModalBtn, { backgroundColor: theme.pillBg }]}
            onPress={onClose}
          >
            <Text style={{ color: theme.onSurface }}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickModalBtn, { backgroundColor: theme.primary }]}
            onPress={handleSaveTime}
          >
            <Text style={{ color: theme.onPrimary, fontWeight: '700' }}>Confirm Time</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  quickModalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  quickModalBox: {
    width: '100%',
    maxWidth: 340,
    borderRadius: M3Shape.extraLarge,
    padding: 20,
    gap: 12,
  },
  quickModalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  quickModalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 6,
  },
  quickModalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: M3Shape.full,
  },
  clockModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 2,
  },
  clockTimeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  clockTimeSegment: {
    width: 68,
    height: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clockTimeText: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  clockColon: {
    fontSize: 28,
    fontWeight: '800',
    marginHorizontal: 2,
  },
  periodToggleBox: {
    flexDirection: 'column',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  periodBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodText: {
    fontSize: 11.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  clockModeBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 2,
    marginBottom: 4,
  },
  clockModeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: M3Shape.full,
  },
  clockModeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  clockDial: {
    width: 230,
    height: 230,
    borderRadius: 115,
    alignSelf: 'center',
    position: 'relative',
    marginVertical: 4,
  },
  clockHandContainer: {
    position: 'absolute',
    width: 230,
    height: 230,
    alignItems: 'center',
  },
  clockHandLine: {
    width: 2.5,
    height: 84,
    marginTop: 31,
    borderRadius: 1.5,
  },
  clockHandCircle: {
    position: 'absolute',
    top: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  clockCenterPin: {
    position: 'absolute',
    top: 111,
    left: 111,
    width: 8,
    height: 8,
    borderRadius: 4,
    zIndex: 15,
  },
  clockNumberItem: {
    position: 'absolute',
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  clockNumberText: {
    fontSize: 15,
  },
  timePresetsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    gap: 6,
  },
  timePresetChip: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: M3Shape.full,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  timePresetText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
});
