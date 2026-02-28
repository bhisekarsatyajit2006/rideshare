const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDatabase = require('./config/database');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Load env vars
dotenv.config();

// Connect to database
connectDatabase();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS middleware
app.use(cors());

// Enhanced Socket.io for real-time communication
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // Join ride room for real-time updates
    socket.on('join-ride', (rideId) => {
        socket.join(rideId);
        console.log(`Client ${socket.id} joined ride ${rideId}`);
    });

    // Leave ride room
    socket.on('leave-ride', (rideId) => {
        socket.leave(rideId);
        console.log(`Client ${socket.id} left ride ${rideId}`);
    });

    // Handle location updates
    socket.on('driver-location', (data) => {
        socket.to(data.rideId).emit('driver-location-update', {
            location: data.location,
            timestamp: new Date()
        });
    });

    // Handle ride status updates
    socket.on('ride-status-update', (data) => {
        socket.to(data.rideId).emit('ride-status-changed', {
            status: data.status,
            message: data.message,
            timestamp: new Date()
        });
    });

    // Handle chat messages
    socket.on('ride-chat-message', (data) => {
        socket.to(data.rideId).emit('new-chat-message', {
            user: data.user,
            message: data.message,
            timestamp: new Date()
        });
    });

    // Handle tracking started
    socket.on('tracking-started', (data) => {
        socket.to(data.rideId).emit('tracking-activated', {
            rideId: data.rideId,
            startedBy: data.userId,
            timestamp: new Date()
        });
    });

    // Handle ride booked notifications
    socket.on('ride-booked', (data) => {
        socket.to(data.driverId).emit('ride-booked-notification', {
            passenger: data.passenger,
            rideDetails: data.rideDetails,
            timestamp: new Date()
        });
    });

    // Handle emergency alerts
    socket.on('emergency-alert', (data) => {
        // Broadcast to all connected admin clients
        socket.broadcast.emit('emergency-alert-notification', {
            user: data.user,
            location: data.location,
            contacts: data.contacts,
            timestamp: new Date()
        });
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

app.set('io', io);

// Import routes with error handling
try {
    app.use('/api/auth', require('./routes/auth'));
    app.use('/api/rides', require('./routes/rides'));
    app.use('/api/users', require('./routes/users'));
    app.use('/api/emergency', require('./routes/emergency'));
    
    // New routes from Step 4
    app.use('/api/tracking', require('./routes/tracking'));
    app.use('/api/ratings', require('./routes/ratings'));
    
    // Admin routes from Step 5
    app.use('/api/admin', require('./routes/admin'));
    
    console.log('✅ All routes loaded successfully');
} catch (error) {
    console.error('❌ Error loading routes:', error.message);
    process.exit(1);
}

// Basic route
app.get('/', (req, res) => {
    res.json({ 
        message: 'RideShare API is running!',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        features: [
            'Authentication', 
            'Ride Management', 
            'Real-time Tracking', 
            'Ratings', 
            'Emergency SOS',
            'Admin Dashboard',
            'WebSocket Notifications'
        ]
    });
});

// Health check route
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK',
        database: 'Connected',
        websocket: 'Active',
        timestamp: new Date().toISOString(),
        activeConnections: io.engine.clientsCount
    });
});

// WebSocket status route
app.get('/websocket-status', (req, res) => {
    const rooms = Array.from(io.sockets.adapter.rooms).map(([name, sockets]) => ({
        room: name,
        clients: Array.from(sockets).length
    }));

    res.json({
        connected: true,
        activeConnections: io.engine.clientsCount,
        rooms: rooms.filter(room => !room.room.startsWith(socketIo.Socket.id)),
        features: {
            realTimeTracking: true,
            notifications: true,
            chat: true,
            emergencyAlerts: true
        }
    });
});

// API documentation route
app.get('/api', (req, res) => {
    res.json({
        name: 'RideShare API',
        version: '1.0.0',
        endpoints: {
            auth: {
                'POST /api/auth/register': 'Register new user',
                'POST /api/auth/login': 'User login',
                'GET /api/auth/me': 'Get current user',
                'PUT /api/auth/profile': 'Update user profile'
            },
            rides: {
                'POST /api/rides': 'Create new ride',
                'GET /api/rides/search': 'Search rides',
                'POST /api/rides/:rideId/book': 'Book a ride',
                'GET /api/rides/my-rides': 'Get user rides',
                'GET /api/rides/my-bookings': 'Get user bookings',
                'PUT /api/rides/:rideId/cancel': 'Cancel ride'
            },
            tracking: {
                'POST /api/tracking/:rideId/start': 'Start tracking',
                'POST /api/tracking/:rideId/location': 'Update location',
                'GET /api/tracking/:rideId': 'Get tracking info'
            },
            emergency: {
                'POST /api/emergency/sos': 'Trigger emergency SOS'
            },
            ratings: {
                'POST /api/ratings/:bookingId': 'Submit rating',
                'GET /api/ratings/user/:userId': 'Get user ratings'
            },
            admin: {
                'GET /api/admin/dashboard': 'Get dashboard stats',
                'GET /api/admin/emergencies': 'Get emergency alerts'
            }
        },
        websocketEvents: {
            'join-ride': 'Join ride room for real-time updates',
            'leave-ride': 'Leave ride room',
            'driver-location': 'Send driver location update',
            'ride-status-update': 'Update ride status',
            'ride-chat-message': 'Send chat message',
            'tracking-started': 'Start ride tracking',
            'ride-booked': 'Notify about ride booking',
            'emergency-alert': 'Broadcast emergency alert'
        }
    });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'API route not found',
        availableRoutes: [
            '/api/auth',
            '/api/rides', 
            '/api/users',
            '/api/emergency',
            '/api/tracking',
            '/api/ratings',
            '/api/admin'
        ],
        documentation: '/api'
    });
});

// Serve static files for frontend (optional - for production)
app.use(express.static(path.join(__dirname, '../frontend')));

// Catch-all handler for SPA (optional - for production)
app.get('*', (req, res) => {
    if (req.url.startsWith('/api')) {
        return res.status(404).json({
            success: false,
            message: 'API endpoint not found'
        });
    }
    
    // For non-API routes, serve the frontend
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err.stack);
    res.status(500).json({
        success: false,
        message: 'Server Error',
        error: process.env.NODE_ENV === 'development' ? err.message : {},
        timestamp: new Date().toISOString()
    });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
    console.log('Unhandled Rejection at:', promise, 'reason:', err);
    // Close server & exit process
    server.close(() => {
        process.exit(1);
    });
});

// Handle SIGTERM gracefully
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
    });
});

const PORT = process.env.PORT || 5001;

server.listen(PORT, () => {
    console.log(`
    🚗 RideShare Server running on port ${PORT}
    📍 Environment: ${process.env.NODE_ENV || 'development'}
    🗄️  Database: ${process.env.MONGODB_URI}
    🔌 WebSocket: Enabled with enhanced real-time features
    📡 Available routes:
       - http://localhost:${PORT}/api/auth
       - http://localhost:${PORT}/api/rides
       - http://localhost:${PORT}/api/tracking
       - http://localhost:${PORT}/api/ratings
       - http://localhost:${PORT}/api/admin
       - http://localhost:${PORT}/api/emergency
       - http://localhost:${PORT}/health
       - http://localhost:${PORT}/websocket-status
       - http://localhost:${PORT}/api (Documentation)
    `);
});