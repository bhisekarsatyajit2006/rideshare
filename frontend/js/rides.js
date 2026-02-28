// Ride management functions
class RideManager {
    constructor() {
        this.apiBase = 'http://localhost:5000/api';
    }

    // Create a new ride
    async createRide(rideData) {
        try {
            const response = await fetch(`${this.apiBase}/rides`, {
                method: 'POST',
                headers: auth.getAuthHeaders(),
                body: JSON.stringify(rideData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to create ride');
            }

            return data;
        } catch (error) {
            console.error('Create ride error:', error);
            throw error;
        }
    }

    // Search for rides
    async searchRides(searchParams) {
        try {
            const queryParams = new URLSearchParams(searchParams).toString();
            const response = await fetch(`${this.apiBase}/rides/search?${queryParams}`, {
                headers: auth.getAuthHeaders()
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to search rides');
            }

            return data;
        } catch (error) {
            console.error('Search rides error:', error);
            throw error;
        }
    }

    // Book a ride
    async bookRide(rideId, bookingData) {
        try {
            const response = await fetch(`${this.apiBase}/rides/${rideId}/book`, {
                method: 'POST',
                headers: auth.getAuthHeaders(),
                body: JSON.stringify(bookingData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to book ride');
            }

            return data;
        } catch (error) {
            console.error('Book ride error:', error);
            throw error;
        }
    }

    // Get user's offered rides
    async getMyRides() {
        try {
            const data = await auth.apiRequest('/rides/my-rides');
            return data;
        } catch (error) {
            console.error('Get my rides error:', error);
            throw error;
        }
    }

    // Get user's bookings
    async getMyBookings() {
        try {
            const data = await auth.apiRequest('/rides/my-bookings');
            return data;
        } catch (error) {
            console.error('Get my bookings error:', error);
            throw error;
        }
    }

    // Trigger SOS
    async triggerSOS(location) {
        try {
            const response = await fetch(`${this.apiBase}/emergency/sos`, {
                method: 'POST',
                headers: auth.getAuthHeaders(),
                body: JSON.stringify({ location })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to trigger SOS');
            }

            return data;
        } catch (error) {
            console.error('SOS error:', error);
            throw error;
        }
    }
}

// Create global ride manager instance
const rideManager = new RideManager();