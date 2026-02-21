/**
 * Hybrid Crowd Detection System
 * 
 * Combines multiple data sources and heuristics to estimate venue busyness:
 * 1. Category-based time patterns (beaches busy 10am-6pm, malls 12pm-8pm)
 * 2. Day of week patterns (attractions busier on weekends)
 * 3. Special venue types (museums quiet mornings, restaurants peak lunch/dinner)
 * 
 * No external API required - works with any place dynamically.
 */

export interface FetchCrowdDataArgs {
  name: string;
  category?: string;
  lat: number;
  lng: number;
  isIndoor?: boolean;
}

export interface CrowdDataResult {
  busyNow: number; // 0..100 - current estimated busyness
  peakHours: string[]; // ["17:00", "18:00"] - predicted peak hours today
  raw: any;
}

/**
 * Category-based crowd patterns
 * Maps place categories to their typical peak hours and busyness patterns
 */
const CATEGORY_PATTERNS: Record<string, {
  peakHours: number[]; // Hours (0-23) when typically busy
  baseBusyness: number; // Base busyness level (0-100)
  weekendBoost: number; // Additional busyness on weekends
}> = {
  // Beaches & Parks
  "Beach": { peakHours: [11, 12, 13, 14, 15, 16, 17], baseBusyness: 40, weekendBoost: 30 },
  "Park": { peakHours: [9, 10, 16, 17, 18], baseBusyness: 30, weekendBoost: 25 },
  "Garden": { peakHours: [9, 10, 11, 16, 17], baseBusyness: 25, weekendBoost: 20 },
  
  // Shopping & Malls
  "Mall": { peakHours: [12, 13, 14, 18, 19, 20], baseBusyness: 50, weekendBoost: 35 },
  "Shopping Center": { peakHours: [12, 13, 14, 18, 19, 20], baseBusyness: 50, weekendBoost: 35 },
  "Market": { peakHours: [9, 10, 11, 17, 18, 19], baseBusyness: 45, weekendBoost: 30 },
  
  // Restaurants & Cafes
  "Restaurant": { peakHours: [12, 13, 19, 20, 21], baseBusyness: 40, weekendBoost: 30 },
  "Cafe": { peakHours: [9, 10, 15, 16, 17], baseBusyness: 35, weekendBoost: 25 },
  "Bar": { peakHours: [19, 20, 21, 22, 23], baseBusyness: 45, weekendBoost: 35 },
  "Food Court": { peakHours: [12, 13, 19, 20], baseBusyness: 50, weekendBoost: 30 },
  
  // Museums & Cultural
  "Museum": { peakHours: [11, 12, 13, 14, 15], baseBusyness: 35, weekendBoost: 40 },
  "Art Gallery": { peakHours: [11, 12, 13, 14, 15], baseBusyness: 30, weekendBoost: 35 },
  "Historical Site": { peakHours: [10, 11, 12, 13, 14], baseBusyness: 40, weekendBoost: 45 },
  "Monument": { peakHours: [10, 11, 12, 16, 17], baseBusyness: 35, weekendBoost: 40 },
  
  // Entertainment
  "Theater": { peakHours: [19, 20, 21, 22], baseBusyness: 30, weekendBoost: 40 },
  "Cinema": { peakHours: [18, 19, 20, 21, 22], baseBusyness: 40, weekendBoost: 45 },
  "Amusement Park": { peakHours: [11, 12, 13, 14, 15, 16], baseBusyness: 50, weekendBoost: 40 },
  "Zoo": { peakHours: [10, 11, 12, 13, 14], baseBusyness: 40, weekendBoost: 45 },
  "Aquarium": { peakHours: [11, 12, 13, 14, 15], baseBusyness: 35, weekendBoost: 40 },
  
  // Religious & Spiritual
  "Temple": { peakHours: [6, 7, 8, 17, 18, 19], baseBusyness: 30, weekendBoost: 40 },
  "Church": { peakHours: [9, 10, 11, 17, 18], baseBusyness: 25, weekendBoost: 50 },
  "Mosque": { peakHours: [12, 13, 17, 18, 19, 20], baseBusyness: 30, weekendBoost: 35 },
  
  // Sports & Recreation
  "Stadium": { peakHours: [18, 19, 20, 21], baseBusyness: 20, weekendBoost: 60 },
  "Gym": { peakHours: [6, 7, 8, 17, 18, 19], baseBusyness: 45, weekendBoost: 20 },
  "Swimming Pool": { peakHours: [10, 11, 16, 17, 18], baseBusyness: 35, weekendBoost: 35 },
  
  // Default for unknown categories
  "default": { peakHours: [12, 13, 14, 17, 18, 19], baseBusyness: 40, weekendBoost: 25 },
};

/**
 * Fetch crowd data using hybrid heuristics
 * Works for any place without requiring external APIs
 */
export async function fetchCrowdData(
  args: FetchCrowdDataArgs
): Promise<CrowdDataResult> {
  const { name, category, lat, lng, isIndoor } = args;
  
  const now = new Date();
  const currentHour = now.getHours();
  const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday
  const isWeekend = currentDay === 0 || currentDay === 6;
  
  // Get pattern for this category
  const pattern = getPatternForCategory(category);
  
  // Calculate current busyness
  const busyNow = calculateCurrentBusyness(currentHour, isWeekend, pattern);
  
  // Get peak hours for today
  const peakHours = getPeakHours(pattern, isWeekend);
  
  return {
    busyNow,
    peakHours,
    raw: {
      source: "hybrid-heuristics",
      category,
      isWeekend,
      currentHour,
      pattern: pattern,
    },
  };
}

/**
 * Get crowd pattern for a category
 */
function getPatternForCategory(category?: string) {
  if (!category) {
    return CATEGORY_PATTERNS["default"];
  }
  
  // Try exact match first
  if (CATEGORY_PATTERNS[category]) {
    return CATEGORY_PATTERNS[category];
  }
  
  // Try partial matches
  const categoryLower = category.toLowerCase();
  for (const [key, pattern] of Object.entries(CATEGORY_PATTERNS)) {
    if (categoryLower.includes(key.toLowerCase()) || key.toLowerCase().includes(categoryLower)) {
      return pattern;
    }
  }
  
  return CATEGORY_PATTERNS["default"];
}

/**
 * Calculate current busyness based on hour and day
 */
function calculateCurrentBusyness(
  currentHour: number,
  isWeekend: boolean,
  pattern: typeof CATEGORY_PATTERNS["default"]
): number {
  let busyness = pattern.baseBusyness;
  
  // Add weekend boost
  if (isWeekend) {
    busyness += pattern.weekendBoost;
  }
  
  // Check if current hour is a peak hour
  const isPeakHour = pattern.peakHours.includes(currentHour);
  if (isPeakHour) {
    // Peak hour - add 30-40 points
    busyness += 35;
  } else {
    // Check if within 1 hour of peak (shoulder hours)
    const isShoulderHour = pattern.peakHours.some(
      peak => Math.abs(peak - currentHour) === 1
    );
    if (isShoulderHour) {
      // Shoulder hour - add 15-20 points
      busyness += 17;
    }
  }
  
  // Add some randomness (±5) for realism
  const randomness = Math.floor(Math.random() * 11) - 5; // -5 to +5
  busyness += randomness;
  
  // Clamp to 0-100
  return Math.min(100, Math.max(0, busyness));
}

/**
 * Get list of peak hours for today
 */
function getPeakHours(
  pattern: typeof CATEGORY_PATTERNS["default"],
  isWeekend: boolean
): string[] {
  // If it's a weekend and has significant weekend boost, expand peak hours
  let peakHours = [...pattern.peakHours];
  
  if (isWeekend && pattern.weekendBoost >= 30) {
    // Add shoulder hours for very popular weekend spots
    const expandedPeaks = new Set(peakHours);
    peakHours.forEach(hour => {
      if (hour > 0) expandedPeaks.add(hour - 1);
      if (hour < 23) expandedPeaks.add(hour + 1);
    });
    peakHours = Array.from(expandedPeaks).sort((a, b) => a - b);
  }
  
  // Format as HH:00 strings
  return peakHours.map(hour => {
    const hourStr = String(hour).padStart(2, "0");
    return `${hourStr}:00`;
  });
}

/**
 * Backward compatibility export
 * @deprecated Use fetchCrowdData instead
 */
export const fetchBestTimeCrowd = fetchCrowdData;

/**
 * Backward compatibility type
 * @deprecated Use FetchCrowdDataArgs instead
 */
export type FetchBestTimeCrowdArgs = FetchCrowdDataArgs;

/**
 * Backward compatibility type
 * @deprecated Use CrowdDataResult instead
 */
export type BestTimeCrowdResult = CrowdDataResult;
