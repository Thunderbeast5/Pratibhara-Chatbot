import axios from 'axios';

export const geocodeLocation = async (location) => {
  try {
    // Using OpenStreetMap Nominatim (free)
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: location,
        format: 'json',
        limit: 1
      },
      headers: {
        'User-Agent': 'ChatbotApp/1.0'
      }
    });

    if (response.data && response.data.length > 0) {
      const result = response.data[0];
      return {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
        displayName: result.display_name
      };
    }

    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
};

export const reverseGeocode = async (latitude, longitude) => {
  try {
    const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      params: {
        lat: latitude,
        lon: longitude,
        format: 'json'
      },
      headers: {
        'User-Agent': 'ChatbotApp/1.0'
      }
    });

    if (response.data) {
      return {
        city: response.data.address?.city || response.data.address?.town || response.data.address?.village,
        state: response.data.address?.state,
        country: response.data.address?.country,
        displayName: response.data.display_name
      };
    }

    return null;
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return null;
  }
};

export const searchNearbyPlaces = async (latitude, longitude, businessType, radius = 2000) => {
  try {
    // Using Overpass API for OpenStreetMap data
    const query = `
      [out:json];
      (
        node["shop"](around:${radius},${latitude},${longitude});
        way["shop"](around:${radius},${latitude},${longitude});
        node["amenity"](around:${radius},${latitude},${longitude});
        way["amenity"](around:${radius},${latitude},${longitude});
      );
      out center;
    `;

    const response = await axios.post(
      'https://overpass-api.de/api/interpreter',
      query,
      { headers: { 'Content-Type': 'text/plain' } }
    );

    const places = response.data.elements.map(element => ({
      name: element.tags?.name || 'Unnamed Business',
      type: element.tags?.shop || element.tags?.amenity,
      latitude: element.lat || element.center?.lat,
      longitude: element.lon || element.center?.lon,
      address: formatAddress(element.tags)
    }));

    // Calculate distances
    places.forEach(place => {
      place.distance = calculateDistance(
        latitude,
        longitude,
        place.latitude,
        place.longitude
      );
    });

    return places.sort((a, b) => a.distance - b.distance).slice(0, 20);
  } catch (error) {
    console.error('Nearby places search error:', error);
    return [];
  }
};

const formatAddress = (tags) => {
  const parts = [
    tags?.['addr:street'],
    tags?.['addr:housenumber'],
    tags?.['addr:city']
  ].filter(Boolean);
  return parts.join(', ') || 'Address not available';
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
};
