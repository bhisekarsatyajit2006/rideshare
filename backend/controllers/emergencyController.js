const User = require('../models/User');
const Emergency = require('../models/Emergency'); // Create this model for tracking
const notificationService = require('../utils/notification');

// @desc    Trigger SOS emergency
// @route   POST /api/emergency/sos
// @access  Private
exports.triggerSOS = async (req, res) => {
    try {
        const { location, coordinates, additionalInfo } = req.body;
        
        const user = await User.findById(req.user.id);
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Validate emergency contacts
        if (!user.emergencyContacts || user.emergencyContacts.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No emergency contacts found. Please add emergency contacts to your profile.'
            });
        }

        // Validate that contacts have at least phone numbers
        const validContacts = user.emergencyContacts.filter(contact => 
            contact.phone && contact.phone.trim() !== ''
        );

        if (validContacts.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid emergency contacts with phone numbers found.'
            });
        }

        // Create emergency record in database
        const emergencyRecord = await Emergency.create({
            user: user._id,
            type: 'sos',
            location: location || 'Location not specified',
            coordinates: coordinates || null,
            additionalInfo: additionalInfo || '',
            emergencyContacts: validContacts,
            status: 'active',
            triggeredAt: new Date()
        });

        // Get Socket.io instance if available
        const io = req.app.get('io');
        
        // Send emergency alerts
        const notificationResults = await notificationService.sendEmergencyAlert(
            validContacts,
            user,
            location || 'Location not specified',
            coordinates,
            io
        );

        // Update emergency record with notification results
        emergencyRecord.notificationResults = notificationResults;
        emergencyRecord.contactsNotified = notificationResults.contactsNotified || notificationResults.length;
        await emergencyRecord.save();

        // Log emergency event with more details
        console.log(`🚨 EMERGENCY ALERT TRIGGERED:`);
        console.log(`   User: ${user.name} (${user.email})`);
        console.log(`   Time: ${new Date().toISOString()}`);
        console.log(`   Location: ${location || 'Not specified'}`);
        console.log(`   Coordinates: ${coordinates ? JSON.stringify(coordinates) : 'Not provided'}`);
        console.log(`   Emergency Contacts: ${validContacts.length}`);
        console.log(`   Contacts Notified: ${emergencyRecord.contactsNotified}`);
        console.log(`   Emergency ID: ${emergencyRecord._id}`);

        // Real-time broadcast to admin dashboard (if Socket.io is available)
        if (io) {
            io.emit('emergency_alert', {
                emergencyId: emergencyRecord._id,
                userName: user.name,
                userPhone: user.phone,
                location: location || 'Location not specified',
                coordinates: coordinates,
                timestamp: new Date(),
                status: 'active',
                contactsNotified: emergencyRecord.contactsNotified
            });
        }

        res.status(200).json({
            success: true,
            message: 'SOS alert sent to emergency contacts and logged',
            emergencyId: emergencyRecord._id,
            data: {
                contactsNotified: emergencyRecord.contactsNotified,
                notificationMethod: notificationResults.method,
                timestamp: emergencyRecord.triggeredAt,
                location: emergencyRecord.location
            }
        });

    } catch (error) {
        console.error('SOS error:', error);
        
        // Log detailed error for debugging
        console.error('Emergency trigger failed for user:', req.user.id);
        console.error('Error details:', error.stack);

        res.status(500).json({
            success: false,
            message: 'Error triggering SOS emergency',
            error: process.env.NODE_ENV === 'production' ? 'Server error' : error.message
        });
    }
};

// @desc    Get user's emergency history
// @route   GET /api/emergency/history
// @access  Private
exports.getEmergencyHistory = async (req, res) => {
    try {
        const emergencies = await Emergency.find({ user: req.user.id })
            .sort({ triggeredAt: -1 })
            .select('-notificationResults') // Exclude detailed notification results
            .limit(20);

        res.status(200).json({
            success: true,
            count: emergencies.length,
            data: emergencies
        });
    } catch (error) {
        console.error('Get emergency history error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching emergency history',
            error: process.env.NODE_ENV === 'production' ? 'Server error' : error.message
        });
    }
};

// @desc    Resolve emergency
// @route   PUT /api/emergency/:id/resolve
// @access  Private
exports.resolveEmergency = async (req, res) => {
    try {
        const emergency = await Emergency.findOne({
            _id: req.params.id,
            user: req.user.id
        });

        if (!emergency) {
            return res.status(404).json({
                success: false,
                message: 'Emergency record not found'
            });
        }

        if (emergency.status === 'resolved') {
            return res.status(400).json({
                success: false,
                message: 'Emergency is already resolved'
            });
        }

        emergency.status = 'resolved';
        emergency.resolvedAt = new Date();
        await emergency.save();

        // Notify admin dashboard about resolution
        const io = req.app.get('io');
        if (io) {
            io.emit('emergency_resolved', {
                emergencyId: emergency._id,
                userName: req.user.name,
                resolvedAt: emergency.resolvedAt
            });
        }

        res.status(200).json({
            success: true,
            message: 'Emergency marked as resolved',
            data: emergency
        });

    } catch (error) {
        console.error('Resolve emergency error:', error);
        res.status(500).json({
            success: false,
            message: 'Error resolving emergency',
            error: process.env.NODE_ENV === 'production' ? 'Server error' : error.message
        });
    }
};

// @desc    Add emergency contact
// @route   POST /api/emergency/contacts
// @access  Private
exports.addEmergencyContact = async (req, res) => {
    try {
        const { name, phone, relationship, email } = req.body;

        if (!name || !phone) {
            return res.status(400).json({
                success: false,
                message: 'Name and phone are required for emergency contacts'
            });
        }

        const user = await User.findById(req.user.id);
        
        // Initialize emergencyContacts array if it doesn't exist
        if (!user.emergencyContacts) {
            user.emergencyContacts = [];
        }

        // Check if contact already exists
        const existingContact = user.emergencyContacts.find(
            contact => contact.phone === phone
        );

        if (existingContact) {
            return res.status(400).json({
                success: false,
                message: 'Emergency contact with this phone number already exists'
            });
        }

        // Add new contact
        user.emergencyContacts.push({
            name: name.trim(),
            phone: phone.trim(),
            relationship: relationship?.trim(),
            email: email?.trim()
        });

        await user.save();

        res.status(201).json({
            success: true,
            message: 'Emergency contact added successfully',
            data: user.emergencyContacts
        });

    } catch (error) {
        console.error('Add emergency contact error:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding emergency contact',
            error: process.env.NODE_ENV === 'production' ? 'Server error' : error.message
        });
    }
};

// @desc    Remove emergency contact
// @route   DELETE /api/emergency/contacts/:contactId
// @access  Private
exports.removeEmergencyContact = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        
        if (!user.emergencyContacts || user.emergencyContacts.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No emergency contacts found'
            });
        }

        // Filter out the contact to remove
        const initialLength = user.emergencyContacts.length;
        user.emergencyContacts = user.emergencyContacts.filter(
            contact => contact._id.toString() !== req.params.contactId
        );

        if (user.emergencyContacts.length === initialLength) {
            return res.status(404).json({
                success: false,
                message: 'Emergency contact not found'
            });
        }

        await user.save();

        res.status(200).json({
            success: true,
            message: 'Emergency contact removed successfully',
            data: user.emergencyContacts
        });

    } catch (error) {
        console.error('Remove emergency contact error:', error);
        res.status(500).json({
            success: false,
            message: 'Error removing emergency contact',
            error: process.env.NODE_ENV === 'production' ? 'Server error' : error.message
        });
    }
};