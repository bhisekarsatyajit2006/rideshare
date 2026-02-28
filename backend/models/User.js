const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a name'],
        trim: true,
        maxlength: [50, 'Name cannot be more than 50 characters'],
        minlength: [2, 'Name must be at least 2 characters']
    },
    email: {
        type: String,
        required: [true, 'Please add an email'],
        unique: true,
        lowercase: true,
        validate: [validator.isEmail, 'Please add a valid email'],
        index: true
    },
    phone: {
        type: String,
        required: [true, 'Please add a phone number'],
        match: [/^\+?[\d\s\-\(\)]{10,}$/, 'Please add a valid phone number'],
        trim: true
    },
    password: {
        type: String,
        required: [true, 'Please add a password'],
        minlength: [6, 'Password must be at least 6 characters'],
        select: false
    },
    workplace: {
        type: String,
        required: [true, 'Please add your university or workplace'],
        trim: true,
        maxlength: [100, 'Workplace cannot be more than 100 characters']
    },
    avatar: {
        type: String,
        default: ''
    },
    dateOfBirth: {
        type: Date,
        validate: {
            validator: function(dob) {
                const age = (new Date() - dob) / (365.25 * 24 * 60 * 60 * 1000);
                return age >= 18;
            },
            message: 'You must be at least 18 years old'
        }
    },
    gender: {
        type: String,
        enum: {
            values: ['male', 'female', 'other', 'prefer-not-to-say'],
            message: 'Gender must be male, female, other, or prefer-not-to-say'
        }
    },
    emergencyContacts: [{
        name: {
            type: String,
            required: [true, 'Emergency contact name is required'],
            trim: true
        },
        phone: {
            type: String,
            required: [true, 'Emergency contact phone is required'],
            match: [/^\+?[\d\s\-\(\)]{10,}$/, 'Please add a valid phone number']
        },
        relationship: {
            type: String,
            required: [true, 'Relationship is required'],
            enum: {
                values: ['parent', 'mother', 'father', 'sibling', 'brother', 'sister', 'spouse', 'friend', 'relative', 'other'],
                message: 'Relationship must be parent, mother, father, sibling, brother, sister, spouse, friend, relative, or other'
            }
        },
        isPrimary: {
            type: Boolean,
            default: false
        }
    }],
    preferences: {
        notifications: {
            email: { type: Boolean, default: true },
            sms: { type: Boolean, default: true },
            push: { type: Boolean, default: true }
        },
        ridePreferences: {
            smoking: { type: Boolean, default: false },
            music: { type: Boolean, default: true },
            conversation: { type: String, enum: ['friendly', 'quiet', 'no-preference'], default: 'no-preference' },
            temperature: { type: String, enum: ['warm', 'cool', 'neutral'], default: 'neutral' }
        },
        language: {
            type: String,
            default: 'en',
            enum: ['en', 'es', 'fr', 'de', 'hi']
        }
    },
    stats: {
        ridesOffered: {
            type: Number,
            default: 0
        },
        ridesTaken: {
            type: Number,
            default: 0
        },
        moneySaved: {
            type: Number,
            default: 0
        },
        totalEarnings: {
            type: Number,
            default: 0
        },
        carbonSaved: {
            type: Number,
            default: 0
        },
        totalDistance: {
            type: Number,
            default: 0
        }
    },
    rating: {
        average: {
            type: Number,
            default: 4.5,
            min: [1, 'Rating must be at least 1'],
            max: [5, 'Rating cannot exceed 5']
        },
        asDriver: {
            type: Number,
            default: 4.5
        },
        asPassenger: {
            type: Number,
            default: 4.5
        },
        count: {
            type: Number,
            default: 0
        },
        breakdown: {
            '1': { type: Number, default: 0 },
            '2': { type: Number, default: 0 },
            '3': { type: Number, default: 0 },
            '4': { type: Number, default: 0 },
            '5': { type: Number, default: 0 }
        }
    },
    verification: {
        email: {
            isVerified: {
                type: Boolean,
                default: false
            },
            token: String,
            expires: Date
        },
        phone: {
            isVerified: {
                type: Boolean,
                default: false
            },
            code: String,
            expires: Date
        },
        license: {
            isVerified: {
                type: Boolean,
                default: false
            },
            verifiedAt: Date,
            licenseNumber: String,
            licenseImage: String,
            expiryDate: Date
        },
        identity: {
            isVerified: {
                type: Boolean,
                default: false
            },
            documentType: String,
            documentImage: String,
            verifiedAt: Date
        }
    },
    role: {
        type: String,
        enum: {
            values: ['user', 'driver', 'admin'],
            message: 'Role must be user, driver, or admin'
        },
        default: 'user'
    },
    status: {
        type: String,
        enum: {
            values: ['active', 'suspended', 'inactive', 'banned'],
            message: 'Status must be active, suspended, inactive, or banned'
        },
        default: 'active'
    },
    lastActive: {
        type: Date,
        default: Date.now
    },
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    loginAttempts: {
        type: Number,
        default: 0
    },
    lockUntil: Date
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for better performance
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ status: 1 });
userSchema.index({ 'verification.email.isVerified': 1 });
userSchema.index({ 'verification.license.isVerified': 1 });
userSchema.index({ role: 1 });

// Virtual for full name (if needed)
userSchema.virtual('fullName').get(function() {
    return this.name;
});

// Virtual for user age
userSchema.virtual('age').get(function() {
    if (!this.dateOfBirth) return null;
    return Math.floor((new Date() - this.dateOfBirth) / (365.25 * 24 * 60 * 60 * 1000));
});

// Virtual for isProfileComplete
userSchema.virtual('isProfileComplete').get(function() {
    return !!(this.name && this.email && this.phone && this.workplace && this.avatar);
});

// Encrypt password using bcrypt
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) {
        return next();
    }

    try {
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Update passwordChangedAt when password is modified
userSchema.pre('save', function(next) {
    if (!this.isModified('password') || this.isNew) {
        return next();
    }
    this.passwordChangedAt = Date.now() - 1000;
    next();
});

// Generate avatar if not provided
userSchema.pre('save', function(next) {
    if (!this.avatar || this.avatar === '') {
        this.avatar = this.generateAvatar();
    }
    next();
});

// Ensure only one primary emergency contact
userSchema.pre('save', function(next) {
    if (this.emergencyContacts && this.emergencyContacts.length > 0) {
        const primaryContacts = this.emergencyContacts.filter(contact => contact.isPrimary);
        if (primaryContacts.length > 1) {
            this.emergencyContacts.forEach((contact, index) => {
                contact.isPrimary = index === 0;
            });
        }
    }
    next();
});

// Instance Methods

// Sign JWT and return
userSchema.methods.getSignedJwtToken = function() {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
        { id: this._id }, 
        process.env.JWT_SECRET, 
        {
            expiresIn: process.env.JWT_EXPIRE || '30d'
        }
    );
};

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function(enteredPassword) {
    if (!this.password) {
        throw new Error('Password not available');
    }
    return await bcrypt.compare(enteredPassword, this.password);
};

// Check if password was changed after JWT was issued
userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
    if (this.passwordChangedAt) {
        const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
        return JWTTimestamp < changedTimestamp;
    }
    return false;
};

// Generate password reset token
userSchema.methods.createPasswordResetToken = function() {
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    this.passwordResetToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');
        
    this.passwordResetExpires = Date.now() + 10 * 60 * 1000;
    
    return resetToken;
};

// Generate email verification token
userSchema.methods.createEmailVerificationToken = function() {
    const verificationToken = crypto.randomBytes(32).toString('hex');
    
    this.emailVerificationToken = crypto
        .createHash('sha256')
        .update(verificationToken)
        .digest('hex');
        
    this.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;
    
    return verificationToken;
};

// Generate avatar URL
userSchema.methods.generateAvatar = function() {
    const colors = ['#14b8a6', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(this.name)}&background=${color.replace('#', '')}&color=fff&size=128&bold=true&font-size=0.5`;
};

// Check if account is locked
userSchema.methods.isLocked = function() {
    return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Increment login attempts
userSchema.methods.incrementLoginAttempts = function() {
    if (this.lockUntil && this.lockUntil < Date.now()) {
        return this.updateOne({
            $set: { loginAttempts: 1 },
            $unset: { lockUntil: 1 }
        });
    }
    
    const updates = { $inc: { loginAttempts: 1 } };
    
    if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
        updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 };
    }
    
    return this.updateOne(updates);
};

// Update rating
userSchema.methods.updateRating = function(newRating, userType = 'passenger') {
    this.rating.count += 1;
    this.rating.breakdown[newRating] += 1;
    
    const total = Object.entries(this.rating.breakdown).reduce((sum, [stars, count]) => {
        return sum + (parseInt(stars) * count);
    }, 0);
    
    this.rating.average = total / this.rating.count;
    
    if (userType === 'driver') {
        this.rating.asDriver = (this.rating.asDriver * (this.rating.count - 1) + newRating) / this.rating.count;
    } else {
        this.rating.asPassenger = (this.rating.asPassenger * (this.rating.count - 1) + newRating) / this.rating.count;
    }
};

// Static Methods

// Find active users
userSchema.statics.findActiveUsers = function() {
    return this.find({ 
        status: 'active',
        lastActive: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    });
};

// Find verified drivers
userSchema.statics.findVerifiedDrivers = function() {
    return this.find({
        role: 'driver',
        status: 'active',
        'verification.license.isVerified': true,
        'verification.email.isVerified': true
    });
};

// Get user statistics
userSchema.statics.getUserStats = function() {
    return this.aggregate([
        {
            $group: {
                _id: '$role',
                count: { $sum: 1 },
                avgRating: { $avg: '$rating.average' },
                verifiedUsers: {
                    $sum: {
                        $cond: [{ $eq: ['$verification.email.isVerified', true] }, 1, 0]
                    }
                }
            }
        }
    ]);
};

module.exports = mongoose.model('User', userSchema);