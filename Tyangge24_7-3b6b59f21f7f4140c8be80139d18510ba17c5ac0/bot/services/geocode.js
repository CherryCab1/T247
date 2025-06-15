// services/geocode.js
import axios from "axios";

/**
 * Reverse geocode latitude and longitude into a readable address.
 * Uses Nominatim API (OpenStreetMap) – no API key needed.
 *
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<string|null>} - Displayable address string or null on failure
 */
export async function reverseGeocode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
    const res = await axios.get(url, {
      headers: {
        "User-Agent": "KutabareBot/1.0 (admin@kutabare.shop)",
      },
    });

    // Display name is a full address
    return res.data.display_name || null;
  } catch (err) {
    console.error("❌ Reverse geocode failed:", err.message);
    return null;
  }
}
