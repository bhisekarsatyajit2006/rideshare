// Real-time notification system
class NotificationManager {
    constructor() {
        this.notificationContainer = null;
        this.init();
    }

    init() {
        // Create notification container
        this.createNotificationContainer();
        
        // Listen for WebSocket notifications
        socketManager.on('ride-booked', this.handleRideBooked.bind(this));
        socketManager.on('ride-confirmed', this.handleRideConfirmed.bind(this));
        socketManager.on('emergency-alert', this.handleEmergencyAlert.bind(this));
        socketManager.on('new-chat-message', this.handleChatMessage.bind(this));
    }

    createNotificationContainer() {
        this.notificationContainer = document.createElement('div');
        this.notificationContainer.className = 'notification-container';
        this.notificationContainer.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            z-index: 10000;
            max-width: 400px;
        `;
        document.body.appendChild(this.notificationContainer);
    }

    // Handle ride booked notification
    handleRideBooked(data) {
        this.showNotification({
            title: '🚗 New Ride Booking',
            message: `${data.passengerName} booked your ride`,
            type: 'success',
            duration: 5000
        });

        // Update UI if on driver dashboard
        this.updateDriverDashboard(data);
    }

    // Handle ride confirmation
    handleRideConfirmed(data) {
        this.showNotification({
            title: '✅ Ride Confirmed',
            message: `Your ride with ${data.driverName} is confirmed`,
            type: 'success',
            duration: 5000
        });
    }

    // Handle emergency alerts
    handleEmergencyAlert(data) {
        this.showNotification({
            title: '🚨 EMERGENCY ALERT',
            message: `${data.user} triggered SOS at ${data.location}`,
            type: 'error',
            duration: 0 // Don't auto-dismiss
        });

        // Play emergency sound
        this.playEmergencySound();
    }

    // Handle chat messages
    handleChatMessage(data) {
        this.showNotification({
            title: `💬 Message from ${data.user.name}`,
            message: data.message,
            type: 'info',
            duration: 3000
        });
    }

    // Show notification
    showNotification({ title, message, type = 'info', duration = 5000 }) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type} fade-in`;
        notification.style.cssText = `
            background: var(--white);
            padding: 1rem 1.5rem;
            border-radius: var(--border-radius);
            box-shadow: var(--shadow-lg);
            margin-bottom: 0.5rem;
            border-left: 4px solid var(--primary);
            max-width: 350px;
            animation: slideInRight 0.3s ease-out;
        `;

        // Set border color based on type
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#0ea5e9'
        };
        notification.style.borderLeftColor = colors[type] || colors.info;

        notification.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 0.25rem;">${title}</div>
            <div style="font-size: 0.9rem; color: var(--gray);">${message}</div>
        `;

        this.notificationContainer.appendChild(notification);

        // Auto remove after duration
        if (duration > 0) {
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.style.animation = 'slideOutRight 0.3s ease-out';
                    setTimeout(() => notification.remove(), 300);
                }
            }, duration);
        }

        // Add manual close for emergency alerts
        if (duration === 0) {
            const closeBtn = document.createElement('button');
            closeBtn.textContent = '✕';
            closeBtn.style.cssText = `
                position: absolute;
                top: 0.5rem;
                right: 0.5rem;
                background: none;
                border: none;
                font-size: 1rem;
                cursor: pointer;
                color: var(--gray);
            `;
            closeBtn.onclick = () => notification.remove();
            notification.style.position = 'relative';
            notification.appendChild(closeBtn);
        }
    }

    // Play emergency sound
    playEmergencySound() {
        // Create emergency beep sound
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
            
            // Repeat 3 times
            setTimeout(() => {
                oscillator.start(audioContext.currentTime + 0.6);
                oscillator.stop(audioContext.currentTime + 1.1);
            }, 600);
            
            setTimeout(() => {
                oscillator.start(audioContext.currentTime + 1.2);
                oscillator.stop(audioContext.currentTime + 1.7);
            }, 1200);
        } catch (error) {
            console.log('Emergency sound played (simulated)');
        }
    }

    // Update driver dashboard with new booking
    updateDriverDashboard(data) {
        // If user is on their rides page, refresh the list
        if (window.location.hash === '#my-rides' || document.getElementById('my-rides-page')) {
            loadMyRides();
        }
    }
}

// Create global notification manager
const notificationManager = new NotificationManager();