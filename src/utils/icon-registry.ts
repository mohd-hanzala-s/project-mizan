import {
  UtensilsCrossed,
  Fuel,
  ShoppingBag,
  Zap,
  Bike,
  HeartPulse,
  Film,
  Landmark,
  Wallet,
  ArrowLeftRight,
  MoreHorizontal,
  Banknote,
  CreditCard,
  Smartphone,
  ShieldCheck,
  PiggyBank,
  Briefcase,
  TrendingUp,
  Coins,
  type LucideIcon,
} from "lucide-react";

const ICON_REGISTRY: Record<string, LucideIcon> = {
  UtensilsCrossed,
  Fuel,
  ShoppingBag,
  Zap,
  Bike,
  HeartPulse,
  Film,
  Landmark,
  Wallet,
  ArrowLeftRight,
  MoreHorizontal,
  Banknote,
  CreditCard,
  Smartphone,
  ShieldCheck,
  PiggyBank,
  Briefcase,
  TrendingUp,
  Coins,
};

/** Falls back to a generic dot icon for any name not in the registry, so a
 * bad/missing icon string never crashes the UI. */
export function getIcon(name: string): LucideIcon {
  return ICON_REGISTRY[name] ?? MoreHorizontal;
}
