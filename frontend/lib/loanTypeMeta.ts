import { Home, Car, Briefcase, GraduationCap, Building2, Wallet, LucideIcon } from 'lucide-react';
import { LoanType } from '@/types';

// Shared between LoanOverviewDonut and YourLoansTable so the donut's
// segment colors/icons and the table's per-row icons stay consistent.
export const LOAN_TYPE_ICONS: Record<LoanType, LucideIcon> = {
  HOME: Home,
  CAR: Car,
  PERSONAL: Briefcase,
  EDUCATION: GraduationCap,
  BUSINESS: Building2,
  OTHER: Wallet,
};

export const LOAN_TYPE_COLORS: Record<LoanType, string> = {
  HOME: '#9085e9',
  PERSONAL: '#199e70',
  EDUCATION: '#d95926',
  CAR: '#c98500',
  BUSINESS: '#d55181',
  OTHER: '#8b8fa3',
};

export const CREDIT_CARD_BUCKET_COLOR = '#3987e5';
