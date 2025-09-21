import React, { useState, useEffect } from 'react';
import bookingService from '../services/bookingService';

const BookingTestSuite = () => {
  const [testResults, setTestResults] = useState([]);
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [statements, setStatements] = useState([]);
  const [selectedStatement, setSelectedStatement] = useState('');
  const [numberOfUsers, setNumberOfUsers] = useState(5);
  const [systemHealth, setSystemHealth] = useState(null);

  useEffect(() => {
    loadStatements();
    checkSystemHealth();
  }, []);

  const loadStatements = async () => {
    try {
      const response = await bookingService.getStatements();
      setStatements(response.statements);
      if (response.statements.length > 0) {
        setSelectedStatement(response.statements[0].id);
      }
    } catch (error) {
      console.error('Error loading statements:', error);
    }
  };

  const checkSystemHealth = async () => {
    try {
      const health = await bookingService.healthCheck();
      setSystemHealth(health);
    } catch (error) {
      console.error('Health check failed:', error);
      setSystemHealth({ success: false, message: 'Backend not available' });
    }
  };

  const runSimultaneousBookingTest = async () => {
    if (!selectedStatement) {
      alert('Please select a statement to test');
      return;
    }

    setIsRunningTest(true);
    setTestResults([]);

    try {
      console.log(`🧪 Starting test: ${numberOfUsers} users booking ${selectedStatement}`);
      
      // Reset bookings first
      await bookingService.resetBookings();
      await loadStatements();

      // Add initial test result
      const startTime = Date.now();
      setTestResults([{
        id: 'start',
        timestamp: startTime,
        message: `Test started: ${numberOfUsers} users booking statement ${selectedStatement}`,
        type: 'info'
      }]);

      // Run simulation
      const results = await bookingService.simulateSimultaneousBookings(
        selectedStatement, 
        numberOfUsers
      );

      // Process results
      const testResults = [];
      let successCount = 0;
      let failCount = 0;

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const response = result.value;
          testResults.push({
            id: `user-${index + 1}`,
            timestamp: Date.now(),
            message: `User ${index + 1}: ${response.message}`,
            type: response.success ? 'success' : 'warning',
            queueId: response.queueId
          });
          
          if (response.success) successCount++;
          else failCount++;
        } else {
          testResults.push({
            id: `user-${index + 1}`,
            timestamp: Date.now(),
            message: `User ${index + 1}: ERROR - ${result.reason.message}`,
            type: 'error'
          });
          failCount++;
        }
      });

      // Add summary
      testResults.push({
        id: 'summary',
        timestamp: Date.now(),
        message: `Test completed: ${successCount} queued, ${failCount} failed. Waiting for queue processing...`,
        type: 'info'
      });

      setTestResults(testResults);

      // Wait for queue processing and check final results
      setTimeout(async () => {
        await loadStatements();
        
        setTestResults(prev => [...prev, {
          id: 'final',
          timestamp: Date.now(),
          message: 'Queue processing completed. Check statement slots for final results.',
          type: 'success'
        }]);
        
        setIsRunningTest(false);
      }, 5000); // Wait 5 seconds for queue processing

    } catch (error) {
      console.error('Test failed:', error);
      setTestResults(prev => [...prev, {
        id: 'error',
        timestamp: Date.now(),
        message: `Test failed: ${error.message}`,
        type: 'error'
      }]);
      setIsRunningTest(false);
    }
  };

  const resetAllBookings = async () => {
    try {
      await bookingService.resetBookings();
      await loadStatements();
      setTestResults([]);
      alert('All bookings reset successfully!');
    } catch (error) {
      console.error('Reset failed:', error);
      alert('Reset failed: ' + error.message);
    }
  };

  const getTypeClass = (type) => {
    switch (type) {
      case 'success': return 'alert-success';
      case 'warning': return 'alert-warning';
      case 'error': return 'alert-danger';
      case 'info': return 'alert-info';
      default: return 'alert-secondary';
    }
  };

  return (
    <div className="container mt-4">
      <div className="row">
        <div className="col-md-8">
          <div className="card">
            <div className="card-header">
              <h4>🧪 Tatkal Booking Test Suite</h4>
              <small className="text-muted">Test simultaneous booking scenarios</small>
            </div>
            <div className="card-body">
              {/* System Health */}
              <div className="mb-4">
                <h6>System Health:</h6>
                {systemHealth ? (
                  <div className={`alert ${systemHealth.success ? 'alert-success' : 'alert-danger'} py-2`}>
                    {systemHealth.message}
                    {systemHealth.queueStatus && (
                      <small className="d-block mt-1">
                        Queue: {systemHealth.queueStatus.queueLength} items, 
                        Processing: {systemHealth.queueStatus.isProcessing ? 'Yes' : 'No'}
                      </small>
                    )}
                  </div>
                ) : (
                  <div className="spinner-border spinner-border-sm"></div>
                )}
              </div>

              {/* Test Configuration */}
              <div className="row mb-4">
                <div className="col-md-6">
                  <label className="form-label">Statement to Test:</label>
                  <select 
                    className="form-select"
                    value={selectedStatement}
                    onChange={(e) => setSelectedStatement(e.target.value)}
                    disabled={isRunningTest}
                  >
                    {statements.map(statement => (
                      <option key={statement.id} value={statement.id}>
                        {statement.title} ({statement.bookedSlots}/{statement.totalSlots})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label">Number of Simultaneous Users:</label>
                  <input
                    type="number"
                    className="form-control"
                    min="2"
                    max="20"
                    value={numberOfUsers}
                    onChange={(e) => setNumberOfUsers(parseInt(e.target.value))}
                    disabled={isRunningTest}
                  />
                </div>
              </div>

              {/* Test Controls */}
              <div className="d-flex gap-2 mb-4">
                <button
                  className="btn btn-primary"
                  onClick={runSimultaneousBookingTest}
                  disabled={isRunningTest || !systemHealth?.success}
                >
                  {isRunningTest ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Running Test...
                    </>
                  ) : (
                    'Run Simultaneous Booking Test'
                  )}
                </button>
                
                <button
                  className="btn btn-outline-secondary"
                  onClick={resetAllBookings}
                  disabled={isRunningTest}
                >
                  Reset All Bookings
                </button>
                
                <button
                  className="btn btn-outline-info"
                  onClick={() => { loadStatements(); checkSystemHealth(); }}
                  disabled={isRunningTest}
                >
                  Refresh Status
                </button>
              </div>

              {/* Test Results */}
              {testResults.length > 0 && (
                <div>
                  <h6>Test Results:</h6>
                  <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {testResults.map((result) => (
                      <div key={result.id} className={`alert ${getTypeClass(result.type)} py-2 mb-2`}>
                        <small className="text-muted">
                          {new Date(result.timestamp).toLocaleTimeString()}
                        </small>
                        <div>{result.message}</div>
                        {result.queueId && (
                          <small className="text-muted">Queue ID: {result.queueId}</small>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card">
            <div className="card-header">
              <h6>Current Statement Status</h6>
            </div>
            <div className="card-body">
              {statements.map((statement) => (
                <div key={statement.id} className="mb-3 p-2 border rounded">
                  <div className="d-flex justify-content-between align-items-center">
                    <small className="fw-bold">{statement.title}</small>
                    <span className={`badge ${statement.availableSlots <= 0 ? 'bg-danger' : 'bg-success'}`}>
                      {statement.bookedSlots}/{statement.totalSlots}
                    </span>
                  </div>
                  <div className="progress mt-1" style={{ height: '4px' }}>
                    <div
                      className={`progress-bar ${statement.availableSlots <= 0 ? 'bg-danger' : 'bg-success'}`}
                      style={{ width: `${(statement.bookedSlots / statement.totalSlots) * 100}%` }}
                    ></div>
                  </div>
                  <small className="text-muted">
                    {statement.availableSlots} available
                  </small>
                </div>
              ))}
            </div>
          </div>

          <div className="card mt-3">
            <div className="card-header">
              <h6>Test Instructions</h6>
            </div>
            <div className="card-body">
              <ol className="small">
                <li>Select a statement to test</li>
                <li>Set number of simultaneous users</li>
                <li>Click "Run Test" to simulate</li>
                <li>Watch the queue processing</li>
                <li>Check final booking results</li>
              </ol>
              
              <div className="mt-3">
                <strong>Expected Results:</strong>
                <ul className="small mt-1">
                  <li>Only first 3 requests succeed</li>
                  <li>Others get "unavailable"</li>
                  <li>FCFS order maintained</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingTestSuite;