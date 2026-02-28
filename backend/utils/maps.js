const axios = require('axios');

class GoogleMapsService {
    constructor() {
        this.apiKey = process.env.GOOGLE_MAPS_API_KEY;
        this.baseUrl = 'https://maps.googleapis.com/maps/api';
    }

    // Geocode an address
    async geocodeAddress(address) {
        try {
            const response = await axios.get(`${this.baseUrl}/geocode/json`, {
                params: {
                    address: address,
                    key: this.apiKey
                }
            });

            if (response.data.status === 'OK' && response.data.results.length > 0) {
                const location = response.data.results[0].geometry.location;
                const formattedAddress = response.data.results[0].formatted_address;
                
                return {
                    address: formattedAddress,
                    coordinates: {
                        lat: location.lat,
                        lng: location.lng
                    }
                };
            } else {
                throw new Error('Address not found');
            }
        } catch (error) {
            console.error('Geocoding error:', error);
            throw new Error('Failed to geocode address');
        }
    }

    // Get route between two points
    async getRoute(origin, destination) {
        try {
            const response = await axios.get(`${this.baseUrl}/directions/json`, {
                params: {
                    origin: `${origin.lat},${origin.lng}`,
                    destination: `${destination.lat},${destination.lng}`,
                    key: this.apiKey
                }
            });

            if (response.data.status === 'OK' && response.data.routes.length > 0) {
                const route = response.data.routes[0].legs[0];
                const polyline = response.data.routes[0].overview_polyline.points;
                
                return {
                    distance: route.distance.value / 1000, // Convert to km
                    duration: Math.ceil(route.duration.value / 60), // Convert to minutes
                    polyline: polyline
                };
            } else {
                throw new Error('Route not found');
            }
        } catch (error) {
            console.error('Routing error:', error);
            throw new Error('Failed to calculate route');
        }
    }

    // Calculate distance between two coordinates
    calculateDistance(coord1, coord2) {
        const R = 6371; // Earth's radius in km
        const dLat = this.deg2rad(coord2.lat - coord1.lat);
        const dLng = this.deg2rad(coord2.lng - coord1.lng);
        
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(this.deg2rad(coord1.lat)) * Math.cos(this.deg2rad(coord2.lat)) * 
            Math.sin(dLng/2) * Math.sin(dLng/2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
        return R * c; // Distance in km
    }

    deg2rad(deg) {
        return deg * (Math.PI/180);
    }
}

module.exports = new GoogleMapsService();