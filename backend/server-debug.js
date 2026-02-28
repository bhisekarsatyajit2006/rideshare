const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDatabase = require('./config/database');

// Load env vars
dotenv.config();

// Connect to database
connectDatabase();

const app = express();

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS middleware
app.use(cors());

// Test each route file individually
console.log('Testing route imports...');

try {
    console.log('1. Testing auth routes...');
    const authRoutes = require('./routes/auth');
    console.log('✅ Auth routes loaded successfully');
} catch (error) {
    console.log('❌ Auth routes failed:', error.message);
}

try {
    console.log('2. Testing rides routes...');
    const ridesRoutes = require('./routes/rides');
    console.log('✅ Rides routes loaded successfully');
} catch (error) {
    console.log('❌ Rides routes failed:', error.message);
}

try {
    console.log('3. Testing users routes...');
    const usersRoutes = require('./routes/users');
    console.log('✅ Users routes loaded successfully');
} catch (error) {
    console.log('❌ Users routes failed:', error.message);
}

try {
    console.log('4. Testing emergency routes...');
    const emergencyRoutes = require('./routes/emergency');
    console.log('✅ Emergency routes loaded successfully');
} catch (error) {
    console.log('❌ Emergency routes failed:', error.message);
}

// Basic route
app.get('/', (req, res) => {
    res.json({ 
        message: 'RideShare API Debug Server',
        status: 'Running'
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🔧 Debug Server running on port ${PORT}`);
});