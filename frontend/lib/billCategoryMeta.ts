import {
  Film, Zap, ShieldCheck, Dumbbell, Landmark, Laptop, GraduationCap,
  Bus, ShoppingBag, Users, Home, Stethoscope, Building2, Package, LucideIcon,
} from 'lucide-react';
import { BILL_CATEGORY_META, BILL_CATEGORY_FALLBACK } from './constants';

// Subscription-like categories, the same convention the existing bill
// insights engine already applies once (its annual-vs-monthly nudge checks
// ['Software','Entertainment']) -- extended by the one other genuinely
// membership-like category and applied consistently as the actual
// Subscriptions table filter, not just inside one insight.
export const SUBSCRIPTION_CATEGORIES = ['Entertainment', 'Software', 'Fitness'];

export function isSubscriptionCategory(category: string): boolean {
  return SUBSCRIPTION_CATEGORIES.includes(category);
}

// Lucide equivalents of BILL_CATEGORY_META's emoji, for the light theme's
// icon-badge convention (real icons, not emoji, matching every other
// redesigned page) -- colors are unchanged, reused from that same map.
const BILL_CATEGORY_ICONS: Record<string, LucideIcon> = {
  Entertainment: Film,
  Utilities: Zap,
  Insurance: ShieldCheck,
  Fitness: Dumbbell,
  Finance: Landmark,
  Software: Laptop,
  Education: GraduationCap,
  Transport: Bus,
  Lifestyle: ShoppingBag,
  Family: Users,
  Housing: Home,
  Healthcare: Stethoscope,
  'Taxes & Government': Building2,
  Other: Package,
};

export function billCategoryIcon(category: string): LucideIcon {
  return BILL_CATEGORY_ICONS[category] ?? Package;
}

export function billCategoryColor(category: string): string {
  return (BILL_CATEGORY_META[category] ?? BILL_CATEGORY_FALLBACK).color;
}
