const mongoose = require('mongoose');

// Utility function to handle validation errors
const handleValidationErrors = (res, errors) => {
    return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors
    });
};

// Validation for user registration
exports.validateRegistration = (req, res, next) => {
    const { name, email, phone, password, workplace, emergencyContacts } = req.body;
    const errors = [];

    // Check required fields
    if (!name) errors.push({ field: 'name', message: 'Name is required' });
    if (!email) errors.push({ field: 'email', message: 'Email is required' });
    if (!phone) errors.push({ field: 'phone', message: 'Phone is required' });
    if (!password) errors.push({ field: 'password', message: 'Password is required' });
    if (!workplace) errors.push({ field: 'workplace', message: 'Workplace is required' });

    // Validate email format
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push({ field: 'email', message: 'Please provide a valid email address' });
    }

    // Validate password strength
    if (password && password.length < 6) {
        errors.push({ field: 'password', message: 'Password must be at least 6 characters long' });
    }

    // Validate phone format
    if (phone && !/^\+?[\d\s\-\(\)]{10,15}$/.test(phone)) {
        errors.push({ field: 'phone', message: 'Please provide a valid phone number' });
    }

    // Validate emergency contacts
    if (emergencyContacts && Array.isArray(emergencyContacts)) {
        emergencyContacts.forEach((contact, index) => {
            if (!contact.name) {
                errors.push({ field: `emergencyContacts[${index}].name`, message: 'Emergency contact name is required' });
            }
            if (!contact.phone) {
                errors.push({ field: `emergencyContacts[${index}].phone`, message: 'Emergency contact phone is required' });
            }
            if (!contact.relationship) {
                errors.push({ field: `emergencyContacts[${index}].relationship`, message: 'Emergency contact relationship is required' });
            }
            if (contact.phone && !/^\+?[\d\s\-\(\)]{10,15}$/.test(contact.phone)) {
                errors.push({ field: `emergencyContacts[${index}].phone`, message: 'Emergency contact phone number is invalid' });
            }
        });
    }

    if (errors.length > 0) {
        return handleValidationErrors(res, errors);
    }

    next();
};

// Validation for user login
exports.validateLogin = (req, res, next) => {
    const { email, password } = req.body;
    const errors = [];

    if (!email) errors.push({ field: 'email', message: 'Email is required' });
    if (!password) errors.push({ field: 'password', message: 'Password is required' });

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push({ field: 'email', message: 'Please provide a valid email address' });
    }

    if (errors.length > 0) {
        return handleValidationErrors(res, errors);
    }

    next();
};

// Validation for profile update
exports.validateProfileUpdate = (req, res, next) => {
    const { name, email, phone, workplace, emergencyContacts } = req.body;
    const errors = [];

    // Validate name if provided
    if (name && name.trim().length < 2) {
        errors.push({ field: 'name', message: 'Name must be at least 2 characters long' });
    }

    // Validate email if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push({ field: 'email', message: 'Please provide a valid email address' });
    }

    // Validate phone if provided
    if (phone && !/^\+?[\d\s\-\(\)]{10,15}$/.test(phone)) {
        errors.push({ field: 'phone', message: 'Please provide a valid phone number' });
    }

    // Validate workplace if provided
    if (workplace && workplace.trim().length < 2) {
        errors.push({ field: 'workplace', message: 'Workplace must be at least 2 characters long' });
    }

    // Validate emergency contacts if provided
    if (emergencyContacts && Array.isArray(emergencyContacts)) {
        emergencyContacts.forEach((contact, index) => {
            if (!contact.name) {
                errors.push({ field: `emergencyContacts[${index}].name`, message: 'Emergency contact name is required' });
            }
            if (!contact.phone) {
                errors.push({ field: `emergencyContacts[${index}].phone`, message: 'Emergency contact phone is required' });
            }
            if (!contact.relationship) {
                errors.push({ field: `emergencyContacts[${index}].relationship`, message: 'Emergency contact relationship is required' });
            }
        });
    }

    if (errors.length > 0) {
        return handleValidationErrors(res, errors);
    }

    next();
};

// Validation for password change
exports.validateChangePassword = (req, res, next) => {
    const { currentPassword, newPassword } = req.body;
    const errors = [];

    if (!currentPassword) errors.push({ field: 'currentPassword', message: 'Current password is required' });
    if (!newPassword) errors.push({ field: 'newPassword', message: 'New password is required' });

    if (newPassword && newPassword.length < 6) {
        errors.push({ field: 'newPassword', message: 'New password must be at least 6 characters long' });
    }

    if (newPassword && currentPassword && newPassword === currentPassword) {
        errors.push({ field: 'newPassword', message: 'New password must be different from current password' });
    }

    if (errors.length > 0) {
        return handleValidationErrors(res, errors);
    }

    next();
};

// Validation for forgot password
exports.validateForgotPassword = (req, res, next) => {
    const { email } = req.body;
    const errors = [];

    if (!email) {
        errors.push({ field: 'email', message: 'Email is required' });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push({ field: 'email', message: 'Please provide a valid email address' });
    }

    if (errors.length > 0) {
        return handleValidationErrors(res, errors);
    }

    next();
};

// Validation for reset password
exports.validateResetPassword = (req, res, next) => {
    const { password } = req.body;
    const { resetToken } = req.params;
    const errors = [];

    if (!password) {
        errors.push({ field: 'password', message: 'Password is required' });
    } else if (password.length < 6) {
        errors.push({ field: 'password', message: 'Password must be at least 6 characters long' });
    }

    if (!resetToken) {
        errors.push({ field: 'resetToken', message: 'Reset token is required' });
    }

    if (errors.length > 0) {
        return handleValidationErrors(res, errors);
    }

    next();
};

// Simple validation for email verification
exports.validateEmailVerification = (req, res, next) => {
    const { token } = req.body;
    const errors = [];

    if (!token) {
        errors.push({ field: 'token', message: 'Verification token is required' });
    }

    if (errors.length > 0) {
        return handleValidationErrors(res, errors);
    }

    next();
};

// Simple validation for MongoDB ObjectId
exports.validateObjectId = (req, res, next) => {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid ID format'
        });
    }
    
    next();
};

// Simple validation for pagination
exports.validatePagination = (req, res, next) => {
    const { page, limit } = req.query;
    const errors = [];

    if (page && (isNaN(page) || parseInt(page) < 1)) {
        errors.push({ field: 'page', message: 'Page must be a positive integer' });
    }

    if (limit && (isNaN(limit) || parseInt(limit) < 1 || parseInt(limit) > 100)) {
        errors.push({ field: 'limit', message: 'Limit must be between 1 and 100' });
    }

    if (errors.length > 0) {
        return handleValidationErrors(res, errors);
    }

    next();
};