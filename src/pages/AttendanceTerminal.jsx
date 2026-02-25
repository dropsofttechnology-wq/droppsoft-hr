import { useState, useEffect, useRef } from 'react'
import { useCompany } from '../contexts/CompanyContext'
import { useFaceRecognition } from '../hooks/useFaceRecognition'
import { getAllFaceDescriptors } from '../services/faceService'
import { logAttendance, findEmployeeByQR, getAttendanceStatus } from '../services/attendanceService'
import { getEmployees } from '../services/employeeService'
import { createFaceMatcher, matchFace } from '../utils/faceMatcher'
import { Html5Qrcode } from 'html5-qrcode'
import './AttendanceTerminal.css'

const AttendanceTerminal = () => {
  const { currentCompany } = useCompany()
  const { modelsLoaded, detectFace } = useFaceRecognition()
  
  const [mode, setMode] = useState('face') // 'face', 'qr', 'manual'
  const [status, setStatus] = useState('ready')
  const [statusMessage, setStatusMessage] = useState('Ready for attendance')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [employees, setEmployees] = useState([])
  const [faceMatcher, setFaceMatcher] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [showError, setShowError] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  
  // Face recognition
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const [faceDescriptors, setFaceDescriptors] = useState([])
  
  // QR code
  const qrScannerRef = useRef(null)
  const [qrScanner, setQrScanner] = useState(null)
  
  // Manual entry
  const [manualInput, setManualInput] = useState('')
  const [showKeypad, setShowKeypad] = useState(false)

  useEffect(() => {
    updateClock()
    const clockInterval = setInterval(updateClock, 1000)
    return () => clearInterval(clockInterval)
  }, [])

  useEffect(() => {
    if (currentCompany) {
      loadEmployees()
      loadFaceDescriptors()
    }
  }, [currentCompany])

  useEffect(() => {
    if (mode === 'face' && modelsLoaded && faceDescriptors.length > 0) {
      initializeFaceMatcher()
      startFaceDetection()
    } else if (mode === 'qr') {
      startQRScanner()
    }
    
    return () => {
      stopFaceDetection()
      stopQRScanner()
    }
  }, [mode, modelsLoaded, faceDescriptors])

  const updateClock = () => {
    setCurrentTime(new Date())
  }

  const loadEmployees = async () => {
    try {
      const data = await getEmployees(currentCompany.$id, { status: 'active' })
      setEmployees(data)
    } catch (error) {
      console.error('Error loading employees:', error)
    }
  }

  const loadFaceDescriptors = async () => {
    try {
      const descriptors = await getAllFaceDescriptors(currentCompany.$id)
      setFaceDescriptors(descriptors)
    } catch (error) {
      console.error('Error loading face descriptors:', error)
    }
  }

  const initializeFaceMatcher = () => {
    try {
      const matcher = createFaceMatcher(faceDescriptors)
      setFaceMatcher(matcher)
    } catch (error) {
      console.error('Error creating face matcher:', error)
    }
  }

  const startFaceDetection = async () => {
    if (!videoRef.current || !modelsLoaded) return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 }
      })
      
      videoRef.current.srcObject = stream
      streamRef.current = stream
      
      detectLoop()
    } catch (error) {
      setStatus('error')
      setStatusMessage('Camera access denied')
      setErrorMessage('Please allow camera permissions')
      showErrorFeedback()
    }
  }

  const detectLoop = async () => {
    if (!videoRef.current || !faceMatcher || processing) {
      if (mode === 'face' && !processing) {
        requestAnimationFrame(detectLoop)
      }
      return
    }

    try {
      const detection = await detectFace(videoRef.current)
      
      if (detection) {
        const match = matchFace(faceMatcher, detection.descriptor)
        
        if (match && match.confidence >= 90) {
          await handleClockInOut(match.userId, 'face')
        }
      }
    } catch (error) {
      console.error('Detection error:', error)
    }

    if (mode === 'face' && !processing) {
      requestAnimationFrame(detectLoop)
    }
  }

  const stopFaceDetection = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }

  const startQRScanner = async () => {
    if (qrScanner) return

    try {
      const scanner = new Html5Qrcode('qr-reader')
      
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 30,
          qrbox: { width: 250, height: 250 }
        },
        (decodedText) => {
          handleQRCode(decodedText)
        },
        (errorMessage) => {
          // Ignore scanning errors
        }
      )
      
      setQrScanner(scanner)
    } catch (error) {
      console.error('QR Scanner error:', error)
    }
  }

  const stopQRScanner = async () => {
    if (qrScanner) {
      try {
        await qrScanner.stop()
        await qrScanner.clear()
      } catch (error) {
        console.error('Error stopping QR scanner:', error)
      }
      setQrScanner(null)
    }
  }

  const handleQRCode = async (qrToken) => {
    if (processing) return
    
    try {
      setProcessing(true)
      setStatus('processing')
      setStatusMessage('Processing QR code...')
      
      const employee = await findEmployeeByQR(qrToken, currentCompany.$id)
      
      if (!employee) {
        throw new Error('Employee not found')
      }
      
      const userId = employee.user_id || employee.$id
      await handleClockInOut(userId, 'qr')
    } catch (error) {
      setErrorMessage('Invalid QR code or employee not found')
      showErrorFeedback()
    } finally {
      setProcessing(false)
      setStatus('ready')
      setStatusMessage('Ready for attendance')
    }
  }

  const handleManualEntry = async () => {
    if (!manualInput || processing) return

    try {
      setProcessing(true)
      setStatus('processing')
      setStatusMessage('Processing...')
      
      // Find employee by ID or staff number
      const employee = employees.find(
        emp => emp.employee_id === manualInput || 
               emp.staff_no === manualInput ||
               emp.name.toLowerCase().includes(manualInput.toLowerCase())
      )
      
      if (!employee) {
        throw new Error('Employee not found')
      }
      
      const userId = employee.user_id || employee.$id
      await handleClockInOut(userId, 'manual')
      setManualInput('')
      setShowKeypad(false)
    } catch (error) {
      setErrorMessage('Employee not found')
      showErrorFeedback()
    } finally {
      setProcessing(false)
      setStatus('ready')
      setStatusMessage('Ready for attendance')
    }
  }

  const handleClockInOut = async (userId, authMethod) => {
    try {
      setProcessing(true)
      setStatus('processing')
      setStatusMessage('Processing attendance...')
      
      // Get current status
      const currentStatus = await getAttendanceStatus(userId)
      
      // Get employee info
      const employee = employees.find(emp => (emp.user_id || emp.$id) === userId)
      if (!employee) {
        throw new Error('Employee not found')
      }
      
      // Get geolocation (non-blocking)
      let location = null
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            location = {
              lat: position.coords.latitude,
              lng: position.coords.longitude
            }
          },
          () => {
            // Ignore geolocation errors
          },
          { timeout: 2000 }
        )
      }
      
      // Log attendance
      await logAttendance({
        user_id: userId,
        company_id: currentCompany.$id,
        auth_method: authMethod,
        location_lat: location?.lat,
        location_lng: location?.lng
      })
      
      // Determine action
      const action = currentStatus.status === 'not_clocked_in' || currentStatus.status === 'clocked_out' 
        ? 'Clocked In' 
        : 'Clocked Out'
      
      const time = new Date().toLocaleTimeString()
      setSuccessMessage(`Hello ${employee.name}! ${action} at ${time}`)
      showSuccessFeedback()
      
      // Play success sound
      playSuccessSound()
      
    } catch (error) {
      setErrorMessage(error.message || 'Failed to record attendance')
      showErrorFeedback()
      playErrorSound()
    } finally {
      setProcessing(false)
      setStatus('ready')
      setStatusMessage('Ready for attendance')
    }
  }

  const showSuccessFeedback = () => {
    setShowSuccess(true)
    setShowError(false)
    setTimeout(() => {
      setShowSuccess(false)
    }, 2000)
  }

  const showErrorFeedback = () => {
    setShowError(true)
    setShowSuccess(false)
    setTimeout(() => {
      setShowError(false)
    }, 3000)
  }

  const playSuccessSound = () => {
    // Create a beep sound
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    oscillator.frequency.value = 800
    oscillator.type = 'sine'
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2)
    
    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.2)
  }

  const playErrorSound = () => {
    // Create a buzz sound
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)
    
    oscillator.frequency.value = 200
    oscillator.type = 'sawtooth'
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
    
    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.3)
  }

  if (!currentCompany) {
    return (
      <div className="attendance-terminal">
        <div className="alert alert-warning">
          Please select a company first.
        </div>
      </div>
    )
  }

  return (
    <div className={`attendance-terminal ${showSuccess ? 'success-flash' : ''} ${showError ? 'error-shake' : ''}`}>
      <div className="terminal-header">
        <h1>Attendance Terminal</h1>
        <div className="terminal-clock">
          {currentTime.toLocaleTimeString()}
        </div>
      </div>

      <div className="terminal-status">
        <div className={`status-indicator status-${status}`}>
          {statusMessage}
        </div>
      </div>

      {/* Success/Error Overlay */}
      {showSuccess && (
        <div className="feedback-overlay success-overlay">
          <div className="feedback-icon">✓</div>
          <div className="feedback-message">{successMessage}</div>
        </div>
      )}

      {showError && (
        <div className="feedback-overlay error-overlay">
          <div className="feedback-icon">✗</div>
          <div className="feedback-message">{errorMessage}</div>
        </div>
      )}

      {/* Mode Selection */}
      <div className="mode-selector">
        <button
          className={`mode-btn ${mode === 'face' ? 'active' : ''}`}
          onClick={() => setMode('face')}
        >
          Face Recognition
        </button>
        <button
          className={`mode-btn ${mode === 'qr' ? 'active' : ''}`}
          onClick={() => setMode('qr')}
        >
          QR Code
        </button>
        <button
          className={`mode-btn ${mode === 'manual' ? 'active' : ''}`}
          onClick={() => setMode('manual')}
        >
          Manual Entry
        </button>
      </div>

      {/* Face Recognition Mode */}
      {mode === 'face' && (
        <div className="terminal-view face-view">
          {!modelsLoaded ? (
            <div className="loading-message">Loading face recognition models...</div>
          ) : faceDescriptors.length === 0 ? (
            <div className="empty-message">
              No face data available. Please enroll faces first.
            </div>
          ) : (
            <>
              <div className="video-container">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="terminal-video"
                />
                <canvas ref={canvasRef} className="terminal-canvas" />
                <div className="scanning-line"></div>
              </div>
              <div className="face-instructions">
                <p>Position your face in front of the camera</p>
                <p className="subtext">Face recognition will automatically detect and clock you in/out</p>
              </div>
            </>
          )}
        </div>
      )}

      {/* QR Code Mode */}
      {mode === 'qr' && (
        <div className="terminal-view qr-view">
          <div id="qr-reader" className="qr-scanner"></div>
          <div className="qr-instructions">
            <p>Scan your QR code</p>
            <p className="subtext">Point your QR code at the camera</p>
          </div>
        </div>
      )}

      {/* Manual Entry Mode */}
      {mode === 'manual' && (
        <div className="terminal-view manual-view">
          <div className="manual-input-container">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Enter Employee ID, Staff Number, or Name"
              className="manual-input"
              onFocus={() => setShowKeypad(true)}
            />
            <button
              className="btn-primary btn-large"
              onClick={handleManualEntry}
              disabled={!manualInput || processing}
            >
              {processing ? 'Processing...' : 'Submit'}
            </button>
          </div>
          
          {showKeypad && (
            <div className="keypad">
              <div className="keypad-grid">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(num => (
                  <button
                    key={num}
                    className="keypad-key"
                    onClick={() => setManualInput(prev => prev + num)}
                  >
                    {num}
                  </button>
                ))}
                <button
                  className="keypad-key keypad-clear"
                  onClick={() => setManualInput('')}
                >
                  Clear
                </button>
                <button
                  className="keypad-key keypad-close"
                  onClick={() => setShowKeypad(false)}
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default AttendanceTerminal
