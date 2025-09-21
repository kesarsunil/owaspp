import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

class BookingService {
  constructor() {
    this.apiClient = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000, // 30 seconds timeout
    });
  }

  // Get all statements
  async getStatements() {
    try {
      const response = await this.apiClient.get('/statements');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Book a statement
  async bookStatement(statementId, userId, userDetails = {}) {
    try {
      const response = await this.apiClient.post('/book', {
        statementId,
        userId,
        userDetails: {
          ...userDetails,
          timestamp: Date.now(),
          browser: navigator.userAgent
        }
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Check booking status
  async checkBookingStatus(queueId) {
    try {
      const response = await this.apiClient.get(`/booking-status/${queueId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Get queue status
  async getQueueStatus() {
    try {
      const response = await this.apiClient.get('/queue-status');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Reset all bookings
  async resetBookings() {
    try {
      const response = await this.apiClient.post('/reset');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Health check
  async healthCheck() {
    try {
      const response = await this.apiClient.get('/health');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Simulate simultaneous bookings for testing
  async simulateSimultaneousBookings(statementId, numberOfUsers = 5) {
    const users = Array.from({ length: numberOfUsers }, (_, i) => ({
      userId: `test_user_${i + 1}_${Date.now()}`,
      userDetails: { simulationId: Date.now(), userIndex: i + 1 }
    }));

    console.log(`🧪 Simulating ${numberOfUsers} simultaneous bookings for statement ${statementId}`);

    // Create promises for simultaneous requests
    const bookingPromises = users.map(user => 
      this.bookStatement(statementId, user.userId, user.userDetails)
    );

    try {
      // Execute all requests simultaneously
      const results = await Promise.allSettled(bookingPromises);
      
      console.log('📊 Simulation results:');
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          console.log(`User ${index + 1}: ${result.value.message} (Queue ID: ${result.value.queueId})`);
        } else {
          console.log(`User ${index + 1}: ERROR - ${result.reason.message}`);
        }
      });

      return results;
    } catch (error) {
      console.error('Simulation error:', error);
      throw error;
    }
  }

  // Handle API errors
  handleError(error) {
    if (error.response) {
      // Server responded with error status
      return new Error(error.response.data.message || 'Server error');
    } else if (error.request) {
      // Request was made but no response received
      return new Error('No response from server. Please check if backend is running.');
    } else {
      // Something else happened
      return new Error(error.message || 'Unknown error occurred');
    }
  }

  // Generate unique user ID
  generateUserId() {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Format timestamp for display
  formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleString();
  }
}

// Export singleton instance
const bookingService = new BookingService();
export default bookingService;