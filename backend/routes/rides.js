const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
    createRide,
    searchRides,
    searchRidesDebug,
    searchRidesTest,
    getAllRides,
    getRideDetails,
    bookRide,
    getMyRides,
    getMyBookings,
    cancelRide,
    getRideById,
    updateRideStatus,
    cancelBooking
} = require('../controllers/rideController');

// Apply protect middleware to all routes
router.use(protect);

// =====================
// MAIN ROUTES
// =====================

// @route   POST /api/rides
// @desc    Create a new ride
// @access  Private
router.post('/', createRide);

// @route   GET /api/rides/search
// @desc    Search for rides
// @access  Private
router.get('/search', searchRides);

// @route   POST /api/rides/:rideId/book
// @desc    Book a ride
// @access  Private
router.post('/:rideId/book', bookRide);

// @route   GET /api/rides/my-rides
// @desc    Get user's offered rides
// @access  Private
router.get('/my-rides', getMyRides);

// @route   GET /api/rides/my-bookings
// @desc    Get user's bookings
// @access  Private
router.get('/my-bookings', getMyBookings);

// @route   PUT /api/rides/:rideId/cancel
// @desc    Cancel a ride
// @access  Private
router.put('/:rideId/cancel', cancelRide);

// @route   GET /api/rides/:rideId
// @desc    Get ride by ID
// @access  Private
router.get('/:rideId', getRideById);

// @route   PUT /api/rides/:rideId/status
// @desc    Update ride status
// @access  Private
router.put('/:rideId/status', updateRideStatus);

// @route   PUT /api/rides/bookings/:bookingId/cancel
// @desc    Cancel booking
// @access  Private
router.put('/bookings/:bookingId/cancel', cancelBooking);

// =====================
// DEBUG & TEST ROUTES
// =====================

// @route   GET /api/rides/debug/all
// @desc    Get all rides (for debugging)
// @access  Private
router.get('/debug/all', getAllRides);

// @route   GET /api/rides/debug/details
// @desc    Get all rides with detailed information
// @access  Private
router.get('/debug/details', getRideDetails);

// @route   GET /api/rides/search-debug
// @desc    Debug search - returns all rides without location filtering
// @access  Private
router.get('/search-debug', searchRidesDebug);

// @route   GET /api/rides/search-test
// @desc    Test search - returns ALL active rides regardless of date/location
// @access  Private
router.get('/search-test', searchRidesTest);

// @route   GET /api/rides/test
// @desc    Test route for debugging
// @access  Private
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'Rides route is working!',
        user: req.user ? req.user.id : 'No user',
        timestamp: new Date().toISOString(),
        debugInfo: {
            authenticated: !!req.user,
            userId: req.user ? req.user.id : null,
            userEmail: req.user ? req.user.email : null
        }
    });
});

// @route   GET /api/rides/debug/query-test
// @desc    Test database queries
// @access  Private
router.get('/debug/query-test', async (req, res) => {
    try {
        const { date, status } = req.query;
        
        let query = {};
        if (date) {
            const searchDate = new Date(date);
            const startOfDay = new Date(searchDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(searchDate);
            endOfDay.setHours(23, 59, 59, 999);
            
            query.date = { $gte: startOfDay, $lte: endOfDay };
        }
        
        if (status) {
            query.status = status;
        }
        
        const rides = await require('../models/Ride').find(query);
        
        res.json({
            success: true,
            query: query,
            count: rides.length,
            rides: rides.map(ride => ({
                id: ride._id,
                from: ride.from.address,
                to: ride.to.address,
                date: ride.date,
                status: ride.status,
                seats: ride.availableSeats,
                driver: ride.driver
            }))
        });
    } catch (error) {
        console.error('Query test error:', error);
        res.status(500).json({
            success: false,
            message: 'Query test failed',
            error: error.message
        });
    }
});

// @route   POST /api/rides/debug/create-test-ride
// @desc    Create a test ride for debugging
// @access  Private
router.post('/debug/create-test-ride', async (req, res) => {
    try {
        const Ride = require('../models/Ride');
        
        const testRide = await Ride.create({
            driver: req.user.id,
            from: {
                address: 'pravin nagar',
                coordinates: { lat: 19.0760, lng: 72.8777 }
            },
            to: {
                address: 'sai nagar', 
                coordinates: { lat: 18.5204, lng: 73.8567 }
            },
            date: new Date('2025-09-29'),
            departureTime: '12:00 PM',
            availableSeats: 4,
            pricePerSeat: 100,
            vehicleType: 'Sedan',
            status: 'active',
            estimatedDuration: 180,
            estimatedDistance: 150
        });

        await testRide.populate('driver', 'name email');

        res.json({
            success: true,
            message: 'Test ride created successfully',
            data: testRide
        });
    } catch (error) {
        console.error('Create test ride error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating test ride',
            error: error.message
        });
    }
});

module.exports = router;