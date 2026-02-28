const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    ride: {
        type: mongoose.Schema.ObjectId,
        ref: 'Ride',
        required: [true, 'Booking must belong to a ride']
    },
    passenger: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: [true, 'Booking must belong to a passenger']
    },
    seatsBooked: {
        type: Number,
        required: [true, 'Please specify number of seats booked'],
        min: [1, 'At least 1 seat must be booked'],
        max: [10, 'Cannot book more than 10 seats']
    },
    totalPrice: {
        type: Number,
        required: [true, 'Total price is required'],
        min: [0, 'Price cannot be negative']
    },
    pickupPoint: {
        address: {
            type: String,
            required: [true, 'Pickup address is required'],
            trim: true
        },
        coordinates: {
            lat: { type: Number },
            lng: { type: Number }
        }
    },
    status: {
        type: String,
        enum: {
            values: ['pending', 'confirmed', 'cancelled', 'completed', 'rejected'],
            message: 'Status must be pending, confirmed, cancelled, completed, or rejected'
        },
        default: 'pending'
    },
    bookingDate: {
        type: Date,
        default: Date.now
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'refunded'],
        default: 'pending'
    },
    paymentMethod: {
        type: String,
        enum: ['cash', 'card', 'wallet', 'upi'],
        default: 'cash'
    },
    transactionId: {
        type: String,
        trim: true
    },
    driverRating: {
        rating: {
            type: Number,
            min: [1, 'Rating must be at least 1'],
            max: [5, 'Rating cannot exceed 5']
        },
        comment: {
            type: String,
            maxlength: [500, 'Review cannot exceed 500 characters'],
            trim: true
        },
        ratedAt: {
            type: Date
        }
    },
    passengerRating: {
        rating: {
            type: Number,
            min: [1, 'Rating must be at least 1'],
            max: [5, 'Rating cannot exceed 5']
        },
        comment: {
            type: String,
            maxlength: [500, 'Review cannot exceed 500 characters'],
            trim: true
        },
        ratedAt: {
            type: Date
        }
    },
    cancellationReason: {
        type: String,
        trim: true,
        maxlength: [200, 'Cancellation reason cannot exceed 200 characters']
    },
    cancelledBy: {
        type: String,
        enum: ['passenger', 'driver', 'system']
    },
    cancellationDate: {
        type: Date
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
    },
    estimatedPickupTime: {
        type: String
    },
    specialRequests: {
        type: String,
        maxlength: [200, 'Special requests cannot exceed 200 characters'],
        trim: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Compound index to prevent double booking (only for active bookings)
bookingSchema.index({ 
    ride: 1, 
    passenger: 1 
}, { 
    unique: true,
    partialFilterExpression: { 
        status: { $in: ['pending', 'confirmed'] } 
    } 
});

// Index for better query performance
bookingSchema.index({ passenger: 1, createdAt: -1 });
bookingSchema.index({ ride: 1, status: 1 });
bookingSchema.index({ status: 1, bookingDate: 1 });
bookingSchema.index({ 'passenger': 1, 'status': 1 });

// Virtual populate to get ride details
bookingSchema.virtual('rideDetails', {
    ref: 'Ride',
    localField: 'ride',
    foreignField: '_id',
    justOne: true
});

// Virtual populate to get passenger details
bookingSchema.virtual('passengerDetails', {
    ref: 'User',
    localField: 'passenger',
    foreignField: '_id',
    justOne: true
});

// Instance method to check if booking can be cancelled
bookingSchema.methods.canBeCancelled = function() {
    const now = new Date();
    const rideDate = this.populated('ride') ? this.ride.date : null;
    
    if (!rideDate) return false;
    
    // Allow cancellation up to 1 hour before ride
    const cancellationDeadline = new Date(rideDate);
    cancellationDeadline.setHours(cancellationDeadline.getHours() - 1);
    
    return now < cancellationDeadline && 
           ['pending', 'confirmed'].includes(this.status) &&
           this.paymentStatus !== 'refunded';
};

// Instance method to calculate refund amount
bookingSchema.methods.calculateRefund = function() {
    if (this.status !== 'cancelled') return 0;
    
    const now = new Date();
    const rideDate = this.populated('ride') ? this.ride.date : null;
    
    if (!rideDate) return 0;
    
    const hoursUntilRide = (rideDate - now) / (1000 * 60 * 60);
    
    if (hoursUntilRide > 24) {
        return this.totalPrice; // Full refund if cancelled 24+ hours before
    } else if (hoursUntilRide > 2) {
        return this.totalPrice * 0.5; // 50% refund if cancelled 2-24 hours before
    } else {
        return 0; // No refund if cancelled within 2 hours
    }
};

// Static method to get bookings by status
bookingSchema.statics.getBookingsByStatus = function(status) {
    return this.find({ status }).populate('ride passenger');
};

// Static method to get passenger's booking history
bookingSchema.statics.getPassengerBookings = function(passengerId, limit = 10) {
    return this.find({ passenger: passengerId })
        .populate('ride')
        .populate('ride.driver', 'name avatar rating')
        .sort({ createdAt: -1 })
        .limit(limit);
};

// Static method to get driver's ride bookings
bookingSchema.statics.getDriverBookings = function(driverId, limit = 10) {
    return this.find()
        .populate({
            path: 'ride',
            match: { driver: driverId },
            populate: { path: 'driver', select: 'name avatar rating' }
        })
        .sort({ createdAt: -1 })
        .limit(limit);
};

// Middleware to validate seat availability before saving
bookingSchema.pre('save', async function(next) {
    if (this.isModified('seatsBooked') || this.isNew) {
        try {
            const Ride = mongoose.model('Ride');
            const ride = await Ride.findById(this.ride);
            
            if (!ride) {
                throw new Error('Ride not found');
            }
            
            if (ride.availableSeats < this.seatsBooked) {
                throw new Error(`Only ${ride.availableSeats} seats available`);
            }
            
            // Check if ride is active
            if (ride.status !== 'active') {
                throw new Error(`Cannot book a ${ride.status} ride`);
            }
            
            next();
        } catch (error) {
            next(error);
        }
    } else {
        next();
    }
});

// Middleware to update ride seats after booking is confirmed
bookingSchema.post('save', async function(doc) {
    if (doc.status === 'confirmed') {
        try {
            const Ride = mongoose.model('Ride');
            await Ride.findByIdAndUpdate(
                doc.ride,
                { 
                    $inc: { availableSeats: -doc.seatsBooked },
                    $addToSet: { 
                        passengers: { 
                            user: doc.passenger, 
                            seats: doc.seatsBooked,
                            booking: doc._id 
                        } 
                    }
                }
            );
        } catch (error) {
            console.error('Error updating ride seats:', error);
        }
    }
});

// Query middleware to always populate basic fields
bookingSchema.pre(/^find/, function(next) {
    this.populate({
        path: 'passenger',
        select: 'name email phone avatar rating'
    });
    next();
});

module.exports = mongoose.model('Booking', bookingSchema);