import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateWorkingDays, checkDateStatus } from './workingDays';

// Test 1: Calculate working days between two specific dates
// 2024-01-01 (Mon, New Year's Day, not in your holiday list) to 2024-01-06 (Sat)
test('calculateWorkingDays: 2024-01-01 to 2024-01-06', async () => {
  const startDate = '2024-01-01';
  const endDate = '2024-01-06';
  const workingDays = await calculateWorkingDays(startDate, endDate);
  // 1st (Mon), 2nd (Tue), 3rd (Wed), 4th (Thu), 5th (Fri) are weekdays, 6th (Sat) is weekend
  // If no holidays in this range, expect 5 working days
  assert.equal(workingDays, 5);
});

test('checkDateStatus: day-by-day breakdown 2024-01-01 to 2024-01-06', async () => {
  const expected = [
    { date: '2024-01-01', isWorkingDay: true },
    { date: '2024-01-02', isWorkingDay: true },
    { date: '2024-01-03', isWorkingDay: true },
    { date: '2024-01-04', isWorkingDay: true },
    { date: '2024-01-05', isWorkingDay: true },
    { date: '2024-01-06', isWorkingDay: false }, // Saturday
  ];
  for (const { date, isWorkingDay } of expected) {
    const status = await checkDateStatus(date);
    assert.equal(status.isWorkingDay, isWorkingDay, `${date} should be ${isWorkingDay ? 'working' : 'non-working'}`);
  }
});

// Test 2: Calculate working days to expiry for an option contract
// Republic Day (2024-01-26) is a holiday in your list
// If today is before 2024-01-26, this will count working days up to that date
// For test, let's use a fixed start date

test('calculateWorkingDaysToExpiry: Republic Day 2024-01-26', async () => {
  // Let's simulate from 2024-01-22 (Mon) to 2024-01-26 (Fri, Republic Day)
  const startDate = '2024-01-22';
  const expiryDate = '2024-01-26';
  const workingDays = await calculateWorkingDays(startDate, expiryDate);
  // 22 (Mon), 23 (Tue), 24 (Wed), 25 (Thu) are working, 26 (Fri) is holiday
  assert.equal(workingDays, 4);

  // Check expiry date status
  const expiryStatus = await checkDateStatus(expiryDate);
  assert.equal(expiryStatus.isWorkingDay, false);
  assert.equal(expiryStatus.isHoliday, true);
  assert.match(expiryStatus.holidayName || '', /Republic Day/);
});

// Test 3: Check multiple important dates for holiday status
const importantDates = [
  { date: '2024-01-26', holiday: true }, // Republic Day
  { date: '2024-03-25', holiday: true }, // Holi
  { date: '2024-08-15', holiday: true }, // Independence Day
  { date: '2024-10-02', holiday: true }, // Gandhi Jayanti
  { date: '2024-12-25', holiday: true }, // Christmas
];

test('checkDateStatus: important holidays', async () => {
  for (const { date, holiday } of importantDates) {
    const status = await checkDateStatus(date);
    assert.equal(status.isHoliday, holiday, `${date} should ${holiday ? '' : 'not '}be a holiday`);
    assert.equal(status.isWorkingDay, false, `${date} should not be a working day`);
  }
});
