import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

// Configure axios defaults
axios.defaults.baseURL = API_BASE_URL;

const TatkalBookingSystem = () => {
  const [statements, setStatements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookingStates, setBookingStates] = useState({});
  const [userId] = useState(`user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  // Fetch statements on component mount
  useEffect(() => {
    fetchStatements();
    const interval = setInterval(fetchStatements, 2000); // Refresh every 2 seconds
    return () => clearInterval(interval);
  }, []);

  // Fetch all statements
  const fetchStatements = async () => {
    try {
      const response = await axios.get('/statements');
      setStatements(response.data.statements);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching statements:', error);
      setLoading(false);
    }
  };

  // Book a statement
  const handleBook = async (statementId) => {
    // Set booking state to processing
    setBookingStates(prev => ({
      ...prev,
      [statementId]: {
        status: 'processing',
        message: 'Processing/Checking for availability...',
        queueId: null
      }
    }));

    try {
      // Send booking request
      const response = await axios.post('/book', {
        statementId: statementId,
        userId: userId,
        userDetails: {
          timestamp: Date.now(),
          browser: navigator.userAgent
        }
      });

      if (response.data.success) {
        const queueId = response.data.queueId;
        
        // Update state with queue ID
        setBookingStates(prev => ({
          ...prev,
          [statementId]: {
            status: 'queued',
            message: 'Request queued, checking availability...',
            queueId: queueId
          }
        }));

        // Start polling for result
        pollBookingStatus(statementId, queueId);
      } else {
        setBookingStates(prev => ({
          ...prev,
          [statementId]: {
            status: 'failed',
            message: response.data.message,
            queueId: null
          }
        }));
      }
    } catch (error) {
      console.error('Booking error:', error);
      setBookingStates(prev => ({
        ...prev,
        [statementId]: {
          status: 'failed',
          message: 'Booking request failed. Please try again.',
          queueId: null
        }
      }));
    }
  };

  // Poll booking status
  const pollBookingStatus = useCallback(async (statementId, queueId) => {
    const maxPolls = 30; // Maximum 30 polls (30 seconds)
    let pollCount = 0;

    const poll = async () => {
      try {
        const response = await axios.get(`/booking-status/${queueId}`);
        
        if (response.data.success) {
          const { status, result, position } = response.data;
          
          if (status === 'queued') {
            // Still in queue
            setBookingStates(prev => ({
              ...prev,
              [statementId]: {
                status: 'queued',
                message: `In queue... Position: ${position || 'Processing'}`,
                queueId: queueId
              }
            }));
            
            // Continue polling
            pollCount++;
            if (pollCount < maxPolls) {
              setTimeout(poll, 1000); // Poll every second
            } else {
              // Timeout
              setBookingStates(prev => ({
                ...prev,
                [statementId]: {
                  status: 'timeout',
                  message: 'Request timeout. Please refresh and try again.',
                  queueId: null
                }
              }));
            }
          } else if (status === 'confirmed') {
            // Booking successful
            setBookingStates(prev => ({
              ...prev,
              [statementId]: {
                status: 'confirmed',
                message: `Booked successfully! Slot ${result.bookedSlot}/${result.totalSlots}`,
                queueId: null,
                result: result
              }
            }));
            
            // Refresh statements
            fetchStatements();
          } else if (status === 'failed') {
            // Booking failed
            setBookingStates(prev => ({
              ...prev,
              [statementId]: {
                status: 'unavailable',
                message: 'Unavailable - All slots are filled',
                queueId: null,
                result: result
              }
            }));
            
            // Refresh statements
            fetchStatements();
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
        setBookingStates(prev => ({
          ...prev,
          [statementId]: {
            status: 'error',
            message: 'Error checking booking status',
            queueId: null
          }
        }));
      }
    };

    // Start polling
    poll();
  }, []);

  // Reset all bookings (for testing)
  const handleReset = async () => {
    try {
      await axios.post('/reset');
      setBookingStates({});
      fetchStatements();
      alert('All bookings reset successfully!');
    } catch (error) {
      console.error('Reset error:', error);
      alert('Failed to reset bookings');
    }
  };

  // Get button text and style based on booking state
  const getButtonConfig = (statement) => {
    const bookingState = bookingStates[statement.id];
    
    if (!bookingState) {
      // No booking state - check availability
      if (statement.availableSlots <= 0) {
        return {
          text: 'FILLED',
          className: 'btn btn-danger',
          disabled: true
        };
      }
      return {
        text: 'Book',
        className: 'btn btn-primary',
        disabled: false
      };
    }

    switch (bookingState.status) {
      case 'processing':
        return {
          text: 'Processing...',
          className: 'btn btn-warning',
          disabled: true
        };
      case 'queued':
        return {
          text: 'Checking...',
          className: 'btn btn-info',
          disabled: true
        };
      case 'confirmed':
        return {
          text: 'Booked ✓',
          className: 'btn btn-success',
          disabled: true
        };
      case 'unavailable':
        return {
          text: 'Unavailable',
          className: 'btn btn-danger',
          disabled: true
        };
      case 'failed':
      case 'error':
      case 'timeout':
        return {
          text: 'Try Again',
          className: 'btn btn-outline-primary',
          disabled: false
        };
      default:
        return {
          text: 'Book',
          className: 'btn btn-primary',
          disabled: false
        };
    }
  };

  if (loading) {
    return (
      <div className="container mt-5">
        <div className="text-center">
          <div className="spinner-border" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2">Loading booking system...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <div className="row justify-content-center mb-4">
        <div className="col-md-10">
          <div className="card">
            <div className="card-header bg-primary text-white">
              <h3 className="card-title mb-0">🎯 Tatkal-Style Booking System</h3>
              <small>Queue-based booking with FCFS processing</small>
            </div>
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <div>
                  <p className="mb-1"><strong>User ID:</strong> <code>{userId}</code></p>
                  <p className="mb-0 text-muted">Multiple users can book simultaneously - first come, first served!</p>
                </div>
                <button 
                  className="btn btn-outline-secondary"
                  onClick={handleReset}
                >
                  Reset All Bookings
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4">
        {statements.map((statement) => {
          const buttonConfig = getButtonConfig(statement);
          const bookingState = bookingStates[statement.id];

          return (
            <div key={statement.id} className="col-md-6 col-lg-4">
              <div className="card h-100">
                <div className="card-body d-flex flex-column">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <h5 className="card-title text-primary flex-grow-1">
                      {statement.title}
                    </h5>
                    {statement.availableSlots <= 0 && (
                      <span className="badge bg-danger ms-2">FILLED</span>
                    )}
                  </div>
                  
                  <div className="mb-3">
                    <div className="d-flex justify-content-between">
                      <span className="text-muted">Slots:</span>
                      <span className={`fw-bold ${statement.availableSlots <= 0 ? 'text-danger' : 'text-success'}`}>
                        {statement.bookedSlots}/{statement.totalSlots}
                      </span>
                    </div>
                    
                    <div className="progress mt-1" style={{ height: '6px' }}>
                      <div
                        className={`progress-bar ${statement.availableSlots <= 0 ? 'bg-danger' : 'bg-success'}`}
                        style={{ width: `${(statement.bookedSlots / statement.totalSlots) * 100}%` }}
                      ></div>
                    </div>
                    
                    <small className="text-muted">
                      {statement.availableSlots} slot(s) available
                    </small>
                  </div>

                  {/* Booking Status Message */}
                  {bookingState && (
                    <div className="alert alert-info py-2 mb-3">
                      <div className="d-flex align-items-center">
                        {(bookingState.status === 'processing' || bookingState.status === 'queued') && (
                          <div className="spinner-border spinner-border-sm me-2" role="status"></div>
                        )}
                        <small>{bookingState.message}</small>
                      </div>
                    </div>
                  )}
                  
                  <div className="mt-auto">
                    <button
                      onClick={() => handleBook(statement.id)}
                      disabled={buttonConfig.disabled}
                      className={`${buttonConfig.className} w-100`}
                    >
                      {(bookingState?.status === 'processing' || bookingState?.status === 'queued') && (
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                      )}
                      {buttonConfig.text}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* System Status */}
      <div className="row justify-content-center mt-5">
        <div className="col-md-8">
          <div className="card">
            <div className="card-header">
              <h6 className="mb-0">System Status</h6>
            </div>
            <div className="card-body">
              <div className="row">
                <div className="col-md-6">
                  <h6>How it works:</h6>
                  <ul className="small">
                    <li>Click "Book" to add request to queue</li>
                    <li>System processes requests in FCFS order</li>
                    <li>Millisecond-level timestamp sorting</li>
                    <li>Real-time status updates</li>
                  </ul>
                </div>
                <div className="col-md-6">
                  <h6>Test scenario:</h6>
                  <ul className="small">
                    <li>Open multiple browser tabs</li>
                    <li>Click "Book" simultaneously</li>
                    <li>Only first 3 requests succeed</li>
                    <li>Others get "Unavailable" message</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TatkalBookingSystem;