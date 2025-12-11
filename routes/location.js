import express from 'express';
import * as geocodingService from '../services/geocodingService.js';
import sessionManager from '../utils/sessionManager.js';

const router = express.Router();

router.post('/detect', async (req, res) => {
  try {
    const { latitude, longitude, session_id } = req.body;

    if (!latitude || !longitude || !session_id) {
      return res.status(400).json({ 
        error: 'latitude, longitude, and session_id are required' 
      });
    }

    const locationData = await geocodingService.reverseGeocode(latitude, longitude);

    if (!locationData) {
      return res.status(404).json({ 
        error: 'Could not detect location' 
      });
    }

    // Update session context
    sessionManager.updateContext(session_id, {
      user_latitude: latitude,
      user_longitude: longitude,
      detected_location: locationData.displayName
    });

    res.json({
      location: locationData.displayName,
      city: locationData.city,
      state: locationData.state,
      country: locationData.country,
      latitude,
      longitude
    });
  } catch (error) {
    console.error('Location detection error:', error);
    res.status(500).json({ 
      error: 'Failed to detect location',
      message: error.message 
    });
  }
});

router.post('/nearby', async (req, res) => {
  try {
    const { latitude, longitude, business_type, session_id, radius = 2000 } = req.body;

    if (!latitude || !longitude || !session_id) {
      return res.status(400).json({ 
        error: 'latitude, longitude, and session_id are required' 
      });
    }

    const places = await geocodingService.searchNearbyPlaces(
      latitude, 
      longitude, 
      business_type, 
      radius
    );

    res.json({
      businesses: places,
      count: places.length,
      radius: radius,
      center: { latitude, longitude }
    });
  } catch (error) {
    console.error('Nearby search error:', error);
    res.status(500).json({ 
      error: 'Failed to search nearby places',
      message: error.message 
    });
  }
});

router.post('/analyze', async (req, res) => {
  try {
    const { latitude, longitude, business_type, session_id } = req.body;

    if (!latitude || !longitude || !business_type || !session_id) {
      return res.status(400).json({ 
        error: 'All parameters are required' 
      });
    }

    const locationData = await geocodingService.reverseGeocode(latitude, longitude);
    const nearbyPlaces = await geocodingService.searchNearbyPlaces(
      latitude, 
      longitude, 
      business_type, 
      5000 // 5km radius for analysis
    );

    // Simple analysis
    const analysis = {
      location: locationData?.displayName || 'Unknown',
      competitorCount: nearbyPlaces.length,
      competitionLevel: nearbyPlaces.length < 5 ? 'Low' : nearbyPlaces.length < 15 ? 'Medium' : 'High',
      nearestCompetitor: nearbyPlaces[0] ? {
        name: nearbyPlaces[0].name,
        distance: nearbyPlaces[0].distance.toFixed(2) + ' km'
      } : null,
      recommendation: nearbyPlaces.length < 5 
        ? 'Great location! Low competition detected.' 
        : 'Moderate to high competition. Focus on unique value proposition.'
    };

    res.json({
      analysis,
      competitors: nearbyPlaces.slice(0, 10),
      summary: `Found ${nearbyPlaces.length} similar businesses within 5km. ${analysis.recommendation}`
    });
  } catch (error) {
    console.error('Location analysis error:', error);
    res.status(500).json({ 
      error: 'Failed to analyze location',
      message: error.message 
    });
  }
});

export default router;
