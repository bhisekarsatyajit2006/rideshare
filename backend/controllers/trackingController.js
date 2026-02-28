const Ride = require('../models/Ride');
const User = require('../models/User');

// @desc    Start ride tracking
// @route   POST /api/tracking/:rideId/start
// @access  Private
exports.startTracking = async (req, res) => {
    try {
        const ride = await Ride.findById(req.params.rideId);
        
        if (!ride) {
            return res.status(404).json({
                success: false,
                message: 'Ride not found'
            });
        }

        // Check if user is driver or passenger
        const isDriver = ride.driver.toString() === req.user.id;
        const isPassenger = ride.passengers.some(p => p.user.toString() === req.user.id);
        
        if (!isDriver && !isPassenger) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to track this ride'
            });
        }

        // Real-time tracking started
        const io = req.app.get('io');
        io.to(ride._id.toString()).emit('tracking-started', {
            rideId: ride._id,
            startedBy: req.user.id,
            timestamp: new Date()
        });

        res.status(200).json({
            success: true,
            message: 'Tracking started',
            data: {
                rideId: ride._id,
                polyline: ride.routePolyline,
                from: ride.from,
                to: ride.to
            }
        });
    } catch (error) {
        console.error('Start tracking error:', error);
        res.status(500).json({
            success: false,
            message: 'Error starting tracking',
            error: error.message
        });
    }
};

// @desc    Update driver location
// @route   POST /api/tracking/:rideId/location
// @access  Private
exports.updateLocation = async (req, res) => {
    try {
        const { latitude, longitude } = req.body;
        const ride = await Ride.findById(req.params.rideId);

        if (!ride) {
            return res.status(404).json({
                success: false,
                message: 'Ride not found'
            });
        }

        // Check if user is the driver
        if (ride.driver.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Only driver can update location'
            });
        }

        const location = {
            lat: latitude,
            lng: longitude,
            timestamp: new Date()
        };

        // Broadcast location to all passengers
        const io = req.app.get('io');
        io.to(ride._id.toString()).emit('location-updated', {
            rideId: ride._id,
            location: location,
            driver: req.user.id
        });

        res.status(200).json({
            success: true,
            message: 'Location updated',
            data: location
        });
    } catch (error) {
        console.error('Update location error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating location',
            error: error.message
        });
    }
};

// @desc    Get ride tracking info
// @route   GET /api/tracking/:rideId
// @access  Private
exports.getTrackingInfo = async (req, res) => {
    try {
        const ride = await Ride.findById(req.params.rideId)
            .populate('driver', 'name phone avatar')
            .populate('passengers.user', 'name phone');

        if (!ride) {
            return res.status(404).json({
                success: false,
                message: 'Ride not found'
            });
        }

        // Check if user is driver or passenger
        const isDriver = ride.driver._id.toString() === req.user.id;
        const isPassenger = ride.passengers.some(p => p.user._id.toString() === req.user.id);
        
        if (!isDriver && !isPassenger) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view this ride'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                ride: ride,
                polyline: ride.routePolyline,
                estimatedDuration: ride.estimatedDuration,
                estimatedDistance: ride.estimatedDistance
            }
        });
    } catch (error) {
        console.error('Get tracking info error:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting tracking info',
            error: error.message
        });
    }
};