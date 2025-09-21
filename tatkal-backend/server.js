const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.json());

// In-memory data structures (in production, use Redis or database)
const statements = new Map();
const bookingQueue = [];
const activeBookings = new Map();
let isProcessingQueue = false;

// Initialize sample statements with slot limits
const initializeStatements = () => {
  const sampleStatements = [
    { id: 'ps1', title: 'Smart Traffic Management System', totalSlots: 3, bookedSlots: 0 },
    { id: 'ps2', title: 'Sustainable Energy Monitor', totalSlots: 3, bookedSlots: 0 },
    { id: 'ps3', title: 'Healthcare Data Analytics', totalSlots: 3, bookedSlots: 0 },
    { id: 'ps4', title: 'Agricultural Automation', totalSlots: 3, bookedSlots: 0 },
    { id: 'ps5', title: 'Financial Fraud Detection', totalSlots: 3, bookedSlots: 0 },
    { id: 'ps6', title: 'Educational Learning Assistant', totalSlots: 3, bookedSlots: 0 }
  ];
  
  sampleStatements.forEach(statement => {
    statements.set(statement.id, statement);
  });
  
  console.log('✅ Initialized statements with slot limits');
};

// Tatkal-style booking queue processor
class BookingQueueProcessor {
  constructor() {
    this.processingInterval = null;
    this.queueProcessingDelay = 100; // 100ms delay between processing requests
  }

  // Add booking request to queue with precise timestamp
  addToQueue(bookingRequest) {
    const queueItem = {
      id: uuidv4(),
      timestamp: Date.now() + performance.now(), // High precision timestamp
      statementId: bookingRequest.statementId,
      userId: bookingRequest.userId,
      userDetails: bookingRequest.userDetails,
      status: 'queued'
    };
    
    // Insert in sorted order by timestamp (FCFS)
    this.insertSorted(bookingQueue, queueItem);
    
    console.log(`📋 Added to queue: ${queueItem.id} for statement ${queueItem.statementId} at ${queueItem.timestamp}`);
    
    // Start processing if not already running
    if (!isProcessingQueue) {
      this.startProcessing();
    }
    
    return queueItem.id;
  }

  // Insert booking request in sorted order by timestamp
  insertSorted(queue, item) {
    let left = 0;
    let right = queue.length;
    
    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (queue[mid].timestamp <= item.timestamp) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }
    
    queue.splice(left, 0, item);
  }

  // Start queue processing
  startProcessing() {
    if (isProcessingQueue) return;
    
    isProcessingQueue = true;
    console.log('🚀 Starting queue processing...');
    
    this.processingInterval = setInterval(() => {
      this.processNextRequest();
    }, this.queueProcessingDelay);
  }

  // Stop queue processing
  stopProcessing() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    isProcessingQueue = false;
    console.log('⏹️ Queue processing stopped');
  }

  // Process next request in queue (FCFS)
  processNextRequest() {
    if (bookingQueue.length === 0) {
      this.stopProcessing();
      return;
    }

    const request = bookingQueue.shift(); // Get first item (FCFS)
    console.log(`⚡ Processing request: ${request.id} for statement ${request.statementId}`);
    
    // Update status to processing
    request.status = 'processing';
    
    // Attempt booking
    const result = this.attemptBooking(request);
    
    // Store result for frontend to retrieve
    activeBookings.set(request.id, {
      ...request,
      result: result,
      processedAt: Date.now()
    });
    
    console.log(`✅ Processed request ${request.id}: ${result.success ? 'SUCCESS' : 'FAILED'} - ${result.message}`);
  }

  // Attempt to book a slot
  attemptBooking(request) {
    const statement = statements.get(request.statementId);
    
    if (!statement) {
      return {
        success: false,
        message: 'Statement not found',
        statementId: request.statementId
      };
    }

    // Check slot availability
    if (statement.bookedSlots >= statement.totalSlots) {
      return {
        success: false,
        message: 'All slots are filled',
        statementId: request.statementId,
        availableSlots: 0,
        totalSlots: statement.totalSlots
      };
    }

    // Book the slot
    statement.bookedSlots += 1;
    statements.set(request.statementId, statement);

    return {
      success: true,
      message: 'Booking confirmed',
      statementId: request.statementId,
      availableSlots: statement.totalSlots - statement.bookedSlots,
      totalSlots: statement.totalSlots,
      bookedSlot: statement.bookedSlots
    };
  }

  // Get queue status
  getQueueStatus() {
    return {
      queueLength: bookingQueue.length,
      isProcessing: isProcessingQueue,
      statements: Array.from(statements.values())
    };
  }
}

// Initialize queue processor
const queueProcessor = new BookingQueueProcessor();

// API Routes

// Get all statements with availability
app.get('/api/statements', (req, res) => {
  const statementList = Array.from(statements.values()).map(statement => ({
    ...statement,
    availableSlots: statement.totalSlots - statement.bookedSlots,
    isAvailable: statement.bookedSlots < statement.totalSlots
  }));
  
  res.json({
    success: true,
    statements: statementList
  });
});

// Book a statement (add to queue)
app.post('/api/book', (req, res) => {
  const { statementId, userId, userDetails } = req.body;
  
  // Validation
  if (!statementId || !userId) {
    return res.status(400).json({
      success: false,
      message: 'Statement ID and User ID are required'
    });
  }

  const statement = statements.get(statementId);
  if (!statement) {
    return res.status(404).json({
      success: false,
      message: 'Statement not found'
    });
  }

  // Add to queue
  const queueId = queueProcessor.addToQueue({
    statementId,
    userId,
    userDetails: userDetails || {}
  });

  res.json({
    success: true,
    message: 'Booking request queued',
    queueId: queueId,
    status: 'queued'
  });
});

// Check booking status
app.get('/api/booking-status/:queueId', (req, res) => {
  const { queueId } = req.params;
  
  const booking = activeBookings.get(queueId);
  
  if (!booking) {
    // Check if still in queue
    const queueItem = bookingQueue.find(item => item.id === queueId);
    if (queueItem) {
      return res.json({
        success: true,
        status: 'queued',
        position: bookingQueue.indexOf(queueItem) + 1,
        message: 'Request is in queue'
      });
    }
    
    return res.status(404).json({
      success: false,
      message: 'Booking request not found'
    });
  }

  res.json({
    success: true,
    status: booking.result.success ? 'confirmed' : 'failed',
    result: booking.result,
    processedAt: booking.processedAt
  });
});

// Get queue status (for debugging)
app.get('/api/queue-status', (req, res) => {
  res.json(queueProcessor.getQueueStatus());
});

// Reset all bookings (for testing)
app.post('/api/reset', (req, res) => {
  // Clear all bookings
  statements.forEach(statement => {
    statement.bookedSlots = 0;
    statements.set(statement.id, statement);
  });
  
  // Clear queue and active bookings
  bookingQueue.length = 0;
  activeBookings.clear();
  queueProcessor.stopProcessing();
  
  res.json({
    success: true,
    message: 'All bookings reset'
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Tatkal booking system is running',
    timestamp: new Date().toISOString(),
    queueStatus: queueProcessor.getQueueStatus()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Tatkal Booking Server running on port ${PORT}`);
  console.log(`📋 Queue processing delay: ${queueProcessor.queueProcessingDelay}ms`);
  
  // Initialize statements
  initializeStatements();
  
  console.log('✅ Server ready to accept booking requests');
});

module.exports = app;