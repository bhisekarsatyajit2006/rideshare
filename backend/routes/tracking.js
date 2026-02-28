const express = require('express');
const {
    startTracking,
    updateLocation,
    getTrackingInfo
} = require('../controllers/trackingController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/:rideId/start', protect, startTracking);
router.post('/:rideId/location', protect, updateLocation);
router.get('/:rideId', protect, getTrackingInfo);

module.exports = router;