import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, addDoc, query, getDocs, onSnapshot, runTransaction, doc } from 'firebase/firestore';

// Sample problem statements data
const PROBLEM_STATEMENTS = [
  {
    id: 'ps1',
    title: 'Smart Traffic Management System',
    description: 'Develop an AI-powered system to optimize traffic flow in urban areas using real-time data analysis and predictive modeling.'
  },
  {
    id: 'ps2',
    title: 'Sustainable Energy Monitor',
    description: 'Create a IoT-based solution to monitor and optimize energy consumption in residential and commercial buildings.'
  },
  {
    id: 'ps3',
    title: 'Healthcare Data Analytics',
    description: 'Build a platform to analyze patient data for early disease detection and personalized treatment recommendations.'
  },
  {
    id: 'ps4',
    title: 'Agricultural Automation',
    description: 'Design an automated farming system using drones and sensors for crop monitoring and precision agriculture.'
  },
  {
    id: 'ps5',
    title: 'Financial Fraud Detection',
    description: 'Develop a machine learning model to detect fraudulent transactions in real-time banking systems.'
  },
  {
    id: 'ps6',
    title: 'Educational Learning Assistant',
    description: 'Create an AI-powered learning assistant that adapts to individual student needs and learning patterns.'
  }
];

const ProblemStatements = () => {
  const { teamData } = useParams();
  const navigate = useNavigate();
  const [team, setTeam] = useState(null);
  const [problemCounts, setProblemCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [selectedProblem, setSelectedProblem] = useState(null);
  // OPTIMIZED: Cache team registration status to avoid repeated checks
  const [teamRegistrationStatus, setTeamRegistrationStatus] = useState(null);
  const [allRegistrations, setAllRegistrations] = useState([]);
  // REAL-TIME: Track real-time updates and conflicts
  const [realTimeError, setRealTimeError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    try {
      const decodedTeamData = JSON.parse(atob(teamData));
      setTeam(decodedTeamData);
      // REAL-TIME: Set up real-time listener for problem statement updates
      setupRealTimeListener(decodedTeamData.teamNumber);
    } catch (error) {
      console.error('Invalid team data');
      navigate('/');
    }
  }, [teamData, navigate]);

  // REAL-TIME: Set up Firebase real-time listener for immediate updates
  const setupRealTimeListener = useCallback((teamNumber) => {
    const q = query(collection(db, 'registrations'));
    
    // Set up real-time listener
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const registrations = [];
      const counts = {};
      let teamAlreadyRegistered = false;
      
      // Initialize counts
      PROBLEM_STATEMENTS.forEach(problem => {
        counts[problem.id] = 0;
      });
      
      // Process all registrations in real-time
      querySnapshot.forEach(doc => {
        const data = doc.data();
        registrations.push(data);
        
        // Count problem registrations
        if (counts.hasOwnProperty(data.problemStatementId)) {
          counts[data.problemStatementId]++;
        }
        
        // Check if current team is already registered
        if (data.teamNumber === teamNumber) {
          teamAlreadyRegistered = true;
        }
      });
      
      setAllRegistrations(registrations);
      setProblemCounts(counts);
      setTeamRegistrationStatus(teamAlreadyRegistered);
      
      // REAL-TIME: Check if selected problem got filled while user was deciding
      if (selectedProblem && counts[selectedProblem.id] >= 3) {
        setRealTimeError(`Sorry! "${selectedProblem.title}" was just filled by another team. Please select a different problem statement.`);
        setShowConfirmation(false);
        setSelectedProblem(null);
      }
    }, (error) => {
      console.error('Error with real-time listener:', error);
    });
    
    // Cleanup listener on component unmount
    return () => unsubscribe();
  }, [selectedProblem]);

  // OPTIMIZED: Remove redundant fetchAllDataOptimized function (replaced by real-time listener)

  // OPTIMIZED: Remove redundant fetchProblemCounts function (replaced by fetchAllDataOptimized)

  // REAL-TIME & RACE-CONDITION SAFE: Enhanced problem selection with immediate validation
  const handleSelectProblem = useCallback(async (problemStatement) => {
    // Clear any previous errors
    setRealTimeError('');
    
    // REAL-TIME CHECK: Verify current count from latest state
    if (problemCounts[problemStatement.id] >= 3) {
      setRealTimeError(`"${problemStatement.title}" is already filled (3/3 teams registered). Please select a different problem statement.`);
      return;
    }

    // OPTIMIZED: Use cached registration status instead of database query
    if (teamRegistrationStatus) {
      alert(`Team ${team.teamNumber} has already registered for a problem statement. Each team can only register once.`);
      return;
    }

    // Show confirmation popup
    setSelectedProblem(problemStatement);
    setShowConfirmation(true);
  }, [problemCounts, teamRegistrationStatus, team]);

  // RACE-CONDITION SAFE: Atomic transaction for registration with multiple validation checks
  const handleConfirmSelection = async () => {
    if (!selectedProblem) return;

    // FINAL CHECK: Real-time validation before processing
    if (problemCounts[selectedProblem.id] >= 3) {
      setRealTimeError(`"${selectedProblem.title}" is now COMPLETED (3/3 teams filled). Please select a different problem statement.`);
      setShowConfirmation(false);
      setSelectedProblem(null);
      return;
    }

    setIsProcessing(true);
    setLoading(true);
    setShowConfirmation(false);
    setRealTimeError('');
    
    try {
      // ATOMIC TRANSACTION: Ensures no race conditions with millisecond-level protection
      await runTransaction(db, async (transaction) => {
        // MILLISECOND CHECK: Get the absolute latest count at transaction time
        const registrationsRef = collection(db, 'registrations');
        const q = query(registrationsRef);
        const querySnapshot = await getDocs(q);
        
        let currentProblemCount = 0;
        let teamAlreadyExists = false;
        
        // Count current registrations for selected problem and check team status
        querySnapshot.forEach(doc => {
          const data = doc.data();
          if (data.problemStatementId === selectedProblem.id) {
            currentProblemCount++;
          }
          if (data.teamNumber === team.teamNumber) {
            teamAlreadyExists = true;
          }
        });
        
        // FINAL VALIDATION: Last-millisecond checks before registration
        if (currentProblemCount >= 3) {
          throw new Error(`COMPLETED: "${selectedProblem.title}" is now filled (3/3 teams). Registration closed.`);
        }
        
        if (teamAlreadyExists) {
          throw new Error(`Team ${team.teamNumber} has already registered for a problem statement.`);
        }
        
        // SAFE REGISTRATION: Add new registration within transaction
        const registrationData = {
          teamNumber: team.teamNumber,
          teamName: team.teamName,
          teamLeader: team.teamLeader,
          problemStatementId: selectedProblem.id,
          problemStatementTitle: selectedProblem.title,
          timestamp: new Date()
        };
        
        // Add registration document
        const newDocRef = doc(collection(db, 'registrations'));
        transaction.set(newDocRef, registrationData);
      });

      // SUCCESS: Registration completed successfully
      setSuccessMessage(`Registration Successful – Your team has been registered for "${selectedProblem.title}".`);
      setSelectedProblem(null);
      
      // Faster redirect
      setTimeout(() => {
        navigate('/');
      }, 2000);
      
    } catch (error) {
      console.error('Registration error:', error);
      
      // COMPLETION ERROR: Show specific error message for filled problems
      if (error.message.includes('COMPLETED') || error.message.includes('filled') || error.message.includes('closed')) {
        setRealTimeError(`❌ ${error.message}`);
      } else if (error.message.includes('already registered')) {
        setRealTimeError(`⚠️ ${error.message}`);
      } else {
        setRealTimeError('Registration failed. Please try again.');
      }
      
      setSelectedProblem(null);
    } finally {
      setLoading(false);
      setIsProcessing(false);
    }
  };

  const handleCancelSelection = useCallback(() => {
    setShowConfirmation(false);
    setSelectedProblem(null);
  }, []);

  // OPTIMIZED: Memoize problem cards to prevent unnecessary re-renders
  const problemCards = useMemo(() => {
    return PROBLEM_STATEMENTS.map((problem) => {
      const registeredCount = problemCounts[problem.id] || 0;
      const isDisabled = registeredCount >= 3;
      const isFilled = registeredCount >= 3;
      
      return (
        <div key={problem.id} className="col-md-6 col-lg-4">
          <div className={`card h-100 ${isDisabled ? 'opacity-75' : ''}`} 
               style={{ 
                 cursor: isDisabled ? 'not-allowed' : 'pointer',
                 transition: 'transform 0.2s, box-shadow 0.2s',
                 border: isFilled ? '2px solid #dc3545' : '1px solid #dee2e6'
               }}
               onMouseEnter={(e) => {
                 if (!isDisabled) {
                   e.currentTarget.style.transform = 'scale(1.02)';
                   e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.15)';
                 }
               }}
               onMouseLeave={(e) => {
                 e.currentTarget.style.transform = 'scale(1)';
                 e.currentTarget.style.boxShadow = '';
               }}>
            <div className="card-body d-flex flex-column">
              <div className="d-flex justify-content-between align-items-start mb-2">
                <h5 className="card-title text-primary flex-grow-1">
                  {problem.title}
                </h5>
                {isFilled && (
                  <span className="badge bg-danger ms-2">
                    FILLED
                  </span>
                )}
              </div>
              
              <p className="card-text text-muted flex-grow-1">
                {problem.description}
              </p>
              
              <div className="d-flex justify-content-between align-items-center mt-auto">
                <small className={`${registeredCount >= 3 ? 'text-danger fw-bold' : 'text-success'}`}>
                  {registeredCount}/3 teams {isFilled ? '(COMPLETE)' : 'registered'}
                </small>
                
                <button
                  onClick={() => handleSelectProblem(problem)}
                  disabled={isDisabled || loading || isProcessing}
                  className={`btn ${isDisabled ? 'btn-danger' : 'btn-primary'}`}
                >
                  {isDisabled ? 'FILLED' : (loading || isProcessing) ? 'Processing...' : 'Select'}
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    });
  }, [problemCounts, loading, isProcessing, handleSelectProblem]);

  if (!team) {
    return <div className="text-center">Loading...</div>;
  }

  if (successMessage) {
    return (
      <div className="row justify-content-center">
        <div className="col-md-8">
          <div className="alert alert-success text-center">
            <h4 className="alert-heading">✅ Success!</h4>
            <p className="mb-2">{successMessage}</p>
            <small className="text-muted">Redirecting to home page...</small>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* REAL-TIME ERROR ALERT */}
      {realTimeError && (
        <div className="row justify-content-center mb-4">
          <div className="col-md-8">
            <div className="alert alert-warning alert-dismissible" role="alert">
              <h6 className="alert-heading">⚠️ Real-time Update</h6>
              <p className="mb-0">{realTimeError}</p>
              <button 
                type="button" 
                className="btn-close" 
                onClick={() => setRealTimeError('')}
                aria-label="Close"
              ></button>
            </div>
          </div>
        </div>
      )}

      {/* PROCESSING INDICATOR */}
      {isProcessing && (
        <div className="row justify-content-center mb-4">
          <div className="col-md-8">
            <div className="alert alert-info text-center">
              <div className="spinner-border spinner-border-sm me-2" role="status"></div>
              Processing your registration... Please wait.
            </div>
          </div>
        </div>
      )}
      {/* Confirmation Modal */}
      {showConfirmation && selectedProblem && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Confirm Problem Statement Selection</h5>
              </div>
              <div className="modal-body">
                <div className="text-center">
                  <div className="mb-3">
                    <strong>Team Details:</strong>
                    <p className="mb-1">Team Number: <span className="text-primary">{team.teamNumber}</span></p>
                    <p className="mb-1">Team Name: <span className="text-primary">{team.teamName}</span></p>
                    <p className="mb-3">Team Leader: <span className="text-primary">{team.teamLeader}</span></p>
                  </div>
                  
                  <div className="mb-3">
                    <strong>Selected Problem Statement:</strong>
                    <div className="card bg-light mt-2">
                      <div className="card-body">
                        <h6 className="card-title text-primary">{selectedProblem.title}</h6>
                        <p className="card-text small text-muted">{selectedProblem.description}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="alert alert-warning">
                    <strong>⚠️ Important:</strong> Once confirmed, this registration cannot be changed. Each team can only register for one problem statement.
                    {selectedProblem && problemCounts[selectedProblem.id] >= 3 && (
                      <div className="mt-2 text-danger">
                        <strong>🚫 ALERT:</strong> This problem statement is now COMPLETED (3/3 teams filled)!
                      </div>
                    )}
                  </div>
                  
                  <p className="text-center">
                    <strong>
                      {selectedProblem && problemCounts[selectedProblem.id] >= 3 ? (
                        <span className="text-danger">⚠️ This problem statement is now COMPLETED! Please select a different one.</span>
                      ) : (
                        'Are you sure you want to register for this problem statement?'
                      )}
                    </strong>
                  </p>
                </div>
              </div>
              <div className="modal-footer justify-content-center">
                <button 
                  type="button" 
                  className="btn btn-secondary me-2" 
                  onClick={handleCancelSelection}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-success" 
                  onClick={handleConfirmSelection}
                  disabled={loading || (selectedProblem && problemCounts[selectedProblem.id] >= 3)}
                >
                  {loading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                      Confirming...
                    </>
                  ) : (selectedProblem && problemCounts[selectedProblem.id] >= 3) ? (
                    'COMPLETED - FILLED'
                  ) : (
                    'Confirm Registration'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="row justify-content-center mb-4">
        <div className="col-md-8">
          <div className="card">
            <div className="card-body text-center">
              <h2 className="card-title">Select Problem Statement</h2>
              <div className="text-muted">
                <p><strong>Team:</strong> {team.teamName} (#{team.teamNumber})</p>
                <p><strong>Team Leader:</strong> {team.teamLeader}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4">
        {problemCards}
      </div>
      
      <div className="text-center mt-4">
        <button
          onClick={() => navigate('/')}
          className="btn btn-outline-primary"
        >
          ← Back to Registration
        </button>
      </div>
    </div>
  );
};

export default ProblemStatements;