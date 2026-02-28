// WebSocket manager for real-time features
class SocketManager {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.eventCallbacks = new Map();
    }

    // Connect to WebSocket server
    connect() {
        if (this.socket) {
            return;
        }

        this.socket = io('http://localhost:5000');

        this.socket.on('connect', () => {
            console.log('Connected to WebSocket server');
            this.isConnected = true;
            this.triggerEvent('connect');
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from WebSocket server');
            this.isConnected = false;
            this.triggerEvent('disconnect');
        });

        this.socket.on('ride-booked', (data) => {
            console.log('Ride booked notification:', data);
            this.triggerEvent('ride-booked', data);
        });

        this.socket.on('driver-location-update', (data) => {
            this.triggerEvent('driver-location-update', data);
        });

        this.socket.on('ride-status-changed', (data) => {
            this.triggerEvent('ride-status-changed', data);
        });

        this.socket.on('new-chat-message', (data) => {
            this.triggerEvent('new-chat-message', data);
        });
    }

    // Join a ride room
    joinRide(rideId) {
        if (this.socket) {
            this.socket.emit('join-ride', rideId);
        }
    }

    // Leave a ride room
    leaveRide(rideId) {
        if (this.socket) {
            this.socket.emit('leave-ride', rideId);
        }
    }

    // Send driver location update
    sendLocationUpdate(rideId, location) {
        if (this.socket) {
            this.socket.emit('driver-location', {
                rideId: rideId,
                location: location
            });
        }
    }

    // Send chat message
    sendChatMessage(rideId, message, user) {
        if (this.socket) {
            this.socket.emit('ride-chat-message', {
                rideId: rideId,
                user: user,
                message: message
            });
        }
    }

    // Register event callback
    on(event, callback) {
        if (!this.eventCallbacks.has(event)) {
            this.eventCallbacks.set(event, []);
        }
        this.eventCallbacks.get(event).push(callback);
    }

    // Trigger event callbacks
    triggerEvent(event, data) {
        const callbacks = this.eventCallbacks.get(event) || [];
        callbacks.forEach(callback => callback(data));
    }

    // Disconnect
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;
        }
    }
}

// Create global socket manager instance
const socketManager = new SocketManager();

// Make it available globally for HTML onclick handlers
window.socketManager = socketManager;