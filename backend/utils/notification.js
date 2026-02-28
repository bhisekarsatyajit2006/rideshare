// Simplified notification service without SMS
class NotificationService {
    constructor() {
        // No Twilio dependency
    }

    // Log notification instead of sending SMS
    async sendSMS(to, message) {
        console.log('📱 NOTIFICATION (Logged):');
        console.log('To:', to);
        console.log('Message:', message);
        console.log('---');
        
        return { 
            success: true, 
            demo: true,
            message: 'Notification logged (SMS simulation)'
        };
    }

    // Send ride booking notification (WebSocket based)
    async sendBookingNotification(driverId, passengerName, rideDetails, io) {
        const message = `🚗 RideShare: ${passengerName} booked your ride from ${rideDetails.from} to ${rideDetails.to}`;
        
        // Send real-time notification via WebSocket
        if (io) {
            io.to(driverId).emit('ride-booked', {
                passengerName,
                rideDetails,
                message,
                timestamp: new Date()
            });
        }
        
        // Log to console
        console.log('📢 Ride Booking Notification:');
        console.log('Driver:', driverId);
        console.log('Message:', message);
        
        return { success: true, method: 'websocket' };
    }

    // Send ride confirmation (WebSocket based)
    async sendConfirmationNotification(passengerId, driverName, rideDetails, io) {
        const message = `✅ RideShare: Your ride with ${driverName} from ${rideDetails.from} to ${rideDetails.to} is confirmed`;
        
        // Send real-time notification via WebSocket
        if (io) {
            io.to(passengerId).emit('ride-confirmed', {
                driverName,
                rideDetails,
                message,
                timestamp: new Date()
            });
        }
        
        // Log to console
        console.log('📢 Ride Confirmation Notification:');
        console.log('Passenger:', passengerId);
        console.log('Message:', message);
        
        return { success: true, method: 'websocket' };
    }

    // Send emergency alert (WebSocket + Console)
    async sendEmergencyAlert(emergencyContacts, user, location, io) {
        const message = `🚨 EMERGENCY: ${user.name} has triggered SOS alert. Location: ${location}`;
        
        // Log emergency
        console.log('🚨 EMERGENCY ALERT:');
        console.log('User:', user.name);
        console.log('Location:', location);
        console.log('Emergency Contacts:', emergencyContacts);
        console.log('Message:', message);
        
        // Send real-time alert to admin/user dashboard
        if (io) {
            io.emit('emergency-alert', {
                user: user.name,
                location,
                contacts: emergencyContacts,
                timestamp: new Date()
            });
        }
        
        return { 
            success: true, 
            contacts: emergencyContacts.length,
            method: 'websocket+console' 
        };
    }
}

module.exports = new NotificationService();