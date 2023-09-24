import type { UiInstrument } from '@/types';
import { Margin } from '@/types/shoonya';
import { clsx, type ClassValue } from 'clsx';
import ky from 'ky';
import { twMerge } from 'tailwind-merge';

export const getKeys = <T extends Object>(object: T) =>
  Object.keys(object) as Array<keyof T>;

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const getMonthName = (monthIndex: number) => {
  // Adjust from 0 based month to irl month index
  const numericMonth = (monthIndex + 1).toString();
  const monthDate = new Date(numericMonth);
  return Intl.DateTimeFormat('en', { month: 'short' })
    .format(monthDate)
    .toUpperCase();
};

export const getExpiryOptions = (optionCount: number) => {
  const date = new Date();
  let currentMonthIndex = date.getMonth();
  let currentYear = date.getFullYear();

  const options: string[] = [];

  for (let i = 0; i < optionCount; i++) {
    options.push(`${getMonthName(currentMonthIndex)}-${currentYear}`);

    currentMonthIndex = currentMonthIndex + 1;
    if (currentMonthIndex > 11) {
      currentMonthIndex = 0;
      currentYear = currentYear + 1;
    }
  }

  return options;
};

export const displayInr = (amount: number) =>
  '₹ ' +
  new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(amount);

export const getRandomIndex = (min: number, max: number) =>
  Math.random() * (max - min) + min;

export const getTodayAsParam = () =>
  new Date().toISOString().slice(0, 10).split('-').reverse().join('');

export const getReturnValue = async (i: UiInstrument) => {
  const { bid, lotSize, tradingSymbol } = i;
  try {
    const margin = await ky
      .get('/api/margin', {
        searchParams: { price: bid, quantity: lotSize, tradingSymbol },
      })
      .json<Margin>();
    return ((bid - 0.05) * lotSize * 100) / Number(margin.ordermargin);
  } catch (error) {
    console.error('Could not get margin for', tradingSymbol, error);
    return 0;
  }
};
