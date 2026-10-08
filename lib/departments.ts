export type DepartmentId =
  | "fire_rescue"
  | "police"
  | "solid_waste"
  | "water_sanitation"
  | "veterinary"
  | "road_maintenance"
  | "general";

export const DEPARTMENTS: Record<
  DepartmentId,
  { name: string; emoji: string; blurb: string; phone: string; emergency: boolean }
> = {
  fire_rescue: {
    name: "Fire and Rescue Services Unit",
    emoji: "🚒",
    blurb: "Fires, rescues, trapped persons, electrical safety",
    phone: "",
    emergency: true,
  },
  police: {
    name: "Police Department",
    emoji: "🚔",
    blurb: "Petty crime, vandalism, public safety",
    phone: "+260975170412",
    emergency: true,
  },
  solid_waste: {
    name: "Solid Waste Management",
    emoji: "🗑️",
    blurb: "Rubbish, illegal dumping, litter",
    phone: "",
    emergency: false,
  },
  water_sanitation: {
    name: "Water and Sanitation",
    emoji: "💧",
    blurb: "Drains, leaks, sewage, water supply",
    phone: "",
    emergency: false,
  },
  veterinary: {
    name: "Veterinary Services",
    emoji: "🐾",
    blurb: "Stray, dead or dangerous animals",
    phone: "",
    emergency: false,
  },
  road_maintenance: {
    name: "Road Maintenance Department",
    emoji: "🚧",
    blurb: "Potholes, road damage, street lights",
    phone: "",
    emergency: false,
  },
  general: {
    name: "General Council Office",
    emoji: "🏛️",
    blurb: "Anything else the council should see",
    phone: "",
    emergency: false,
  },
};

export const DEPARTMENT_IDS = Object.keys(DEPARTMENTS) as DepartmentId[];

export type CategoryId =
  | "pothole"
  | "road_damage"
  | "street_light_out"
  | "blocked_drain"
  | "water_leak"
  | "sewage"
  | "illegal_dumping"
  | "litter"
  | "stray_animal"
  | "dead_animal"
  | "animal_attack"
  | "petty_crime"
  | "vandalism"
  | "fire_hazard"
  | "person_in_danger"
  | "downed_powerline"
  | "power_fault"
  | "other";

export const CATEGORIES: Record<
  CategoryId,
  { label: string; emoji: string; dept: DepartmentId }
> = {
  pothole: { label: "Pothole", emoji: "🕳️", dept: "road_maintenance" },
  road_damage: { label: "Road / pavement damage", emoji: "🚧", dept: "road_maintenance" },
  street_light_out: { label: "Street light out", emoji: "💡", dept: "road_maintenance" },
  blocked_drain: { label: "Blocked drain", emoji: "🌧️", dept: "water_sanitation" },
  water_leak: { label: "Water leak / burst pipe", emoji: "💧", dept: "water_sanitation" },
  sewage: { label: "Sewage / sanitation", emoji: "🚽", dept: "water_sanitation" },
  illegal_dumping: { label: "Illegal dumping", emoji: "🚜", dept: "solid_waste" },
  litter: { label: "Litter / full bin", emoji: "🗑️", dept: "solid_waste" },
  stray_animal: { label: "Stray animal", emoji: "🐕", dept: "veterinary" },
  dead_animal: { label: "Dead animal", emoji: "🐾", dept: "veterinary" },
  animal_attack: { label: "Dangerous / attacking animal", emoji: "⚠️", dept: "veterinary" },
  petty_crime: { label: "Petty crime", emoji: "🚔", dept: "police" },
  vandalism: { label: "Vandalism", emoji: "🔨", dept: "police" },
  fire_hazard: { label: "Fire / fire hazard", emoji: "🔥", dept: "fire_rescue" },
  person_in_danger: { label: "Person trapped / in danger", emoji: "🆘", dept: "fire_rescue" },
  downed_powerline: { label: "Downed / live powerline", emoji: "⚡", dept: "fire_rescue" },
  power_fault: { label: "Power fault", emoji: "🔌", dept: "fire_rescue" },
  other: { label: "Something else", emoji: "❓", dept: "general" },
};

export const CATEGORY_IDS = Object.keys(CATEGORIES) as CategoryId[];

export function normalizeCategory(raw: string | undefined | null): CategoryId {
  if (!raw) return "other";
  if (raw === "not_infrastructure") return "other";
  return (CATEGORY_IDS as string[]).includes(raw) ? (raw as CategoryId) : "other";
}

export function deptOf(category: string): DepartmentId {
  return (CATEGORIES as Record<string, { dept: DepartmentId }>)[category]?.dept ?? "general";
}

export function deptInfo(id: string | null | undefined) {
  return (
    (DEPARTMENTS as Record<string, (typeof DEPARTMENTS)[DepartmentId]>)[id ?? ""] ??
    DEPARTMENTS.general
  );
}

export function catInfo(id: string | null | undefined) {
  return (
    (CATEGORIES as Record<string, (typeof CATEGORIES)[CategoryId]>)[id ?? ""] ?? CATEGORIES.other
  );
}
