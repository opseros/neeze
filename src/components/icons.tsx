import {
  Bug,
  Building2,
  Bus,
  Car,
  Droplets,
  Dumbbell,
  FlaskConical,
  GraduationCap,
  Hammer,
  Hospital,
  Hotel,
  Laptop,
  type LucideIcon,
  Paintbrush,
  Pill,
  Plug,
  ShoppingCart,
  Sparkles,
  Stethoscope,
  Store,
  Wrench,
  Zap,
} from 'lucide-react'

export const VERTICAL_ICONS: Record<string, LucideIcon> = {
  services: Wrench,
  health: Stethoscope,
  business: Store,
  market: ShoppingCart,
  education: GraduationCap,
  fitness: Dumbbell,
  travel: Bus,
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  electrician: Zap,
  plumber: Droplets,
  'vehicle-mechanic': Car,
  'home-cleaning': Sparkles,
  'appliance-repair': Plug,
  carpenter: Hammer,
  painter: Paintbrush,
  'pest-control': Bug,
  handyman: Wrench,
  'it-electronics-repair': Laptop,
  doctor: Stethoscope,
  clinic: Hospital,
  hospital: Building2,
  'diagnostic-centre': FlaskConical,
  'shops-businesses': Store,
  grocery: ShoppingCart,
  pharmacy: Pill,
  hardware: Hammer,
  school: GraduationCap,
  gym: Dumbbell,
  'bus-operator': Bus,
  hotel: Hotel,
}

export function CategoryIcon({ slug, vertical, className }: { slug?: string | null; vertical?: string | null; className?: string }) {
  const Icon = (slug && CATEGORY_ICONS[slug]) || (vertical && VERTICAL_ICONS[vertical]) || Store
  return <Icon className={className} aria-hidden strokeWidth={1.75} />
}
