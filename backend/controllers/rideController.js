const Ride = require('../models/Ride');
const Booking = require('../models/Booking');
const User = require('../models/User');
const mapsService = require('../utils/maps');
const notificationService = require('../utils/notification');

// ENHANCED FUZZY MATCHING FUNCTION - SIMPLIFIED AND IMPROVED
const enhancedFuzzyMatch = (searchText, rideText) => {
    if (!searchText || !rideText) return false;
    
    const searchNorm = searchText.toLowerCase().trim().replace(/\s+/g, ' ');
    const rideNorm = rideText.toLowerCase().trim().replace(/\s+/g, ' ');
    
    console.log(`🔍 Matching: "${searchNorm}" with "${rideNorm}"`);
    
    // Exact match
    if (searchNorm === rideNorm) {
        console.log('✅ Exact match');
        return true;
    }
    
    // Contains match (more lenient)
    if (rideNorm.includes(searchNorm) || searchNorm.includes(rideNorm)) {
        console.log('✅ Contains match');
        return true;
    }
    
    // Split into words and remove very short words
    const searchWords = searchNorm.split(/\s+/).filter(word => word.length >= 2);
    const rideWords = rideNorm.split(/\s+/).filter(word => word.length >= 2);
    
    console.log(`📝 Search words: [${searchWords.join(', ')}]`);
    console.log(`📝 Ride words: [${rideWords.join(', ')}]`);
    
    // If no meaningful words, return false
    if (searchWords.length === 0 || rideWords.length === 0) {
        console.log('❌ No meaningful words to compare');
        return false;
    }
    
    // Check if any search word is contained in any ride word (and vice versa)
    let matchingWords = 0;
    
    searchWords.forEach(searchWord => {
        const foundMatch = rideWords.some(rideWord => {
            const match = rideWord.includes(searchWord) || searchWord.includes(rideWord);
            if (match) {
                console.log(`✅ Word match: "${searchWord}" <-> "${rideWord}"`);
            }
            return match;
        });
        
        if (foundMatch) {
            matchingWords++;
        }
    });
    
    // Consider it a match if at least one word matches
    const isMatch = matchingWords > 0;
    console.log(`📊 Word matching: ${matchingWords}/${searchWords.length} words matched = ${isMatch}`);
    
    return isMatch;
};

// Helper function for fuzzy location matching - SIMPLIFIED
const fuzzyLocationMatch = (rides, searchFrom, searchTo) => {
    const searchFromLower = searchFrom.toLowerCase().trim();
    const searchToLower = searchTo.toLowerCase().trim();
    
    console.log('\n=== FUZZY MATCHING DETAILS ===');
    console.log('Searching for:', { searchFromLower, searchToLower });
    
    return rides.filter(ride => {
        const rideFrom = ride.from.address.toLowerCase();
        const rideTo = ride.to.address.toLowerCase();
        
        console.log(`\nChecking ride: "${rideFrom}" -> "${rideTo}"`);
        
        const fromMatch = enhancedFuzzyMatch(searchFromLower, rideFrom);
        const toMatch = enhancedFuzzyMatch(searchToLower, rideTo);
        
        console.log(`📍 From match: ${fromMatch}`);
        console.log(`📍 To match: ${toMatch}`);
        console.log(`✅ Final result: ${fromMatch && toMatch}`);
        
        return fromMatch && toMatch;
    });
};

// Helper function to calculate match score
const calculateMatchScore = (ride, searchFrom, searchTo) => {
    let score = 0;
    const rideFrom = ride.from.address.toLowerCase();
    const rideTo = ride.to.address.toLowerCase();
    const searchFromLower = searchFrom.toLowerCase();
    const searchToLower = searchTo.toLowerCase();
    
    // Exact match bonus
    if (rideFrom === searchFromLower) score += 50;
    if (rideTo === searchToLower) score += 50;
    
    // Contains match
    if (rideFrom.includes(searchFromLower)) score += 30;
    if (rideTo.includes(searchToLower)) score += 30;
    
    // Fuzzy match
    if (enhancedFuzzyMatch(searchFromLower, rideFrom)) score += 20;
    if (enhancedFuzzyMatch(searchToLower, rideTo)) score += 20;
    
    // Date proximity bonus (closer dates get higher score)
    const today = new Date();
    const rideDate = new Date(ride.date);
    const daysDiff = Math.abs((rideDate - today) / (1000 * 60 * 60 * 24));
    if (daysDiff <= 1) score += 20;
    else if (daysDiff <= 3) score += 10;
    
    return score;
};

// @desc    Create a new ride
// @route   POST /api/rides
// @access  Private
const createRide = async (req, res) => {
    try {
        console.log('=== CREATE RIDE REQUEST RECEIVED ===');
        console.log('User:', req.user.id);
        console.log('Request body:', req.body);

        const {
            from,
            to,
            date,
            departureTime,
            availableSeats,
            pricePerSeat,
            vehicleType,
            vehicleNumber,
            amenities,
            additionalNotes
        } = req.body;

        // Validate required fields with better error handling
        if (!from) {
            return res.status(400).json({
                success: false,
                message: 'Please provide "from" location'
            });
        }
        if (!to) {
            return res.status(400).json({
                success: false,
                message: 'Please provide "to" location'
            });
        }
        if (!date) {
            return res.status(400).json({
                success: false,
                message: 'Please provide "date"'
            });
        }
        if (!departureTime) {
            return res.status(400).json({
                success: false,
                message: 'Please provide "departureTime"'
            });
        }
        if (!availableSeats && availableSeats !== 0) {
            return res.status(400).json({
                success: false,
                message: 'Please provide "availableSeats"'
            });
        }
        if (!pricePerSeat && pricePerSeat !== 0) {
            return res.status(400).json({
                success: false,
                message: 'Please provide "pricePerSeat"'
            });
        }
        if (!vehicleType) {
            return res.status(400).json({
                success: false,
                message: 'Please provide "vehicleType"'
            });
        }

        // Extract address from from/to objects if they are objects
        let fromAddress, toAddress;
        
        if (typeof from === 'object' && from !== null) {
            fromAddress = from.address || from.name || JSON.stringify(from);
            console.log('From is object, extracted address:', fromAddress);
        } else {
            fromAddress = from.toString().trim();
        }
        
        if (typeof to === 'object' && to !== null) {
            toAddress = to.address || to.name || JSON.stringify(to);
            console.log('To is object, extracted address:', toAddress);
        } else {
            toAddress = to.toString().trim();
        }

        // Parse date properly
        let rideDate;
        try {
            rideDate = new Date(date);
            if (isNaN(rideDate.getTime())) {
                console.log('Invalid date format, trying alternative parsing');
                if (date.includes('/')) {
                    const parts = date.split('/');
                    if (parts.length === 3) {
                        const month = parts[0].padStart(2, '0');
                        const day = parts[1].padStart(2, '0');
                        const year = parts[2];
                        rideDate = new Date(`${year}-${month}-${day}`);
                        
                        if (isNaN(rideDate.getTime())) {
                            rideDate = new Date(`${year}-${day}-${month}`);
                        }
                    }
                }
            }
            
            if (isNaN(rideDate.getTime())) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid date format. Please use YYYY-MM-DD, MM/DD/YYYY, or DD/MM/YYYY format'
                });
            }
        } catch (dateError) {
            console.error('Date parsing error:', dateError);
            return res.status(400).json({
                success: false,
                message: 'Invalid date format'
            });
        }

        console.log('Parsed date:', rideDate);

        // Validate numeric fields
        const seats = parseInt(availableSeats);
        const price = parseFloat(pricePerSeat);

        if (isNaN(seats) || seats < 1 || seats > 10) {
            return res.status(400).json({
                success: false,
                message: 'Available seats must be a number between 1 and 10'
            });
        }

        if (isNaN(price) || price < 1 || price > 10000) {
            return res.status(400).json({
                success: false,
                message: 'Price per seat must be a number between 1 and 10000'
            });
        }

        // REMOVED: Verification check - users can now create rides without email verification
        // This allows immediate ride creation after registration

        // Simple coordinates for demo
        const fromGeocoded = {
            address: fromAddress,
            coordinates: { lat: 19.0760, lng: 72.8777 } // Mumbai coordinates
        };
        
        const toGeocoded = {
            address: toAddress,
            coordinates: { lat: 18.5204, lng: 73.8567 } // Pune coordinates
        };

        console.log('Final from/to addresses:', {
            from: fromGeocoded.address,
            to: toGeocoded.address
        });

        // Create ride with proper data types
        const rideData = {
            driver: req.user.id,
            from: fromGeocoded,
            to: toGeocoded,
            date: rideDate,
            departureTime: departureTime.toString().trim(),
            availableSeats: seats,
            pricePerSeat: price,
            vehicleType: vehicleType.toString().trim(),
            vehicleNumber: vehicleNumber ? vehicleNumber.toString().trim() : '',
            amenities: amenities || [],
            additionalNotes: additionalNotes || '',
            routePolyline: '',
            estimatedDuration: 180,
            estimatedDistance: 150,
            status: 'active'
        };

        console.log('Creating ride with data:', rideData);

        // Create ride
        const ride = await Ride.create(rideData);

        // Populate driver info
        await ride.populate('driver', 'name email phone avatar rating');

        console.log('✅ Ride created successfully:', ride._id);
        console.log('Ride details:', {
            from: ride.from.address,
            to: ride.to.address,
            date: ride.date,
            seats: ride.availableSeats,
            price: ride.pricePerSeat,
            status: ride.status
        });

        res.status(201).json({
            success: true,
            message: 'Ride created successfully',
            data: ride
        });

    } catch (error) {
        console.error('❌ Create ride error:', error);
        
        // Handle specific mongoose errors
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                error: messages.join(', ')
            });
        }

        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Duplicate field value entered'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Error creating ride',
            error: process.env.NODE_ENV === 'production' ? 'Server error' : error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

// @desc    Search for rides - IMPROVED MATCHING VERSION
// @route   GET /api/rides/search
// @access  Private
const searchRides = async (req, res) => {
    try {
        const { from, to, date, maxPrice, vehicleType, seats } = req.query;

        console.log('=== SEARCH RIDES REQUEST ===');
        console.log('Search parameters:', { from, to, date, maxPrice, vehicleType, seats });
        console.log('Search user:', req.user.id);

        if (!from || !to || !date) {
            return res.status(400).json({
                success: false,
                message: 'Please provide from, to, and date parameters'
            });
        }

        // FLEXIBLE DATE PARSING
        let searchDate;
        try {
            if (date.includes('/')) {
                const parts = date.split('/');
                if (parts.length === 3) {
                    const month = parts[0].padStart(2, '0');
                    const day = parts[1].padStart(2, '0');
                    const year = parts[2];
                    searchDate = new Date(`${year}-${month}-${day}`);
                }
            } else if (date.includes('-')) {
                searchDate = new Date(date);
            } else {
                searchDate = new Date(date);
            }
            
            if (isNaN(searchDate.getTime())) {
                console.log('Date parsing failed, using current date as fallback');
                searchDate = new Date();
            }
        } catch (dateError) {
            console.log('Date parsing error, using current date:', dateError);
            searchDate = new Date();
        }

        // Set date range for the entire day
        const startOfDay = new Date(searchDate);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(searchDate);
        endOfDay.setHours(23, 59, 59, 999);

        console.log('Search date range:', { 
            startOfDay: startOfDay.toISOString(), 
            endOfDay: endOfDay.toISOString(),
            searchDate: searchDate.toISOString()
        });

        // Build query
        let query = {
            status: 'active',
            date: {
                $gte: startOfDay,
                $lte: endOfDay
            },
            driver: { $ne: req.user.id },
            availableSeats: { $gte: 1 }
        };

        // Additional filters
        if (maxPrice && !isNaN(maxPrice)) {
            query.pricePerSeat = { $lte: parseFloat(maxPrice) };
        }
        if (vehicleType && vehicleType !== 'any') {
            query.vehicleType = vehicleType;
        }
        if (seats && !isNaN(seats)) {
            query.availableSeats = { $gte: parseInt(seats) };
        }

        console.log('Final query:', JSON.stringify(query, null, 2));

        // Find rides
        const rides = await Ride.find(query)
            .populate('driver', 'name phone avatar rating reviewCount')
            .sort({ date: 1, departureTime: 1 });

        console.log(`\n=== INITIAL SEARCH RESULTS ===`);
        console.log(`Found ${rides.length} rides for the date ${date}`);
        
        // Log each ride for debugging
        rides.forEach(ride => {
            console.log('Ride:', {
                from: ride.from.address,
                to: ride.to.address,
                date: ride.date,
                availableSeats: ride.availableSeats,
                status: ride.status
            });
        });

        // IMPROVED FUZZY MATCHING
        console.log('\n=== IMPROVED FUZZY MATCHING ===');
        console.log('Search parameters:', { from, to });

        const matchedRides = rides.filter(ride => {
            console.log(`\n🔍 Matching ride: "${ride.from.address}" -> "${ride.to.address}"`);
            
            const fromMatch = enhancedFuzzyMatch(from, ride.from.address);
            const toMatch = enhancedFuzzyMatch(to, ride.to.address);
            
            console.log(`📍 From match: ${fromMatch}`);
            console.log(`📍 To match: ${toMatch}`);
            console.log(`✅ Final match: ${fromMatch && toMatch}`);
            
            return fromMatch && toMatch;
        });

        console.log(`🎯 Found ${matchedRides.length} matching rides after enhanced fuzzy matching`);

        // If no matches found, try even more flexible matching
        let finalResults = matchedRides;
        if (matchedRides.length === 0) {
            console.log('No matches found, trying ultra-flexible matching...');
            finalResults = fuzzyLocationMatch(rides, from, to);
            console.log(`🔄 Found ${finalResults.length} rides with ultra-flexible matching`);
        }

        // Add match information to results
        const enhancedResults = finalResults.map(ride => {
            const matchScore = calculateMatchScore(ride, from, to);
            
            return {
                ...ride.toObject(),
                matchScore,
                matchInfo: {
                    fromMatch: enhancedFuzzyMatch(from, ride.from.address),
                    toMatch: enhancedFuzzyMatch(to, ride.to.address),
                    searchFrom: from,
                    searchTo: to,
                    rideFrom: ride.from.address,
                    rideTo: ride.to.address,
                    matchScore: matchScore
                }
            };
        });

        // Sort by match score (highest first)
        enhancedResults.sort((a, b) => b.matchScore - a.matchScore);

        console.log(`\n📊 FINAL RESULTS: ${enhancedResults.length} rides`);
        enhancedResults.forEach((ride, index) => {
            console.log(`${index + 1}. ${ride.from.address} -> ${ride.to.address} | Score: ${ride.matchScore}`);
        });

        res.status(200).json({
            success: true,
            count: enhancedResults.length,
            data: enhancedResults,
            searchInfo: {
                from,
                to,
                date: searchDate.toISOString().split('T')[0],
                totalRidesFound: rides.length,
                matchedRides: enhancedResults.length
            }
        });
    } catch (error) {
        console.error('Search rides error:', error);
        res.status(500).json({
            success: false,
            message: 'Error searching rides',
            error: process.env.NODE_ENV === 'production' ? 'Server error' : error.message
        });
    }
};

// @desc    Get all rides (for debugging)
// @route   GET /api/rides/debug/all
// @access  Private
const getAllRides = async (req, res) => {
    try {
        const rides = await Ride.find()
            .populate('driver', 'name email phone avatar rating')
            .sort({ createdAt: -1 });

        console.log('Total rides in database:', rides.length);
        rides.forEach(ride => {
            console.log(`Ride ${ride._id}:`, {
                from: ride.from.address,
                to: ride.to.address,
                date: ride.date,
                status: ride.status,
                seats: ride.availableSeats,
                driver: ride.driver.name
            });
        });
        
        res.status(200).json({
            success: true,
            count: rides.length,
            data: rides
        });
    } catch (error) {
        console.error('Get all rides error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching rides',
            error: error.message
        });
    }
};

// @desc    Debug - Get all rides with details
// @route   GET /api/rides/debug/details
// @access  Private
const getRideDetails = async (req, res) => {
    try {
        const rides = await Ride.find()
            .populate('driver', 'name email')
            .sort({ createdAt: -1 });

        const rideDetails = rides.map(ride => ({
            id: ride._id,
            from: ride.from.address,
            to: ride.to.address,
            date: ride.date,
            departureTime: ride.departureTime,
            availableSeats: ride.availableSeats,
            status: ride.status,
            driver: ride.driver.name,
            createdAt: ride.createdAt
        }));

        console.log('=== ALL RIDES IN DATABASE ===');
        console.log(`Total rides: ${rides.length}`);
        rideDetails.forEach(ride => {
            console.log(`Ride: ${ride.from} -> ${ride.to} | Date: ${ride.date} | Seats: ${ride.availableSeats} | Status: ${ride.status}`);
        });

        res.status(200).json({
            success: true,
            count: rides.length,
            data: rideDetails
        });
    } catch (error) {
        console.error('Get ride details error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching ride details',
            error: error.message
        });
    }
};

// @desc    Debug search - returns all rides without location filtering
// @route   GET /api/rides/search-debug
// @access  Private
const searchRidesDebug = async (req, res) => {
    try {
        const { from, to, date } = req.query;

        console.log('=== DEBUG SEARCH ===');
        console.log('Parameters:', { from, to, date });

        const searchDate = new Date(date);
        const startOfDay = new Date(searchDate);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(searchDate);
        endOfDay.setHours(23, 59, 59, 999);

        const rides = await Ride.find({
            status: 'active',
            date: { $gte: startOfDay, $lte: endOfDay },
            driver: { $ne: req.user.id },
            availableSeats: { $gte: 1 }
        })
        .populate('driver', 'name phone avatar rating reviewCount')
        .sort({ date: 1, departureTime: 1 });

        console.log(`Returning ${rides.length} rides (debug mode)`);

        res.status(200).json({
            success: true,
            count: rides.length,
            data: rides,
            debug: 'Location matching disabled - showing all active rides for date'
        });
    } catch (error) {
        console.error('Debug search error:', error);
        res.status(500).json({
            success: false,
            message: 'Error in debug search',
            error: error.message
        });
    }
};

// @desc    Test search - returns ALL active rides regardless of date/location
// @route   GET /api/rides/search-test
// @access  Private
const searchRidesTest = async (req, res) => {
    try {
        console.log('=== TEST SEARCH - RETURNING ALL ACTIVE RIDES ===');

        const rides = await Ride.find({
            status: 'active',
            driver: { $ne: req.user.id },
            availableSeats: { $gte: 1 }
        })
        .populate('driver', 'name phone avatar rating reviewCount')
        .sort({ date: 1, departureTime: 1 });

        console.log(`Returning ${rides.length} active rides (test mode)`);

        res.status(200).json({
            success: true,
            count: rides.length,
            data: rides,
            debug: 'TEST MODE - showing all active rides regardless of date/location'
        });
    } catch (error) {
        console.error('Test search error:', error);
        res.status(500).json({
            success: false,
            message: 'Error in test search',
            error: error.message
        });
    }
};

// @desc    Book a ride - FIXED VERSION
// @route   POST /api/rides/:rideId/book
// @access  Private
const bookRide = async (req, res) => {
    try {
        const { seats, pickupPoint } = req.body;
        const rideId = req.params.rideId;

        console.log('🎫 === BOOK RIDE REQUEST ===');
        console.log('Booking details:', {
            rideId,
            seats,
            pickupPoint,
            passenger: req.user.id
        });

        // Validate required fields
        if (!seats || seats < 1) {
            return res.status(400).json({
                success: false,
                message: 'Please provide valid number of seats (minimum 1)'
            });
        }

        if (!pickupPoint) {
            return res.status(400).json({
                success: false,
                message: 'Please provide pickup point'
            });
        }

        // Find ride with driver info
        const ride = await Ride.findById(rideId)
            .populate('driver', 'name phone');

        if (!ride) {
            return res.status(404).json({
                success: false,
                message: 'Ride not found'
            });
        }

        console.log('📋 Ride details:', {
            availableSeats: ride.availableSeats,
            requestedSeats: seats,
            status: ride.status
        });

        // Check ride status
        if (ride.status !== 'active') {
            return res.status(400).json({
                success: false,
                message: `Cannot book this ride. Ride is ${ride.status}`
            });
        }

        // Check availability
        if (ride.availableSeats < parseInt(seats)) {
            return res.status(400).json({
                success: false,
                message: `Not enough seats available. Only ${ride.availableSeats} seat(s) left.`
            });
        }

        // Check if user is trying to book their own ride
        if (ride.driver._id.toString() === req.user.id) {
            return res.status(400).json({
                success: false,
                message: 'Cannot book your own ride'
            });
        }

        // Check if user already has a booking for this ride
        const existingBooking = await Booking.findOne({
            ride: rideId,
            passenger: req.user.id,
            status: { $in: ['confirmed', 'pending'] }
        });

        if (existingBooking) {
            return res.status(400).json({
                success: false,
                message: 'You already have a booking for this ride'
            });
        }

        // Calculate total price
        const totalPrice = parseInt(seats) * ride.pricePerSeat;

        // Create booking
        const bookingData = {
            ride: rideId,
            passenger: req.user.id,
            seatsBooked: parseInt(seats),
            totalPrice: totalPrice,
            pickupPoint: pickupPoint,
            status: 'confirmed',
            bookingDate: new Date()
        };

        const booking = await Booking.create(bookingData);

        // Update ride available seats and add passenger
        ride.availableSeats -= parseInt(seats);
        
        // Ensure passengers array exists
        if (!ride.passengers) {
            ride.passengers = [];
        }
        
        ride.passengers.push({
            user: req.user.id,
            pickupPoint: pickupPoint,
            seats: parseInt(seats),
            booking: booking._id
        });

        // Update ride status if full
        if (ride.availableSeats === 0) {
            ride.status = 'full';
        }

        await ride.save();

        // Populate data for response
        await booking.populate('passenger', 'name phone email avatar');
        await booking.populate('ride');
        await booking.populate('ride.driver', 'name phone avatar rating');

        console.log('✅ Booking created successfully:', {
            bookingId: booking._id,
            ride: booking.ride._id,
            passenger: booking.passenger.name,
            seats: booking.seatsBooked,
            totalPrice: booking.totalPrice
        });

        res.status(200).json({
            success: true,
            message: 'Ride booked successfully',
            data: booking,
            bookingSummary: {
                rideFrom: ride.from.address,
                rideTo: ride.to.address,
                rideDate: ride.date,
                departureTime: ride.departureTime,
                seatsBooked: seats,
                totalPrice: totalPrice,
                driverName: ride.driver.name,
                driverPhone: ride.driver.phone
            }
        });

    } catch (error) {
        console.error('❌ Book ride error:', error);
        res.status(500).json({
            success: false,
            message: 'Error booking ride',
            error: process.env.NODE_ENV === 'production' ? 'Server error' : error.message
        });
    }
};

// @desc    Get user's offered rides
// @route   GET /api/rides/my-rides
// @access  Private
const getMyRides = async (req, res) => {
    try {
        const rides = await Ride.find({ driver: req.user.id })
            .populate('passengers.user', 'name phone avatar')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: rides.length,
            data: rides
        });
    } catch (error) {
        console.error('Get my rides error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching rides',
            error: error.message
        });
    }
};

// @desc    Get user's bookings
// @route   GET /api/rides/my-bookings
// @access  Private
const getMyBookings = async (req, res) => {
    try {
        const bookings = await Booking.find({ passenger: req.user.id })
            .populate('ride')
            .populate('ride.driver', 'name phone avatar rating')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: bookings.length,
            data: bookings
        });
    } catch (error) {
        console.error('Get my bookings error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching bookings',
            error: error.message
        });
    }
};

// @desc    Cancel a ride
// @route   PUT /api/rides/:rideId/cancel
// @access  Private
const cancelRide = async (req, res) => {
    try {
        const ride = await Ride.findById(req.params.rideId);

        if (!ride) {
            return res.status(404).json({
                success: false,
                message: 'Ride not found'
            });
        }

        // Check if user is the driver
        if (ride.driver.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to cancel this ride'
            });
        }

        // Update all related bookings to cancelled
        await Booking.updateMany(
            { ride: ride._id, status: 'confirmed' },
            { status: 'cancelled' }
        );

        ride.status = 'cancelled';
        await ride.save();

        res.status(200).json({
            success: true,
            message: 'Ride cancelled successfully',
            data: ride
        });
    } catch (error) {
        console.error('Cancel ride error:', error);
        res.status(500).json({
            success: false,
            message: 'Error cancelling ride',
            error: error.message
        });
    }
};

// @desc    Get ride by ID
// @route   GET /api/rides/:rideId
// @access  Private
const getRideById = async (req, res) => {
    try {
        const ride = await Ride.findById(req.params.rideId)
            .populate('driver', 'name phone avatar rating reviewCount')
            .populate('passengers.user', 'name phone avatar rating');

        if (!ride) {
            return res.status(404).json({
                success: false,
                message: 'Ride not found'
            });
        }

        res.status(200).json({
            success: true,
            data: ride
        });
    } catch (error) {
        console.error('Get ride by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching ride',
            error: error.message
        });
    }
};

// @desc    Update ride status
// @route   PUT /api/rides/:rideId/status
// @access  Private
const updateRideStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const rideId = req.params.rideId;

        if (!['active', 'completed', 'cancelled'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status'
            });
        }

        const ride = await Ride.findById(rideId);

        if (!ride) {
            return res.status(404).json({
                success: false,
                message: 'Ride not found'
            });
        }

        // Check if user is the driver
        if (ride.driver.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to update this ride'
            });
        }

        // If marking as completed, update related bookings
        if (status === 'completed') {
            await Booking.updateMany(
                { ride: rideId, status: 'confirmed' },
                { status: 'completed' }
            );
        }

        ride.status = status;
        await ride.save();

        res.status(200).json({
            success: true,
            message: `Ride status updated to ${status}`,
            data: ride
        });
    } catch (error) {
        console.error('Update ride status error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating ride status',
            error: error.message
        });
    }
};

// @desc    Cancel booking
// @route   PUT /api/rides/bookings/:bookingId/cancel
// @access  Private
const cancelBooking = async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.bookingId)
            .populate('ride');

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Check if user is the passenger
        if (booking.passenger.toString() !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to cancel this booking'
            });
        }

        // Update booking status
        booking.status = 'cancelled';
        await booking.save();

        // Update ride available seats
        const ride = await Ride.findById(booking.ride._id);
        ride.availableSeats += booking.seatsBooked;
        
        // Remove passenger from ride
        ride.passengers = ride.passengers.filter(
            p => p.user.toString() !== req.user.id
        );

        if (ride.status === 'full') {
            ride.status = 'active';
        }

        await ride.save();

        res.status(200).json({
            success: true,
            message: 'Booking cancelled successfully',
            data: booking
        });
    } catch (error) {
        console.error('Cancel booking error:', error);
        res.status(500).json({
            success: false,
            message: 'Error cancelling booking',
            error: error.message
        });
    }
};

// @desc    Get available seats for a ride
// @route   GET /api/rides/:rideId/seats
// @access  Private
const getAvailableSeats = async (req, res) => {
    try {
        const ride = await Ride.findById(req.params.rideId);

        if (!ride) {
            return res.status(404).json({
                success: false,
                message: 'Ride not found'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                availableSeats: ride.availableSeats,
                totalSeats: ride.availableSeats + (ride.passengers?.length || 0)
            }
        });
    } catch (error) {
        console.error('Get available seats error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching available seats',
            error: error.message
        });
    }
};

// @desc    Get ride statistics
// @route   GET /api/rides/stats
// @access  Private
const getRideStats = async (req, res) => {
    try {
        const userRides = await Ride.countDocuments({ driver: req.user.id });
        const userBookings = await Booking.countDocuments({ passenger: req.user.id });
        const completedRides = await Ride.countDocuments({ 
            driver: req.user.id, 
            status: 'completed' 
        });

        res.status(200).json({
            success: true,
            data: {
                ridesOffered: userRides,
                ridesTaken: userBookings,
                completedRides: completedRides
            }
        });
    } catch (error) {
        console.error('Get ride stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching ride statistics',
            error: error.message
        });
    }
};

// Export all functions
module.exports = {
    createRide,
    searchRides,
    searchRidesDebug,
    searchRidesTest,
    getAllRides,
    getRideDetails,
    bookRide,
    getMyRides,
    getMyBookings,
    cancelRide,
    getRideById,
    updateRideStatus,
    cancelBooking,
    getAvailableSeats,
    getRideStats,
    enhancedFuzzyMatch,
    fuzzyLocationMatch,
    calculateMatchScore
};