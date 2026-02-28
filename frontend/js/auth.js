// Authentication functions
class Auth {
    constructor() {
        this.token = localStorage.getItem('rideshare_token');
        this.user = JSON.parse(localStorage.getItem('rideshare_user') || 'null');
        this.apiBase = 'http://localhost:5000/api';
    }

    // Set authentication data
    setAuth(token, user) {
        this.token = token;
        this.user = user;
        localStorage.setItem('rideshare_token', token);
        localStorage.setItem('rideshare_user', JSON.stringify(user));
    }

    // Clear authentication data
    clearAuth() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('rideshare_token');
        localStorage.removeItem('rideshare_user');
    }

    // Check if user is authenticated
    isAuthenticated() {
        return !!this.token && !!this.user;
    }

    // Get auth headers for API calls
    getAuthHeaders() {
        return {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
        };
    }

    // API request helper
    async apiRequest(url, options = {}) {
        try {
            const response = await fetch(`${this.apiBase}${url}`, {
                headers: this.getAuthHeaders(),
                ...options
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'API request failed');
            }

            return data;
        } catch (error) {
            console.error('API request error:', error);
            throw error;
        }
    }

    // Register user
    async register(userData) {
        try {
            const response = await fetch(`${this.apiBase}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Registration failed');
            }

            if (data.success) {
                this.setAuth(data.token, data.user);
            }

            return data;
        } catch (error) {
            console.error('Registration error:', error);
            throw error;
        }
    }

    // Login user
    async login(email, password) {
        try {
            const response = await fetch(`${this.apiBase}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Login failed');
            }

            if (data.success) {
                this.setAuth(data.token, data.user);
            }

            return data;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    // Get current user
    async getCurrentUser() {
        if (!this.isAuthenticated()) {
            return null;
        }

        try {
            const data = await this.apiRequest('/auth/me');
            if (data.success) {
                this.user = data.user;
                localStorage.setItem('rideshare_user', JSON.stringify(data.user));
            }
            return data.user;
        } catch (error) {
            console.error('Get user error:', error);
            this.clearAuth();
            return null;
        }
    }

    // Update profile
    async updateProfile(profileData) {
        try {
            const data = await this.apiRequest('/auth/profile', {
                method: 'PUT',
                body: JSON.stringify(profileData)
            });

            if (data.success) {
                this.user = data.user;
                localStorage.setItem('rideshare_user', JSON.stringify(data.user));
            }

            return data;
        } catch (error) {
            console.error('Update profile error:', error);
            throw error;
        }
    }

    // Logout
    logout() {
        this.clearAuth();
        showNotification('Logged out successfully', 'info');
    }
}

// Create global auth instance
const auth = new Auth();