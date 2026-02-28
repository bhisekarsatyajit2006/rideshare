// Google Maps integration
class MapsManager {
    constructor() {
        this.map = null;
        this.directionsService = null;
        this.directionsRenderer = null;
        this.markers = [];
        this.driverMarker = null;
        this.trackingInterval = null;
    }

    // Initialize map
    initMap(containerId, options = {}) {
        const defaultOptions = {
            zoom: 12,
            center: { lat: 19.0760, lng: 72.8777 }, // Mumbai coordinates
            mapTypeControl: false,
            streetViewControl: false
        };

        this.map = new google.maps.Map(document.getElementById(containerId), {
            ...defaultOptions,
            ...options
        });

        this.directionsService = new google.maps.DirectionsService();
        this.directionsRenderer = new google.maps.DirectionsRenderer();
        this.directionsRenderer.setMap(this.map);

        return this.map;
    }

    // Show route on map
    showRoute(origin, destination, polyline = null) {
        if (polyline) {
            // Decode polyline and show route
            const decodedPath = google.maps.geometry.encoding.decodePath(polyline);
            const routePath = new google.maps.Polyline({
                path: decodedPath,
                geodesic: true,
                strokeColor: '#14b8a6',
                strokeOpacity: 1.0,
                strokeWeight: 4
            });
            routePath.setMap(this.map);

            // Fit map to route bounds
            const bounds = new google.maps.LatLngBounds();
            decodedPath.forEach(point => bounds.extend(point));
            this.map.fitBounds(bounds);
        } else {
            // Fallback to directions service
            const request = {
                origin: origin,
                destination: destination,
                travelMode: google.maps.TravelMode.DRIVING
            };

            this.directionsService.route(request, (result, status) => {
                if (status === 'OK') {
                    this.directionsRenderer.setDirections(result);
                }
            });
        }
    }

    // Add marker to map
    addMarker(position, title, icon = null) {
        const marker = new google.maps.Marker({
            position: position,
            map: this.map,
            title: title,
            icon: icon
        });

        this.markers.push(marker);
        return marker;
    }

    // Update driver location marker
    updateDriverLocation(location, rideId) {
        if (this.driverMarker) {
            this.driverMarker.setPosition(location);
        } else {
            this.driverMarker = this.addMarker(
                location, 
                'Driver Location',
                {
                    url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIGZpbGw9IiMxNGI4YTYiLz4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iNCIgZmlsbD0id2hpdGUiLz4KPC9zdmc+',
                    scaledSize: new google.maps.Size(30, 30)
                }
            );
        }

        // Center map on driver location
        this.map.panTo(location);
    }

    // Start real-time tracking
    startTracking(rideId, onLocationUpdate) {
        // Connect to WebSocket for real-time updates
        if (window.rideSocket) {
            window.rideSocket.emit('join-ride', rideId);
            
            window.rideSocket.on('driver-location-update', (data) => {
                const location = new google.maps.LatLng(
                    data.location.lat,
                    data.location.lng
                );
                
                this.updateDriverLocation(location, rideId);
                
                if (onLocationUpdate) {
                    onLocationUpdate(data.location);
                }
            });
        }

        // Simulate tracking if WebSocket not available
        this.trackingInterval = setInterval(() => {
            // This would be replaced with actual WebSocket updates
            console.log('Tracking ride:', rideId);
        }, 5000);
    }

    // Stop tracking
    stopTracking() {
        if (this.trackingInterval) {
            clearInterval(this.trackingInterval);
            this.trackingInterval = null;
        }

        if (window.rideSocket) {
            window.rideSocket.emit('leave-ride');
        }
    }

    // Clear all markers
    clearMarkers() {
        this.markers.forEach(marker => marker.setMap(null));
        this.markers = [];
        this.driverMarker = null;
    }

    // Get current location
    getCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation is not supported'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    });
                },
                (error) => {
                    reject(error);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 60000
                }
            );
        });
    }

    // Initialize autocomplete for address input
    initAutocomplete(inputId) {
        const input = document.getElementById(inputId);
        if (!input) return;

        const autocomplete = new google.maps.places.Autocomplete(input, {
            types: ['geocode'],
            componentRestrictions: { country: 'in' }
        });

        autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            if (!place.geometry) {
                console.warn('No details available for input: ' + place.name);
                return;
            }
        });

        return autocomplete;
    }
}

// Create global maps manager instance
const mapsManager = new MapsManager();