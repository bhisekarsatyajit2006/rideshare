const Booking = require('../models/Booking');
const User = require('../models/User');
const Ride = require('../models/Ride');

// @desc    Rate a completed ride
// @route   POST /api/ratings/:bookingId
// @access  Private
exports.submitRating = async (req, res) => {
    try {
        const { rating, review, ratedUserType } = req.body; // ratedUserType: 'driver' or 'rider'
        const { bookingId } = req.params;

        // Validate input
        if (!rating || !ratedUserType) {
            return res.status(400).json({
                success: false,
                message: 'Please provide rating and ratedUserType'
            });
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: 'Rating must be between 1 and 5'
            });
        }

        if (!['driver', 'rider'].includes(ratedUserType)) {
            return res.status(400).json({
                success: false,
                message: 'ratedUserType must be either "driver" or "rider"'
            });
        }

        // Find booking with proper population
        const booking = await Booking.findById(bookingId)
            .populate('ride', 'driver status')
            .populate('passenger', 'name');

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Check if ride is completed
        if (booking.ride.status !== 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Can only rate completed rides'
            });
        }

        // Check if user is authorized to rate
        let ratedUserId;
        let raterUserId;

        if (ratedUserType === 'driver') {
            // Passenger rating driver
            if (booking.passenger._id.toString() !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to rate this ride as passenger'
                });
            }
            ratedUserId = booking.ride.driver;
            raterUserId = req.user.id;

            // Check if already rated the driver
            if (booking.driverRating) {
                return res.status(400).json({
                    success: false,
                    message: 'You have already rated this driver'
                });
            }

            booking.driverRating = rating;
            booking.driverReview = review;
            booking.driverRatedAt = new Date();

        } else if (ratedUserType === 'rider') {
            // Driver rating passenger (rider)
            if (booking.ride.driver.toString() !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to rate this passenger as driver'
                });
            }
            ratedUserId = booking.passenger._id;
            raterUserId = req.user.id;

            // Check if already rated the rider
            if (booking.passengerRating) {
                return res.status(400).json({
                    success: false,
                    message: 'You have already rated this passenger'
                });
            }

            booking.passengerRating = rating;
            booking.passengerReview = review;
            booking.passengerRatedAt = new Date();
        }

        await booking.save();

        // Update the rated user's overall rating
        await updateUserRating(ratedUserId, ratedUserType);

        res.status(200).json({
            success: true,
            message: 'Rating submitted successfully',
            data: {
                bookingId: booking._id,
                rating,
                review,
                ratedUserType,
                ratedAt: new Date()
            }
        });

    } catch (error) {
        console.error('Submit rating error:', error);
        res.status(500).json({
            success: false,
            message: 'Error submitting rating',
            error: process.env.NODE_ENV === 'production' ? 'Server error' : error.message
        });
    }
};

// Helper function to update user rating
async function updateUserRating(userId, userType) {
    try {
        const user = await User.findById(userId);
        if (!user) return;

        let ratingsField = userType === 'driver' ? 'driverRating' : 'passengerRating';
        
        // Get all ratings for this user
        let query;
        if (userType === 'driver') {
            query = { 
                'ride.driver': userId, 
                driverRating: { $exists: true, $ne: null } 
            };
        } else {
            query = { 
                passenger: userId, 
                passengerRating: { $exists: true, $ne: null } 
            };
        }

        const ratings = await Booking.find(query)
            .select(`${ratingsField} _id`);

        if (ratings.length === 0) return;

        const totalRatings = ratings.length;
        const sumRatings = ratings.reduce((sum, booking) => {
            return sum + (userType === 'driver' ? booking.driverRating : booking.passengerRating);
        }, 0);

        const averageRating = sumRatings / totalRatings;

        // Update user's rating and review count
        if (userType === 'driver') {
            user.driverRating = parseFloat(averageRating.toFixed(1));
            user.driverReviewCount = totalRatings;
        } else {
            user.riderRating = parseFloat(averageRating.toFixed(1));
            user.riderReviewCount = totalRatings;
        }

        await user.save();
    } catch (error) {
        console.error('Update user rating error:', error);
        throw error;
    }
}

// @desc    Get ratings for user
// @route   GET /api/ratings/user/:userId
// @access  Private
exports.getUserRatings = async (req, res) => {
    try {
        const { userId } = req.params;
        const { type = 'both', page = 1, limit = 10 } = req.query; // type: 'driver', 'rider', or 'both'

        // Validate type
        if (!['driver', 'rider', 'both'].includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Type must be "driver", "rider", or "both"'
            });
        }

        const skip = (page - 1) * limit;

        // Build query based on type
        let query = {};
        if (type === 'driver') {
            query = { 
                'ride.driver': userId, 
                driverRating: { $exists: true, $ne: null } 
            };
        } else if (type === 'rider') {
            query = { 
                passenger: userId, 
                passengerRating: { $exists: true, $ne: null } 
            };
        } else {
            query = {
                $or: [
                    { 'ride.driver': userId, driverRating: { $exists: true, $ne: null } },
                    { passenger: userId, passengerRating: { $exists: true, $ne: null } }
                ]
            };
        }

        const [ratings, total] = await Promise.all([
            Booking.find(query)
                .populate('passenger', 'name avatar')
                .populate('ride.driver', 'name avatar')
                .populate('ride', 'pickupLocation destination createdAt')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            Booking.countDocuments(query)
        ]);

        // Calculate average ratings
        const driverRatings = ratings.filter(r => r.driverRating).map(r => r.driverRating);
        const riderRatings = ratings.filter(r => r.passengerRating).map(r => r.passengerRating);

        const stats = {
            driver: {
                averageRating: driverRatings.length > 0 ? 
                    parseFloat((driverRatings.reduce((a, b) => a + b, 0) / driverRatings.length).toFixed(1)) : 0,
                totalRatings: driverRatings.length
            },
            rider: {
                averageRating: riderRatings.length > 0 ? 
                    parseFloat((riderRatings.reduce((a, b) => a + b, 0) / riderRatings.length).toFixed(1)) : 0,
                totalRatings: riderRatings.length
            }
        };

        res.status(200).json({
            success: true,
            count: ratings.length,
            total,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / limit)
            },
            stats,
            data: ratings.map(rating => ({
                id: rating._id,
                ride: rating.ride,
                driverRating: rating.driverRating,
                driverReview: rating.driverReview,
                passengerRating: rating.passengerRating,
                passengerReview: rating.passengerReview,
                driverRatedAt: rating.driverRatedAt,
                passengerRatedAt: rating.passengerRatedAt,
                createdAt: rating.createdAt
            }))
        });

    } catch (error) {
        console.error('Get user ratings error:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting ratings',
            error: process.env.NODE_ENV === 'production' ? 'Server error' : error.message
        });
    }
};

// @desc    Get rating summary for user
// @route   GET /api/ratings/user/:userId/summary
// @access  Private
exports.getRatingSummary = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId)
            .select('driverRating driverReviewCount riderRating riderReviewCount name avatar');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    avatar: user.avatar
                },
                driverStats: {
                    rating: user.driverRating || 0,
                    reviewCount: user.driverReviewCount || 0
                },
                riderStats: {
                    rating: user.riderRating || 0,
                    reviewCount: user.riderReviewCount || 0
                }
            }
        });

    } catch (error) {
        console.error('Get rating summary error:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting rating summary',
            error: process.env.NODE_ENV === 'production' ? 'Server error' : error.message
        });
    }
};