const express = require('express');
const router = express.Router();

// Placeholder - will be implemented in Step 3
router.get('/', (req, res) => {
    res.json({ 
        success: true,
        message: 'Emergency API endpoint - to be implemented in Step 3'
    });
});

module.exports = router;