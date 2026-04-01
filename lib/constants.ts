// ═══════════════════════════════════════════════
// GAME BOY COLOR CONSTANTS
// ═══════════════════════════════════════════════

export const GB_COLORS = {
  BLACK: 0x0f380f,
  DARK: 0x306230,
  LIGHT: 0x8bac0f,
  WHITE: 0x9bbc0f,
} as const;

export const GB_HEX = {
  BLACK: "#0f380f",
  DARK: "#306230",
  LIGHT: "#8bac0f",
  WHITE: "#9bbc0f",
} as const;

// ═══════════════════════════════════════════════
// STAT COLORS FOR GRAPHS AND DISPLAYS
// ═══════════════════════════════════════════════

export const STAT_COLORS = {
  money: "#FFD700", // gold
  stability: "#4FC3F7", // light blue
  status: "#E040FB", // purple
  health: "#66BB6A", // green
  stress: "#EF5350", // red
  freedom: "#FF9800", // orange
  exposure: "#BDBDBD", // grey
} as const;

export const STAT_LABELS = {
  money: "Money",
  stability: "Stability",
  status: "Status",
  health: "Health",
  stress: "Stress",
  freedom: "Freedom",
  exposure: "Exposure",
} as const;

export type StatKey = keyof typeof STAT_COLORS;

// ═══════════════════════════════════════════════
// LOCATION TO BACKGROUND MAPPING
// ═══════════════════════════════════════════════

export const LOCATION_BACKGROUNDS: Record<string, string> = {
  nursery: "nursery",
  kitchen: "kitchen",
  classroom: "classroom",
  bedroom: "bedroom",
  dorm: "dorm",
  office: "office",
  nice_home: "nice_home",
  rundown: "rundown",
  prison: "prison",
  hospital: "hospital",
  bar: "bar",
  park: "park",
};

// ═══════════════════════════════════════════════
// AGE-BASED MUSIC TRACKS
// ═══════════════════════════════════════════════

export const AGE_MUSIC_THRESHOLDS = {
  childhood: { min: 0, max: 12, track: "childhood" },
  adult: { min: 13, max: 64, track: "adult" },
  elder: { min: 65, max: 110, track: "elder" },
  death: { min: -1, max: -1, track: "death" },
} as const;

export type MusicTrack = "childhood" | "adult" | "elder" | "death";

// ═══════════════════════════════════════════════
// SOUND EFFECTS
// ═══════════════════════════════════════════════

export const SFX_TYPES = [
  "click",
  "stat_up",
  "stat_down",
  "close_call",
  "death",
  "transition",
  "typewriter",
  "choice_hover",
] as const;

export type SFXType = (typeof SFX_TYPES)[number];

// ═══════════════════════════════════════════════
// API CONFIGURATION
// ═══════════════════════════════════════════════

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://life-sim-production.up.railway.app";

// ═══════════════════════════════════════════════
// GAME CONSTANTS
// ═══════════════════════════════════════════════

export const INITIAL_STATS = {
  money: 0.5,
  stability: 0.5,
  status: 0.5,
  health: 0.5,
  stress: 0.5,
  freedom: 0.5,
  exposure: 0.5,
} as const;

export const LOADING_MESSAGES = [
  "Generating life moment...",
  "Consulting the fates...",
  "Weaving your story...",
  "Calculating destiny...",
  "Simulating choices...",
];

// ═══════════════════════════════════════════════
// BACKGROUND IMAGES
// ═══════════════════════════════════════════════

export const BACKGROUNDS: Record<string, string> = {
  nursery: "/backgrounds/nursery.jpg",
  kitchen: "/backgrounds/kitchen.jpg",
  classroom: "/backgrounds/classroom.jpg",
  bedroom: "/backgrounds/bedroom.jpg",
  dorm: "/backgrounds/dorm.jpg",
  office: "/backgrounds/office.jpg",
  nice_home: "/backgrounds/nice_home.jpg",
  rundown: "/backgrounds/rundown.jpg",
  prison: "/backgrounds/prison.jpg",
  hospital: "/backgrounds/hospital.jpg",
  bar: "/backgrounds/bar.jpg",
  park: "/backgrounds/park.jpg",
};

// Location keywords to background mapping
export const BACKGROUND_MAPPING: Record<string, string> = {
  "nursery,crib,baby room": "nursery",
  "kitchen,cooking,dinner": "kitchen",
  "school,classroom,class,education,learning": "classroom",
  "bedroom,bed,sleep,room": "bedroom",
  "dorm,college,university,campus": "dorm",
  "office,work,job,career,business,meeting": "office",
  "mansion,nice home,wealthy,luxury,estate": "nice_home",
  "apartment,rundown,poor,shabby,small": "rundown",
  "jail,prison,cell,arrested,crime": "prison",
  "hospital,doctor,medical,clinic,emergency": "hospital",
  "bar,pub,club,party,drink,nightclub": "bar",
  "park,outside,outdoor,nature,garden,walk": "park",
};

// ═══════════════════════════════════════════════
// CITIES
// ═══════════════════════════════════════════════

export const CITIES = [
  "New York",
  "Los Angeles",
  "Chicago",
  "Houston",
  "Miami",
  "Seattle",
  "Denver",
  "Boston",
  "Atlanta",
  "San Francisco",
  "Detroit",
  "Phoenix",
];

// ═══════════════════════════════════════════════
// STAT CONFIGURATION
// ═══════════════════════════════════════════════

export const STAT_CONFIG = {
  money: { label: "Money", icon: "💰", color: "#FFD700" },
  stability: { label: "Stability", icon: "🏠", color: "#4FC3F7" },
  status: { label: "Status", icon: "⭐", color: "#E040FB" },
  health: { label: "Health", icon: "❤️", color: "#66BB6A" },
  stress: { label: "Stress", icon: "😰", color: "#EF5350" },
  freedom: { label: "Freedom", icon: "🕊️", color: "#FF9800" },
  exposure: { label: "Exposure", icon: "⚠️", color: "#BDBDBD" },
} as const;

// ═══════════════════════════════════════════════
// API URL
// ═══════════════════════════════════════════════

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://life-sim-production.up.railway.app";
