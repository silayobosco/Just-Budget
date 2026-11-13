import { RecurringBill } from '../types';

export interface BillOccurrence {
  bill: RecurringBill;
  date: string; // YYYY-MM-DD
  isOriginalNextDue: boolean; // whether this is the immediate next_due_date
  isOverdue: boolean;
  isDueToday: boolean;
  isFuture: boolean;
}

/**
 * Projects occurrences of active recurring bills across a date range [startDate, endDate]
 */
export const getProjectedBillOccurrences = (
  bills: RecurringBill[],
  startDate: string,
  endDate: string,
  todayStr: string = new Date().toISOString().slice(0, 10)
): Map<string, BillOccurrence[]> => {
  const map = new Map<string, BillOccurrence[]>();

  const activeBills = bills.filter((b) => b.is_active !== false);

  activeBills.forEach((bill) => {
    if (!bill.next_due_date) return;

    let curDate = new Date(bill.next_due_date + 'T00:00:00');
    if (isNaN(curDate.getTime())) return;

    let occurrencesCount = bill.occurrences_count || 0;
    const endOccurrences = bill.end_occurrences;
    const endDateLimit = bill.end_date;
    const endType = bill.end_type || 'never';

    let isFirst = true;
    let iterationGuard = 0;

    // If next_due_date is before startDate (e.g. overdue), we should still include it
    // if curDate is before or on today and before endDate
    const curDateStr = curDate.toISOString().slice(0, 10);
    if (curDateStr < startDate && curDateStr <= todayStr) {
      // Overdue occurrence
      const isOverdue = curDateStr < todayStr;
      const isDueToday = curDateStr === todayStr;
      const occ: BillOccurrence = {
        bill,
        date: curDateStr,
        isOriginalNextDue: true,
        isOverdue,
        isDueToday,
        isFuture: false,
      };
      if (!map.has(curDateStr)) {
        map.set(curDateStr, []);
      }
      map.get(curDateStr)!.push(occ);
    }

    while (iterationGuard < 60) {
      iterationGuard++;
      const dateStr = curDate.toISOString().slice(0, 10);

      if (dateStr > endDate) break;

      if (endType === 'after_occurrences' && endOccurrences && occurrencesCount >= endOccurrences) {
        break;
      }
      if (endType === 'on_date' && endDateLimit && dateStr > endDateLimit) {
        break;
      }

      if (dateStr >= startDate && dateStr <= endDate) {
        const isOverdue = dateStr < todayStr;
        const isDueToday = dateStr === todayStr;
        const isFuture = dateStr > todayStr;

        const occ: BillOccurrence = {
          bill,
          date: dateStr,
          isOriginalNextDue: isFirst,
          isOverdue,
          isDueToday,
          isFuture,
        };

        if (!map.has(dateStr)) {
          map.set(dateStr, []);
        }
        // Avoid duplicate bill on same date
        if (!map.get(dateStr)!.some((o) => o.bill.id === bill.id)) {
          map.get(dateStr)!.push(occ);
        }
      }

      // Advance date
      isFirst = false;
      occurrencesCount++;

      if (bill.frequency === 'weekly') {
        curDate.setDate(curDate.getDate() + 7);
      } else if (bill.frequency === 'yearly') {
        curDate.setFullYear(curDate.getFullYear() + 1);
      } else {
        // Monthly: advance month, respecting due_day
        const nextMonth = curDate.getMonth() + 1;
        curDate.setMonth(nextMonth);
        if (bill.due_day) {
          const maxDays = new Date(curDate.getFullYear(), curDate.getMonth() + 1, 0).getDate();
          curDate.setDate(Math.min(bill.due_day, maxDays));
        }
      }
    }
  });

  return map;
};

/**
 * Returns bills that are currently overdue, due today, or due within the next N days
 */
export const getActiveBillAlerts = (
  bills: RecurringBill[],
  todayStr: string = new Date().toISOString().slice(0, 10),
  upcomingWindowDays: number = 3
) => {
  const active = bills.filter((b) => b.is_active !== false && Boolean(b.next_due_date));

  const overdue: RecurringBill[] = [];
  const dueToday: RecurringBill[] = [];
  const upcomingSoon: { bill: RecurringBill; daysUntil: number }[] = [];

  const today = new Date(todayStr + 'T00:00:00');
  const msInDay = 86400000;

  active.forEach((bill) => {
    const due = new Date(bill.next_due_date + 'T00:00:00');
    if (isNaN(due.getTime())) return;

    const diffDays = Math.round((due.getTime() - today.getTime()) / msInDay);

    if (diffDays < 0) {
      overdue.push(bill);
    } else if (diffDays === 0) {
      dueToday.push(bill);
    } else if (diffDays > 0 && diffDays <= upcomingWindowDays) {
      upcomingSoon.push({ bill, daysUntil: diffDays });
    }
  });

  return {
    overdue,
    dueToday,
    upcomingSoon,
    totalUrgent: overdue.length + dueToday.length,
  };
};
