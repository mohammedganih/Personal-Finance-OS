'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CalendarEntry, ApiResponse } from '@/types';

export function useEMICalendar(monthsAhead = 3) {
  return useQuery({
    queryKey: ['debt', 'calendar', monthsAhead],
    queryFn: async () => {
      const res = await api.get<ApiResponse<CalendarEntry[]>>('/debt/calendar', { params: { months: monthsAhead } });
      return res.data.data;
    },
  });
}

