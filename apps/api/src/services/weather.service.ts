/**
 * Weather service - Analyze OpenWeather forecast data
 */
import type { ItineraryItem } from "@adaptive/types";

interface ForecastItem {
  dt: number;
  dt_txt: string;
  main: {
    temp: number;
    feels_like: number;
    humidity: number;
  };
  weather: Array<{
    main: string;
    description: string;
  }>;
  pop: number; // Probability of precipitation (0-1)
}

interface OpenWeatherForecastResponse {
  list: ForecastItem[];
}

/**
 * Analyze weather forecast and identify risk hours
 * Returns summary and list of risky hours
 */
export function analyzeWeatherForecast(
  rawForecast: OpenWeatherForecastResponse,
  _itineraryItems?: ItineraryItem[]
): { summary: string; riskHours: string[] } {
  const riskHours: string[] = [];

  // Analyze each forecast slot
  for (const item of rawForecast.list) {
    const isRisky =
      item.pop >= 0.6 || // High probability of precipitation
      item.weather.some((w) =>
        ["Rain", "Thunderstorm", "Drizzle"].includes(w.main)
      );

    if (isRisky) {
      // Convert dt_txt "2026-02-21 15:00:00" to "15:00"
      const dateTime = new Date(item.dt * 1000);
      const hour = dateTime.getHours().toString().padStart(2, "0");
      const minute = dateTime.getMinutes().toString().padStart(2, "0");
      const timeStr = `${hour}:${minute}`;

      if (!riskHours.includes(timeStr)) {
        riskHours.push(timeStr);
      }
    }
  }

  // Generate summary
  let summary: string;
  if (riskHours.length === 0) {
    summary = "No rain risk detected";
  } else if (riskHours.length === 1) {
    summary = `Rain risk around ${riskHours[0]}`;
  } else if (riskHours.length === 2) {
    summary = `Rain risk between ${riskHours[0]}–${riskHours[1]}`;
  } else {
    const firstHour = riskHours[0];
    const lastHour = riskHours[riskHours.length - 1];
    summary = `Rain risk between ${firstHour}–${lastHour}`;
  }

  return { summary, riskHours };
}
