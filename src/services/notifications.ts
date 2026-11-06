import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { RecurringBill, AppSettings } from '../types';
import { formatCurrency } from '../utils/format';

// Configure foreground presentation behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export const setupNotificationChannelAsync = async () => {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('budget-reminders', {
      name: 'Budget & Bill Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6366F1',
    });
  }
};

export const requestNotificationPermissionsAsync = async (): Promise<boolean> => {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      return false;
    }
    await setupNotificationChannelAsync();
    return true;
  } catch (err) {
    console.warn('Error requesting notification permissions:', err);
    return false;
  }
};

export const checkNotificationPermissionsAsync = async (): Promise<boolean> => {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
};

/**
 * Schedule recurring bill due date notification
 */
export const scheduleBillReminderAsync = async (
  bill: RecurringBill,
  currency: string
): Promise<string | null> => {
  if (bill.is_active === false || bill.reminder_enabled === false) {
    return null;
  }

  try {
    const dueDateStr = bill.next_due_date;
    if (!dueDateStr) return null;

    const parts = dueDateStr.split('-');
    if (parts.length < 3) return null;

    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);

    const targetDate = new Date(year, month, day, 9, 0, 0); // 9:00 AM on due date
    const now = new Date();

    // If the due time is in the future, schedule notification
    if (targetDate.getTime() > now.getTime()) {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: `Bill Due Today: ${bill.name}`,
          body: `Your ${bill.name} bill (${formatCurrency(bill.amount, currency)}) is due today. Tap to mark as paid.`,
          sound: true,
          data: { billId: bill.id, type: 'bill-reminder' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: targetDate,
          channelId: 'budget-reminders',
        },
      });
      return id;
    }
    return null;
  } catch (err) {
    console.warn('Failed to schedule bill reminder:', err);
    return null;
  }
};

/**
 * Schedule daily morning allowance notification
 */
export const scheduleDailyAllowanceReminderAsync = async (
  timeString: string = '08:30'
): Promise<string | null> => {
  try {
    const [hStr, mStr] = timeString.split(':');
    const hour = parseInt(hStr || '8', 10);
    const minute = parseInt(mStr || '30', 10);

    return await Notifications.scheduleNotificationAsync({
      content: {
        title: `Daily Spending Allowance`,
        body: `Good morning! Check today's daily allowance and track your spending.`,
        sound: true,
        data: { type: 'daily-allowance' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        channelId: 'budget-reminders',
      },
    });
  } catch (err) {
    console.warn('Failed to schedule daily allowance reminder:', err);
    return null;
  }
};

/**
 * Schedule evening expense check-in notification
 */
export const scheduleEveningLogReminderAsync = async (
  timeString: string = '20:30'
): Promise<string | null> => {
  try {
    const [hStr, mStr] = timeString.split(':');
    const hour = parseInt(hStr || '20', 10);
    const minute = parseInt(mStr || '30', 10);

    return await Notifications.scheduleNotificationAsync({
      content: {
        title: `Evening Expense Check-in`,
        body: `Did you spend any cash today? Take 15 seconds to log your expenses!`,
        sound: true,
        data: { type: 'evening-checkin' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        channelId: 'budget-reminders',
      },
    });
  } catch (err) {
    console.warn('Failed to schedule evening reminder:', err);
    return null;
  }
};

/**
 * Send immediate test notification
 */
export const sendTestNotificationAsync = async (): Promise<boolean> => {
  const granted = await requestNotificationPermissionsAsync();
  if (!granted) return false;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Just Budget Reminders Active! 🔔',
      body: 'Notifications and bill reminders are working perfectly on your device.',
      sound: true,
    },
    trigger: null,
  });
  return true;
};

/**
 * Sync all reminders based on user settings and recurring bills
 */
export const syncAllRemindersAsync = async (params: {
  settings: AppSettings;
  recurringBills: RecurringBill[];
}) => {
  const { settings, recurringBills } = params;

  if (settings.notifications_enabled === false) {
    await Notifications.cancelAllScheduledNotificationsAsync();
    return;
  }

  const hasPermission = await checkNotificationPermissionsAsync();
  if (!hasPermission) return;

  // Clear existing scheduled notifications to avoid duplicates
  await Notifications.cancelAllScheduledNotificationsAsync();

  // 1. Bill Reminders
  if (settings.bill_reminders_enabled !== false) {
    for (const bill of recurringBills) {
      if (bill.is_active !== false && bill.reminder_enabled !== false) {
        await scheduleBillReminderAsync(bill, settings.base_currency || 'TZS');
      }
    }
  }

  // 2. Daily Morning Allowance
  if (settings.daily_allowance_reminder_enabled) {
    await scheduleDailyAllowanceReminderAsync(settings.daily_reminder_time || '08:30');
  }

  // 3. Evening Expense Check-in
  if (settings.evening_reminder_enabled) {
    await scheduleEveningLogReminderAsync(settings.evening_reminder_time || '20:30');
  }
};
