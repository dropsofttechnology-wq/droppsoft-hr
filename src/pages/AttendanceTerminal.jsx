import { useState, useEffect, useRef } from 'react'
import { useCompany } from '../contexts/CompanyContext'
import { useFaceRecognition } from '../hooks/useFaceRecognition'
import { useFaceSettings } from '../hooks/useFaceSettings'
import { getAllFaceDescriptors } from '../services/faceService'
import { logAttendance, findEmployeeByQR, getAttendanceStatus } from '../services/attendanceService'
import { getEmployees } from '../services/employeeService'
import { getCompanySettings } from '../utils/settingsHelper'
import { isClockInOnTime } from '../utils/attendanceHelper'
import { format } from 'date-fns'
import { createFaceMatcher, matchFace } from '../utils/faceMatcher'
import { Html5Qrcode } from 'html5-qrcode'
import './AttendanceTerminal.css'

const AttendanceTerminal = () => {
  const { currentCompany } = useCompany()
  const { settings: faceSettings } = useFaceSettings()
  const { modelsLoaded, detectFace } = useFaceRecognition(faceSettings)
  
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
  const [qrError, setQrError] = useState('')
  const qrStartingRef = useRef(false)
  
  // Manual entry
  const [manualInput, setManualInput] = useState('')
  const [showKeypad, setShowKeypad] = useState(false)

  // Reporting grace period (for on-time / late message)
  const [reportingSettings, setReportingSettings] = useState({})

  useEffect(() => {
    updateClock()
    const clockInterval = setInterval(updateClock, 1000)
    return () => clearInterval(clockInterval)
  }, [])

  useEffect(() => {
    if (currentCompany) {
      loadEmployees()
      loadFaceDescriptors()
      getCompanySettings(currentCompany.$id, ['official_reporting_time', 'reporting_grace_minutes'])
        .then(s => setReportingSettings(s || {}))
        .catch(() => setReportingSettings({}))
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
  }, [mode, modelsLoaded, faceDescriptors, faceSettings])

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
      const threshold = faceSettings?.face_matching_threshold ?? 0.35
      const matcher = createFaceMatcher(faceDescriptors, threshold)
      setFaceMatcher(matcher)
    } catch (error) {
      console.error('Error creating face matcher:', error)
    }
  }

  const startFaceDetection = async () => {
    if (!videoRef.current || !modelsLoaded) return

    try {
      // Optimized camera settings for faster face detection
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'user', 
          width: { ideal: 640, max: 1280 }, 
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 30, max: 60 } // Optimize frame rate for detection
        }
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
      // Optimized: Check video is ready before detection
      if (videoRef.current.readyState < 2) {
        requestAnimationFrame(detectLoop)
        return
      }

      const detection = await detectFace(videoRef.current)
      
      if (detection && detection.detection && detection.descriptor) {
        const minConf = faceSettings?.face_matching_min_confidence ?? 65
        const match = matchFace(faceMatcher, detection.descriptor, minConf)
        
        if (match && match.confidence >= minConf) {
          await handleClockInOut(match.userId, 'face')
          return // Stop detection after successful match
        }
      }
    } catch (error) {
      console.error('Detection error:', error)
    }

    // Continue detection loop with optimized frame rate
    if (mode === 'face' && !processing) {
      // Use requestAnimationFrame for smooth 60fps, but detection is throttled to 30fps internally
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
    if (qrScanner || qrScannerRef.current || qrStartingRef.current) return
    qrStartingRef.current = true
    setQrError('')

    const onDecoded = (decodedText) => {
      handleQRCode(decodedText)
    }
    const onScanError = () => {
      // Ignore scan frame-level errors.
    }

    try {
      const scanner = new Html5Qrcode('qr-reader')
      qrScannerRef.current = scanner
      
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 15,
          qrbox: { width: 250, height: 250 }
        },
        onDecoded,
        onScanError
      )
      
      setQrScanner(scanner)
    } catch (facingModeError) {
      // Some Android WebViews fail on facingMode in release; retry with explicit camera id.
      try {
        const scanner = new Html5Qrcode('qr-reader')
        qrScannerRef.current = scanner
        const cameras = await Html5Qrcode.getCameras()
        if (!cameras?.length) {
          throw new Error('No camera found on this device.')
        }
        await scanner.start(
          cameras.find((c) => /back|rear|environment/i.test(c.label || ''))?.id || cameras[0].id,
          {
            fps: 15,
            qrbox: { width: 250, height: 250 }
          },
          onDecoded,
          onScanError
        )
        setQrScanner(scanner)
      } catch (fallbackError) {
        console.error('QR Scanner error:', facingModeError)
        console.error('QR Scanner fallback error:', fallbackError)
        setQrError(
          fallbackError?.message || 'Could not start the QR camera. Check camera permission and try again.'
        )
        qrScannerRef.current = null
      }
    } finally {
      qrStartingRef.current = false
    }
  }

  const stopQRScanner = async () => {
    const scanner = qrScannerRef.current || qrScanner
    if (scanner) {
      try {
        await scanner.stop()
        await scanner.clear()
      } catch (error) {
        console.error('Error stopping QR scanner:', error)
      }
      qrScannerRef.current = null
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
      const record = await logAttendance({
        user_id: userId,
        company_id: currentCompany.$id,
        auth_method: authMethod,
        location_lat: location?.lat,
        location_lng: location?.lng
      })
      
      // Determine action
      const isClockIn = currentStatus.status === 'not_clocked_in' || currentStatus.status === 'clocked_out'
      const action = isClockIn ? 'Clocked In' : 'Clocked Out'
      
      const time = new Date().toLocaleTimeString()
      let message = `Hello ${employee.name}! ${action} at ${time}`
      if (isClockIn && record?.clock_in_time) {
        const today = format(new Date(), 'yyyy-MM-dd')
        const onTime = isClockInOnTime(record.clock_in_time, today, reportingSettings)
        message += onTime ? ' (On time)' : ' (Late)'
      }
      setSuccessMessage(message)
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
          {qrError && (
            <div className="alert alert-warning" role="alert" style={{ marginBottom: 12 }}>
              {qrError}
            </div>
          )}
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
