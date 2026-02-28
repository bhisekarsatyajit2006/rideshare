const express = require('express');
const {
    getDashboardStats,
    getEmergencyAlerts,
    getUsers,
    getRides,
    toggleUserStatus,
    getUserStats,
    getRideStats,
    getRevenueStats,
    getSystemAnalytics
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Apply protect and admin authorization to all routes
router.use(protect);
router.use(authorize('admin'));

// Dashboard & Analytics Routes
router.get('/dashboard', getDashboardStats);
router.get('/analytics/system', getSystemAnalytics);
router.get('/analytics/revenue', getRevenueStats);

// User Management Routes
router.get('/users', getUsers);
router.get('/users/stats', getUserStats);
router.put('/users/:id/toggle-status', toggleUserStatus);

// Ride Management Routes
router.get('/rides', getRides);
router.get('/rides/stats', getRideStats);

// Emergency & Safety Routes
router.get('/emergencies', getEmergencyAlerts);

module.exports = router;