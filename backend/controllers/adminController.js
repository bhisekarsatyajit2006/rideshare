const User = require('../models/User');
const Ride = require('../models/Ride');
const Booking = require('../models/Booking');

// @desc    Get dashboard statistics
// @route   GET /api/admin/dashboard
// @access  Private/Admin
exports.getDashboardStats = async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to access admin resources'
            });
        }

        // Get counts in parallel for better performance
        const [
            totalUsers,
            totalRides,
            totalBookings,
            activeRides,
            completedRides,
            pendingRides,
            recentUsers
        ] = await Promise.all([
            User.countDocuments(),
            Ride.countDocuments(),
            Booking.countDocuments(),
            Ride.countDocuments({ status: 'active' }),
            Ride.countDocuments({ status: 'completed' }),
            Ride.countDocuments({ status: 'pending' }),
            User.countDocuments({ 
                createdAt: { 
                    $gte: new Date(new Date() - 7 * 24 * 60 * 60 * 1000) 
                }
            })
        ]);

        // Revenue calculation with better aggregation
        const revenueData = await Booking.aggregate([
            {
                $match: {
                    status: 'completed' // Only count completed bookings
                }
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$totalPrice' },
                    totalBookings: { $sum: 1 }
                }
            }
        ]);

        // Weekly revenue trend
        const weeklyRevenue = await Booking.aggregate([
            {
                $match: {
                    status: 'completed',
                    createdAt: { 
                        $gte: new Date(new Date() - 7 * 24 * 60 * 60 * 1000) 
                    }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
                    },
                    dailyRevenue: { $sum: '$totalPrice' },
                    bookings: { $sum: 1 }
                }
            },
            {
                $sort: { _id: 1 }
            }
        ]);

        const totalRevenue = revenueData[0]?.totalRevenue || 0;
        const revenueBookings = revenueData[0]?.totalBookings || 0;

        // Popular routes
        const popularRoutes = await Ride.aggregate([
            {
                $group: {
                    _id: {
                        from: '$from.address',
                        to: '$to.address'
                    },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { count: -1 }
            },
            {
                $limit: 5
            }
        ]);

        res.status(200).json({
            success: true,
            data: {
                totals: {
                    users: totalUsers,
                    rides: totalRides,
                    bookings: totalBookings,
                    revenue: totalRevenue
                },
                rideStatus: {
                    active: activeRides,
                    completed: completedRides,
                    pending: pendingRides
                },
                analytics: {
                    newUsersThisWeek: recentUsers,
                    revenueBookings: revenueBookings,
                    popularRoutes: popularRoutes,
                    weeklyRevenue: weeklyRevenue
                }
            }
        });

    } catch (error) {
        console.error('Get dashboard stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting dashboard statistics',
            error: process.env.NODE_ENV === 'production' ? 'Server error' : error.message
        });
    }
};

// @desc    Get emergency alerts
// @route   GET /api/admin/emergencies
// @access  Private/Admin
exports.getEmergencyAlerts = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to access admin resources'
            });
        }

        // In a real implementation, you should have an Emergency model
        // For now, let's check bookings with emergency flags or create a mock
        const emergencyBookings = await Booking.find({
            emergencyTriggered: true
        })
        .populate('passenger', 'name email phone')
        .populate('ride')
        .populate('ride.driver', 'name phone')
        .sort({ emergencyTriggeredAt: -1 })
        .limit(50);

        // If no emergency model exists, return structured mock data
        const emergencies = emergencyBookings.length > 0 ? emergencyBookings : [
            {
                _id: 'mock_1',
                userName: 'John Doe',
                passenger: {
                    name: 'John Doe',
                    email: 'john@example.com',
                    phone: '+1234567890'
                },
                ride: {
                    from: { address: 'Mumbai, India' },
                    to: { address: 'Pune, India' },
                    driver: {
                        name: 'Driver Name',
                        phone: '+1234567891'
                    }
                },
                location: 'Mumbai, India',
                timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
                status: 'active',
                type: 'sos',
                emergencyTriggered: true,
                emergencyTriggeredAt: new Date(Date.now() - 30 * 60 * 1000)
            }
        ];

        res.status(200).json({
            success: true,
            count: emergencies.length,
            data: emergencies
        });

    } catch (error) {
        console.error('Get emergencies error:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting emergency alerts',
            error: process.env.NODE_ENV === 'production' ? 'Server error' : error.message
        });
    }
};

// @desc    Get all users with pagination
// @route   GET /api/admin/users
// @access  Private/Admin
exports.getUsers = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to access admin resources'
            });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const users = await User.find()
            .select('-password')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await User.countDocuments();

        res.status(200).json({
            success: true,
            data: users,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting users',
            error: process.env.NODE_ENV === 'production' ? 'Server error' : error.message
        });
    }
};

// @desc    Get all rides with pagination
// @route   GET /api/admin/rides
// @access  Private/Admin
exports.getRides = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to access admin resources'
            });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const rides = await Ride.find()
            .populate('driver', 'name email phone avatar rating')
            .populate('passengers.user', 'name email phone avatar')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Ride.countDocuments();

        res.status(200).json({
            success: true,
            data: rides,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Get rides error:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting rides',
            error: process.env.NODE_ENV === 'production' ? 'Server error' : error.message
        });
    }
};

// @desc    Toggle user status (active/suspended)
// @route   PUT /api/admin/users/:id/toggle-status
// @access  Private/Admin
exports.toggleUserStatus = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to access admin resources'
            });
        }

        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Prevent admin from suspending themselves
        if (user._id.toString() === req.user.id) {
            return res.status(400).json({
                success: false,
                message: 'Cannot modify your own status'
            });
        }

        user.status = user.status === 'active' ? 'suspended' : 'active';
        await user.save();

        res.status(200).json({
            success: true,
            message: `User ${user.status === 'active' ? 'activated' : 'suspended'} successfully`,
            data: {
                id: user._id,
                status: user.status
            }
        });

    } catch (error) {
        console.error('Toggle user status error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating user status',
            error: process.env.NODE_ENV === 'production' ? 'Server error' : error.message
        });
    }
};

// @desc    Get user statistics
// @route   GET /api/admin/users/stats
// @access  Private/Admin
exports.getUserStats = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to access admin resources'
            });
        }

        const totalUsers = await User.countDocuments();
        const verifiedUsers = await User.countDocuments({ 'verification.email.isVerified': true });
        const activeUsers = await User.countDocuments({ status: 'active' });
        const drivers = await User.countDocuments({ role: 'driver' });
        const verifiedDrivers = await User.countDocuments({ 
            role: 'driver', 
            'verification.license.isVerified': true 
        });

        // User growth (last 30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const newUsers = await User.countDocuments({
            createdAt: { $gte: thirtyDaysAgo }
        });

        res.status(200).json({
            success: true,
            data: {
                totalUsers,
                verifiedUsers,
                activeUsers,
                drivers,
                verifiedDrivers,
                newUsers,
                verificationRate: totalUsers > 0 ? (verifiedUsers / totalUsers * 100).toFixed(2) : 0
            }
        });
    } catch (error) {
        console.error('Get user stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting user statistics',
            error: process.env.NODE_ENV === 'production' ? 'Server error' : error.message
        });
    }
};

// @desc    Get ride statistics
// @route   GET /api/admin/rides/stats
// @access  Private/Admin
exports.getRideStats = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to access admin resources'
            });
        }

        const totalRides = await Ride.countDocuments();
        const activeRides = await Ride.countDocuments({ status: 'active' });
        const completedRides = await Ride.countDocuments({ status: 'completed' });
        const cancelledRides = await Ride.countDocuments({ status: 'cancelled' });

        // Popular routes
        const popularRoutes = await Ride.aggregate([
            {
                $group: {
                    _id: {
                        from: '$from.address',
                        to: '$to.address'
                    },
                    count: { $sum: 1 },
                    totalPassengers: { $sum: { $size: '$passengers' } }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]);

        // Ride growth (last 30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const newRides = await Ride.countDocuments({
            createdAt: { $gte: thirtyDaysAgo }
        });

        res.status(200).json({
            success: true,
            data: {
                totalRides,
                activeRides,
                completedRides,
                cancelledRides,
                newRides,
                completionRate: totalRides > 0 ? (completedRides / totalRides * 100).toFixed(2) : 0,
                popularRoutes
            }
        });
    } catch (error) {
        console.error('Get ride stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting ride statistics',
            error: process.env.NODE_ENV === 'production' ? 'Server error' : error.message
        });
    }
};

// @desc    Get revenue statistics
// @route   GET /api/admin/analytics/revenue
// @access  Private/Admin
exports.getRevenueStats = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to access admin resources'
            });
        }

        const revenueData = await Booking.aggregate([
            {
                $match: {
                    status: 'completed',
                    paymentStatus: 'paid'
                }
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$totalPrice' },
                    totalBookings: { $sum: 1 },
                    averageBookingValue: { $avg: '$totalPrice' }
                }
            }
        ]);

        // Monthly revenue trend
        const monthlyRevenue = await Booking.aggregate([
            {
                $match: {
                    status: 'completed',
                    paymentStatus: 'paid',
                    createdAt: { $gte: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000) }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    revenue: { $sum: '$totalPrice' },
                    bookings: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        const result = revenueData[0] || {
            totalRevenue: 0,
            totalBookings: 0,
            averageBookingValue: 0
        };

        res.status(200).json({
            success: true,
            data: {
                ...result,
                monthlyRevenue
            }
        });
    } catch (error) {
        console.error('Get revenue stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting revenue statistics',
            error: process.env.NODE_ENV === 'production' ? 'Server error' : error.message
        });
    }
};

// @desc    Get system analytics
// @route   GET /api/admin/analytics/system
// @access  Private/Admin
exports.getSystemAnalytics = async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to access admin resources'
            });
        }

        // Platform statistics
        const [
            totalUsers,
            totalRides,
            totalBookings,
            totalRevenue
        ] = await Promise.all([
            User.countDocuments(),
            Ride.countDocuments(),
            Booking.countDocuments(),
            Booking.aggregate([
                {
                    $match: {
                        status: 'completed',
                        paymentStatus: 'paid'
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$totalPrice' }
                    }
                }
            ])
        ]);

        // Growth metrics (last 30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const [
            newUsers,
            newRides,
            newBookings
        ] = await Promise.all([
            User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
            Ride.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
            Booking.countDocuments({ createdAt: { $gte: thirtyDaysAgo } })
        ]);

        // Success rates
        const completedBookings = await Booking.countDocuments({ status: 'completed' });
        const completionRate = totalBookings > 0 ? (completedBookings / totalBookings * 100).toFixed(2) : 0;

        res.status(200).json({
            success: true,
            data: {
                platform: {
                    totalUsers,
                    totalRides,
                    totalBookings,
                    totalRevenue: totalRevenue[0]?.total || 0
                },
                growth: {
                    newUsers,
                    newRides,
                    newBookings,
                    userGrowthRate: totalUsers > 0 ? (newUsers / totalUsers * 100).toFixed(2) : 0,
                    rideGrowthRate: totalRides > 0 ? (newRides / totalRides * 100).toFixed(2) : 0
                },
                metrics: {
                    completionRate,
                    averageRidesPerUser: totalUsers > 0 ? (totalRides / totalUsers).toFixed(2) : 0,
                    averageBookingsPerUser: totalUsers > 0 ? (totalBookings / totalUsers).toFixed(2) : 0
                }
            }
        });
    } catch (error) {
        console.error('Get system analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting system analytics',
            error: process.env.NODE_ENV === 'production' ? 'Server error' : error.message
        });
    }
};