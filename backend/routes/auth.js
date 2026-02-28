const express = require('express');
const router = express.Router();

// Import controllers
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');
const validationMiddleware = require('../middleware/validation');

// Routes
router.post('/register', validationMiddleware.validateRegistration, authController.register);
router.post('/login', validationMiddleware.validateLogin, authController.login);
router.get('/me', authMiddleware.protect, authController.getMe);
router.put('/profile', authMiddleware.protect, authController.updateProfile);

module.exports = router;