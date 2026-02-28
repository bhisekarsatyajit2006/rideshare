const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes
exports.protect = async (req, res, next) => {
    let token;

    // Check for token in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    // Check for token in cookies (optional - if you're using cookies)
    else if (req.cookies && req.cookies.token) {
        token = req.cookies.token;
    }

    // Make sure token exists
    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Not authorized to access this route - No token provided'
        });
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Check if user still exists
        const user = await User.findById(decoded.id);
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User no longer exists'
            });
        }

        // Check if user account is active
        if (user.status && user.status !== 'active') {
            return res.status(401).json({
                success: false,
                message: 'Your account has been deactivated. Please contact support.'
            });
        }

        // Add user to request object
        req.user = user;
        next();
        
    } catch (err) {
        console.error('Token verification error:', err);

        // Handle specific JWT errors
        if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token'
            });
        }

        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token has expired'
            });
        }

        return res.status(401).json({
            success: false,
            message: 'Not authorized to access this route'
        });
    }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
    return (req, res, next) => {
        // Make sure user exists (should always be true if protect middleware ran first)
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `User role ${req.user.role} is not authorized to access this route. Required roles: ${roles.join(', ')}`
            });
        }
        next();
    };
};

// Optional: Check if user is verified
exports.requireVerification = (req, res, next) => {
    if (!req.user.isVerified) {
        return res.status(403).json({
            success: false,
            message: 'Please verify your account to access this route'
        });
    }
    next();
};

// Optional: Check if license is verified (for drivers)
exports.requireLicenseVerification = (req, res, next) => {
    if (!req.user.licenseVerified) {
        return res.status(403).json({
            success: false,
            message: 'Please verify your license to access this route'
        });
    }
    next();
};

// Optional: Check if user is the owner of the resource or admin
exports.requireOwnershipOrAdmin = (resourceOwnerId) => {
    return (req, res, next) => {
        // Allow if user is admin
        if (req.user.role === 'admin') {
            return next();
        }

        // Allow if user is the owner of the resource
        if (req.user._id.toString() === resourceOwnerId.toString()) {
            return next();
        }

        return res.status(403).json({
            success: false,
            message: 'Not authorized to access this resource'
        });
    };
};

// Optional: Rate limiting middleware (basic implementation)
exports.rateLimit = (windowMs, maxRequests) => {
    const requests = new Map();
    
    return (req, res, next) => {
        const ip = req.ip || req.connection.remoteAddress;
        const now = Date.now();
        const windowStart = now - windowMs;
        
        // Clean old entries
        for (const [key, value] of requests.entries()) {
            if (value.timestamp < windowStart) {
                requests.delete(key);
            }
        }
        
        // Check current requests
        const userRequests = requests.get(ip) || { count: 0, timestamp: now };
        
        if (userRequests.count >= maxRequests) {
            return res.status(429).json({
                success: false,
                message: 'Too many requests, please try again later'
            });
        }
        
        // Update request count
        userRequests.count++;
        userRequests.timestamp = now;
        requests.set(ip, userRequests);
        
        next();
    };
};

// Optional: Check if user can create rides (basic validation)
exports.canCreateRide = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        
        if (!user.isVerified) {
            return res.status(403).json({
                success: false,
                message: 'Please verify your account before creating rides'
            });
        }
        
        // Add additional checks here if needed (e.g., driver license verification)
        if (user.role === 'driver' && !user.licenseVerified) {
            return res.status(403).json({
                success: false,
                message: 'Please verify your driver license before creating rides'
            });
        }
        
        next();
    } catch (error) {
        console.error('Can create ride check error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error checking ride creation permissions'
        });
    }
};

// Optional: Validate object ownership
exports.checkOwnership = (model) => {
    return async (req, res, next) => {
        try {
            const resource = await model.findById(req.params.id);
            
            if (!resource) {
                return res.status(404).json({
                    success: false,
                    message: 'Resource not found'
                });
            }
            
            // Check if user owns the resource or is admin
            const ownerField = resource.driver ? 'driver' : 'user';
            const ownerId = resource[ownerField] ? resource[ownerField].toString() : resource.user.toString();
            
            if (ownerId !== req.user.id && req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Not authorized to access this resource'
                });
            }
            
            req.resource = resource;
            next();
        } catch (error) {
            console.error('Ownership check error:', error);
            return res.status(500).json({
                success: false,
                message: 'Error checking resource ownership'
            });
        }
    };
};