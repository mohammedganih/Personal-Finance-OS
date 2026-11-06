import {
  Film, Zap, ShieldCheck, Dumbbell, Landmark, Laptop, GraduationCap,
  Bus, ShoppingBag, Users, Home, Stethoscope, Building2, Package, LucideIcon,
} from 'lucide-react';

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
