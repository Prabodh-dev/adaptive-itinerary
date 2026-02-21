/**
 * Category mapping utility for interests and avoid preferences
 */

// Map user interests to Foursquare categories
export const INTEREST_CATEGORY_MAP: Record<string, string[]> = {
  history: [
    "History Museum",
    "Historic Site",
    "Monument",
    "Landmark",
    "Archaeological Site",
    "Castle",
    "Fort",
  ],
  art: [
    "Art Museum",
    "Art Gallery",
    "Museum",
    "Exhibit",
    "Theater",
    "Concert Hall",
    "Performance Venue",
  ],
  food: [
    "Restaurant",
    "Café",
    "Coffee Shop",
    "Bakery",
    "Bar",
    "Pub",
    "Food Court",
    "Street Food",
    "Food Truck",
  ],
  nature: [
    "Park",
    "Garden",
    "Nature Reserve",
    "Trail",
    "Beach",
    "Lake",
    "Waterfall",
    "Mountain",
    "Forest",
    "Zoo",
    "Aquarium",
  ],
  shopping: [
    "Shopping Mall",
    "Market",
    "Boutique",
    "Store",
    "Plaza",
  ],
  religion: [
    "Church",
    "Temple",
    "Mosque",
    "Synagogue",
    "Cathedral",
    "Shrine",
  ],
  entertainment: [
    "Amusement Park",
    "Theme Park",
    "Casino",
    "Nightclub",
    "Movie Theater",
    "Bowling Alley",
    "Arcade",
  ],
  sports: [
    "Stadium",
    "Arena",
    "Sports Club",
    "Gym",
    "Swimming Pool",
    "Golf Course",
  ],
};

// Map simple avoid keywords to category keywords
const SIMPLE_AVOID_MAP: Record<string, string[]> = {
  history: ["no-museums", "no-religion"],
  art: ["no-museums"],
  food: ["no-food"],
  nature: ["no-nature"],
  museums: ["no-museums"],
  religion: ["no-religion"],
  nightlife: ["no-nightlife"],
  sports: ["no-sports"],
  shopping: ["no-shopping"],
};

/**
 * Resolve avoid keywords to full category filters
 */
export function resolveAvoidKeywords(avoid: string[]): string[] {
  const resolved: string[] = [];
  for (const item of avoid) {
    const mapped = SIMPLE_AVOID_MAP[item.toLowerCase()];
    if (mapped) {
      resolved.push(...mapped);
    } else if (item.startsWith("no-")) {
      resolved.push(item);
    }
  }
  return resolved;
}

// Categories to avoid based on user preferences
export const AVOID_CATEGORY_KEYWORDS: Record<string, string[]> = {
  "no-food": [
    "Restaurant", "Café", "Coffee Shop", "Bakery", "Bar", "Pub", "Food",
    "Pizzeria", "Burger", "Donut", "Hot Dog", "Ice Cream", "Cake", "Tea",
    "Kitchen", "Diner", "Steakhouse", "Seafood", "Sushi", "Taco", "Burrito",
    "Noodle", "Pho", "Thai", "Chinese", "Indian", "Italian", "Mexican",
    "Bistro", "Eatery", "Grill", "House", "Cafe", "Chaat", "Kofte", "Takoyaki",
  ],
  "no-nature": [
    "Park", "Garden", "Beach", "Lake", "Forest", "Nature", "Trail",
    "Zoo", "Aquarium", "Botanical", "Wildlife", "Reservoir",
  ],
  "no-shopping": [
    "Shopping", "Market", "Boutique", "Mall", "Plaza", "Store", "Retail",
    "Outlet", "Plaza", "emporium",
  ],
  "no-nightlife": [
    "Nightclub", "Bar", "Pub", "Casino", "Club", "Lounge", "Karaoke",
  ],
  "no-museums": [
    "Museum", "Art Gallery", "Exhibi", "Gallery", "Collection",
  ],
  "no-religion": [
    "Church", "Temple", "Mosque", "Synagogue", "Cathedral", "Shrine",
    "Chapel", "Abbey", "Monastery",
  ],
  "no-sports": [
    "Stadium", "Arena", "Sports", "Gym", "Swimming", "Golf", "Tennis",
    "Baseball", "Football", "Soccer", "Basketball", "Pool",
  ],
};

/**
 * Get Foursquare category IDs for given interests
 */
export function getCategoriesForInterests(interests: string[]): string[] {
  const categories: string[] = [];
  
  for (const interest of interests) {
    const lower = interest.toLowerCase();
    const mapped = INTEREST_CATEGORY_MAP[lower];
    if (mapped) {
      categories.push(...mapped);
    } else {
      // If no mapping, use the interest itself as a search term
      categories.push(interest);
    }
  }
  
  return categories;
}

/**
 * Check if a place category should be avoided
 */
export function shouldAvoidCategory(placeCategory: string | undefined, avoid: string[]): boolean {
  if (!placeCategory || avoid.length === 0) return false;
  
  const placeCategoryLower = placeCategory.toLowerCase();
  
  for (const avoidItem of avoid) {
    const avoidLower = avoidItem.toLowerCase();
    
    // Check direct match
    if (placeCategoryLower.includes(avoidLower)) {
      return true;
    }
    
    // Check against avoid keywords
    const avoidKeywords = AVOID_CATEGORY_KEYWORDS[avoidLower];
    if (avoidKeywords) {
      for (const keyword of avoidKeywords) {
        if (placeCategoryLower.includes(keyword.toLowerCase())) {
          return true;
        }
      }
    }
  }
  
  return false;
}

/**
 * Filter places based on interests and avoid preferences
 */
export function filterPlacesByPreferences<T extends { category?: string }>(
  places: T[],
  interests: string[],
  avoid: string[]
): { matched: T[]; excluded: T[] } {
  const matched: T[] = [];
  const excluded: T[] = [];
  
  for (const place of places) {
    // Check if should be avoided
    if (shouldAvoidCategory(place.category, avoid)) {
      excluded.push(place);
      continue;
    }
    
    // If no interests specified, include all (non-avoided)
    if (interests.length === 0) {
      matched.push(place);
      continue;
    }
    
    // Check if matches interests
    const placeCategoryLower = (place.category || "").toLowerCase();
    const matchesInterest = interests.some(interest => {
      const lower = interest.toLowerCase();
      const mapped = INTEREST_CATEGORY_MAP[lower];
      if (mapped) {
        return mapped.some(cat => placeCategoryLower.includes(cat.toLowerCase()));
      }
      return placeCategoryLower.includes(lower);
    });
    
    if (matchesInterest) {
      matched.push(place);
    } else {
      // Don't exclude - just don't prioritize
      // Include places that don't match but aren't avoided
      matched.push(place);
    }
  }
  
  return { matched, excluded };
}
