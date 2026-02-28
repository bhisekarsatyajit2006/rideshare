const express = require('express');
const {
    submitRating,
    getUserRatings
} = require('../controllers/ratingController');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.post('/:bookingId', protect, submitRating);
router.get('/user/:userId', protect, getUserRatings);

module.exports = router;