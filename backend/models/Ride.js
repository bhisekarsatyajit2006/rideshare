const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema({
    driver: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: [true, 'Ride must have a driver']
    },
    from: {
        address: {
            type: String,
            required: [true, 'Pickup location address is required'],
            trim: true
        },
        coordinates: {
            lat: { 
                type: Number, 
                required: false, // Changed to false
                default: 19.0760 // Default Mumbai coordinates
            },
            lng: { 
                type: Number, 
                required: false, // Changed to false
                default: 72.8777 // Default Mumbai coordinates
            }
        },
        city: {
            type: String,
            trim: true
        },
        landmark: {
            type: String,
            trim: true
        }
    },
    to: {
        address: {
            type: String,
            required: [true, 'Destination address is required'],
            trim: true
        },
        coordinates: {
            lat: { 
                type: Number, 
                required: false, // Changed to false
                default: 18.5204 // Default Pune coordinates
            },
            lng: { 
                type: Number, 
                required: false, // Changed to false
                default: 73.8567 // Default Pune coordinates
            }
        },
        city: {
            type: String,
            trim: true
        },
        landmark: {
            type: String,
            trim: true
        }
    },
    date: {
        type: Date,
        required: [true, 'Ride date is required']
        // Removed future date validation
    },
    departureTime: {
        type: String,
        required: [true, 'Departure time is required']
        // Removed time format validation
    },
    availableSeats: {
        type: Number,
        required: [true, 'Available seats is required'],
        min: [1, 'At least 1 seat must be available'],
        max: [10, 'Cannot have more than 10 seats']
    },
    pricePerSeat: {
        type: Number,
        required: [true, 'Price per seat is required'],
        min: [10, 'Minimum price per seat is 10'],
        max: [5000, 'Maximum price per seat is 5000']
    },
    vehicleType: {
        type: String,
        required: [true, 'Vehicle type is required']
        // Removed enum validation
    },
    vehicleNumber: {
        type: String,
        required: [true, 'Vehicle number is required'],
        uppercase: true,
        trim: true
        // Removed strict format validation
    },
    vehicleDetails: {
        model: {
            type: String,
            trim: true
        },
        color: {
            type: String,
            trim: true
        },
        year: {
            type: Number,
            min: 2000,
            max: new Date().getFullYear() + 1
        }
    },
    amenities: [{
        type: String
        // Removed enum validation
    }],
    additionalNotes: {
        type: String,
        maxlength: [500, 'Additional notes cannot exceed 500 characters'],
        trim: true
    },
    passengers: [{
        user: {
            type: mongoose.Schema.ObjectId,
            ref: 'User',
            required: true
        },
        bookedAt: {
            type: Date,
            default: Date.now
        },
        pickupPoint: {
            address: String,
            coordinates: {
                lat: Number,
                lng: Number
            }
        },
        seats: {
            type: Number,
            required: true,
            min: 1,
            max: 4
        },
        status: {
            type: String,
            enum: ['confirmed', 'pending', 'cancelled', 'no-show'],
            default: 'confirmed'
        },
        booking: {
            type: mongoose.Schema.ObjectId,
            ref: 'Booking'
        }
    }],
    status: {
        type: String,
        enum: {
            values: ['active', 'completed', 'cancelled', 'full', 'in-progress', 'expired'],
            message: 'Invalid ride status'
        },
        default: 'active'
    },
    routePolyline: {
        type: String
    },
    estimatedDuration: {
        type: Number, // in minutes
        min: 1
    },
    estimatedDistance: {
        type: Number, // in kilometers
        min: 0.1
    },
    actualDuration: {
        type: Number // in minutes
    },
    actualDistance: {
        type: Number // in kilometers
    },
    stops: [{
        address: String,
        coordinates: {
            lat: Number,
            lng: Number
        },
        order: Number
    }],
    cancellationReason: {
        type: String,
        trim: true,
        maxlength: 200
    },
    isRecurring: {
        type: Boolean,
        default: false
    },
    recurringPattern: {
        type: String,
        enum: ['daily', 'weekly', 'monthly']
    },
    maxDetourDistance: {
        type: Number, // in kilometers
        default: 5,
        min: 0,
        max: 50
    },
    smokingAllowed: {
        type: Boolean,
        default: false
    },
    petsAllowed: {
        type: Boolean,
        default: false
    },
    luggageCapacity: {
        type: Number, // in bags
        min: 0,
        max: 10
    },
    ridePreferences: {
        music: {
            type: Boolean,
            default: false
        },
        conversation: {
            type: Boolean,
            default: false
        },
        temperature: {
            type: String,
            enum: ['warm', 'cool', 'neutral'],
            default: 'neutral'
        }
    },
    emergencyContactNotified: {
        type: Boolean,
        default: false
    },
    rideStartedAt: {
        type: Date
    },
    rideCompletedAt: {
        type: Date
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for better query performance
rideSchema.index({ 'from.coordinates': '2dsphere' });
rideSchema.index({ 'to.coordinates': '2dsphere' });
rideSchema.index({ date: 1, departureTime: 1 });
rideSchema.index({ driver: 1, status: 1 });
rideSchema.index({ status: 1, date: 1 });
rideSchema.index({ vehicleType: 1 });
rideSchema.index({ 'from.city': 1, 'to.city': 1 });
rideSchema.index({ createdAt: -1 });

// Virtual for booked seats count
rideSchema.virtual('bookedSeats').get(function() {
    return this.passengers
        .filter(passenger => ['confirmed', 'pending'].includes(passenger.status))
        .reduce((total, passenger) => total + passenger.seats, 0);
});

// Virtual for remaining seats
rideSchema.virtual('remainingSeats').get(function() {
    return this.availableSeats - this.bookedSeats;
});

// Virtual for total earnings
rideSchema.virtual('totalEarnings').get(function() {
    const confirmedPassengers = this.passengers.filter(p => p.status === 'confirmed');
    return confirmedPassengers.reduce((total, passenger) => {
        return total + (passenger.seats * this.pricePerSeat);
    }, 0);
});

// Virtual for checking if ride is in past
rideSchema.virtual('isPast').get(function() {
    const rideDateTime = new Date(this.date);
    const [hours, minutes] = this.departureTime.split(':');
    rideDateTime.setHours(parseInt(hours), parseInt(minutes));
    return rideDateTime < new Date();
});

// Virtual for ride duration in readable format
rideSchema.virtual('durationFormatted').get(function() {
    if (!this.estimatedDuration) return null;
    const hours = Math.floor(this.estimatedDuration / 60);
    const minutes = this.estimatedDuration % 60;
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
});

// Instance method to check if ride is full
rideSchema.methods.isFull = function() {
    return this.remainingSeats <= 0;
};

// Instance method to check if user is passenger
rideSchema.methods.isPassenger = function(userId) {
    return this.passengers.some(passenger => 
        passenger.user.toString() === userId.toString() && 
        passenger.status === 'confirmed'
    );
};

// Instance method to add passenger
rideSchema.methods.addPassenger = function(userId, seats, pickupPoint, bookingId) {
    if (this.isFull()) {
        throw new Error('Ride is full');
    }
    
    if (this.remainingSeats < seats) {
        throw new Error(`Only ${this.remainingSeats} seats available`);
    }
    
    if (this.isPassenger(userId)) {
        throw new Error('User is already a passenger');
    }
    
    this.passengers.push({
        user: userId,
        seats: seats,
        pickupPoint: pickupPoint,
        booking: bookingId,
        status: 'confirmed'
    });
    
    this.updateStatus();
};

// Instance method to remove passenger
rideSchema.methods.removePassenger = function(userId) {
    const passengerIndex = this.passengers.findIndex(
        passenger => passenger.user.toString() === userId.toString()
    );
    
    if (passengerIndex === -1) {
        throw new Error('Passenger not found');
    }
    
    this.passengers[passengerIndex].status = 'cancelled';
    this.updateStatus();
};

// Instance method to update ride status
rideSchema.methods.updateStatus = function() {
    if (this.isFull()) {
        this.status = 'full';
    } else if (this.status === 'full' && !this.isFull()) {
        this.status = 'active';
    }
    
    // Auto-complete past rides
    if (this.isPast && this.status === 'active') {
        this.status = 'completed';
        this.rideCompletedAt = new Date();
    }
};

// Instance method to check if ride can be cancelled
rideSchema.methods.canBeCancelled = function() {
    const now = new Date();
    const rideDateTime = new Date(this.date);
    const [hours, minutes] = this.departureTime.split(':');
    rideDateTime.setHours(parseInt(hours), parseInt(minutes));
    
    const hoursUntilRide = (rideDateTime - now) / (1000 * 60 * 60);
    return hoursUntilRide > 2 && this.status === 'active';
};

// Instance method to get confirmed passengers count
rideSchema.methods.getConfirmedPassengersCount = function() {
    return this.passengers.filter(p => p.status === 'confirmed').length;
};

// Static method to find active rides
rideSchema.statics.findActiveRides = function() {
    return this.find({ 
        status: 'active',
        date: { $gte: new Date() }
    }).populate('driver', 'name avatar rating');
};

// Static method to find rides by location
rideSchema.statics.findByLocation = function(fromLat, fromLng, toLat, toLng, maxDistance = 5000) {
    return this.find({
        status: 'active',
        date: { $gte: new Date() },
        'from.coordinates': {
            $near: {
                $geometry: {
                    type: 'Point',
                    coordinates: [fromLng, fromLat]
                },
                $maxDistance: maxDistance
            }
        },
        'to.coordinates': {
            $near: {
                $geometry: {
                    type: 'Point',
                    coordinates: [toLng, toLat]
                },
                $maxDistance: maxDistance
            }
        }
    });
};

// Static method to get driver's ride statistics
rideSchema.statics.getDriverStats = function(driverId) {
    return this.aggregate([
        {
            $match: { driver: mongoose.Types.ObjectId(driverId) }
        },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                totalEarnings: { 
                    $sum: {
                        $multiply: ['$pricePerSeat', '$bookedSeats']
                    }
                }
            }
        }
    ]);
};

// Middleware to update status before save
rideSchema.pre('save', function(next) {
    this.updateStatus();
    next();
});

// Middleware to populate driver details
rideSchema.pre(/^find/, function(next) {
    this.populate({
        path: 'driver',
        select: 'name avatar rating phone email isVerified'
    });
    next();
});

// Query middleware to exclude cancelled and expired rides by default
rideSchema.pre(/^find/, function(next) {
    this.find({ status: { $ne: 'cancelled' } });
    next();
});

module.exports = mongoose.model('Ride', rideSchema);