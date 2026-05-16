import { useState, useEffect, useRef, useMemo } from 'react'
import { useCompany } from '../contexts/CompanyContext'
import { useAuth } from '../contexts/AuthContext'
import { getEmployees } from '../services/employeeService'
import { checkFaceData, saveFaceDescriptor, deleteFaceDescriptor } from '../services/faceService'
import { useFaceRecognition } from '../hooks/useFaceRecognition'
import { useFaceSettings } from '../hooks/useFaceSettings'
import { validateFaceQuality } from '../utils/faceQuality'
import './FaceEnrollment.css'

function filterEmployeesByQuery(employees, query, selectedId) {
  const q = (query || '').trim().toLowerCase()
  if (!q) return employees
  return employees.filter((e) => {
    if (selectedId && e.$id === selectedId) return true
    const name = (e.name || '').toLowerCase()
    const id = String(e.employee_id || e.staff_no || '').toLowerCase()
    const dept = (e.department || '').toLowerCase()
    return name.includes(q) || id.includes(q) || dept.includes(q)
  })
}

const FaceEnrollment = () => {
  const { currentCompany } = useCompany()
  const { user } = useAuth()

  const selfEnrollmentMode =
    import.meta.env.VITE_CAPACITOR === 'true' &&
    String(user?.prefs?.role || '').toLowerCase() === 'employee' &&
    Boolean(user?.prefs?.employeeId)
  const { settings: faceSettings } = useFaceSettings()
  const { modelsLoaded, loading: modelsLoading, detectFace } = useFaceRecognition(faceSettings)
  
  const [employees, setEmployees] = useState([])
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [hasFaceData, setHasFaceData] = useState(false)
  const [step, setStep] = useState(1) // 1: Select Employee, 2: Capture Face, 3: Complete
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [employeeSearch, setEmployeeSearch] = useState('')

  const filteredFaceEmployees = useMemo(
    () => filterEmployeesByQuery(employees, employeeSearch, selectedEmployee?.$id),
    [employees, employeeSearch, selectedEmployee?.$id]
  )

  // Camera and video
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [faceDetected, setFaceDetected] = useState(false)
  const [quality, setQuality] = useState(null)
  const [autoCapture, setAutoCapture] = useState(false)
  const [captured, setCaptured] = useState(false)
  const autoCaptureRef = useRef(autoCapture)
  const capturedRef = useRef(captured)
  const autoCaptureInProgressRef = useRef(false)
  const detectionLoopRef = useRef(null)

  // Keep refs in sync so detection loop always sees latest values
  useEffect(() => {
    autoCaptureRef.current = autoCapture
    capturedRef.current = captured
  }, [autoCapture, captured])

  useEffect(() => {
    if (currentCompany) {
      loadEmployees()
    }
  }, [currentCompany])

  useEffect(() => {
    if (!selfEnrollmentMode || !employees.length || !user?.prefs?.employeeId) return
    const me = employees.find((e) => e.$id === user.prefs.employeeId)
    if (me) {
      setSelectedEmployee((prev) => (prev?.$id === me.$id ? prev : me))
    }
  }, [employees, selfEnrollmentMode, user?.prefs?.employeeId])

  useEffect(() => {
    if (selectedEmployee) {
      checkExistingFaceData()
    }
  }, [selectedEmployee])

  useEffect(() => {
    // Only start detection when all conditions are met
    if (step === 2 && cameraActive && modelsLoaded && videoRef.current) {
      const video = videoRef.current
      
      // Wait for video to be ready
      const handleVideoReady = () => {
        if (video.readyState >= 2) { // HAVE_CURRENT_DATA or higher
          console.log('Video ready, starting face detection')
          startFaceDetection()
        }
      }

      // Check if already ready
      if (video.readyState >= 2) {
        handleVideoReady()
      } else {
        video.addEventListener('loadedmetadata', handleVideoReady, { once: true })
        video.addEventListener('loadeddata', handleVideoReady, { once: true })
      }

      // Cleanup: only stop camera if leaving step 2
      return () => {
        video.removeEventListener('loadedmetadata', handleVideoReady)
        video.removeEventListener('loadeddata', handleVideoReady)
      }
    }
  }, [step, cameraActive, modelsLoaded, faceSettings])

  // Separate cleanup for when component unmounts or step changes away from 2
  useEffect(() => {
    return () => {
      // Only stop camera if we're leaving step 2
      if (step !== 2 && streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        setCameraActive(false)
      }
    }
  }, [step])

  const loadEmployees = async () => {
    try {
      const data = await getEmployees(currentCompany.$id, { status: 'active' })
      setEmployees(data)
    } catch (error) {
      setError('Failed to load employees')
    }
  }

  const checkExistingFaceData = async () => {
    if (!selectedEmployee) return
    
    try {
      // Check if employee has a user_id, if not, we need to create one or use employee ID
      const userId = selectedEmployee.user_id || selectedEmployee.$id
      const result = await checkFaceData(userId)
      setHasFaceData(result.has_face)
    } catch (error) {
      console.error('Error checking face data:', error)
    }
  }

  const handleEmployeeSelect = (employee) => {
    setSelectedEmployee(employee)
    setStep(1)
    setError('')
    setSuccess('')
  }

  const handleNext = async () => {
    if (!selectedEmployee) {
      setError('Please select an employee')
      return
    }
    
    if (!modelsLoaded && modelsLoading) {
      setError('Face recognition models are still loading. Please wait...')
      return
    }
    
    if (!modelsLoaded) {
      setError('Face recognition models failed to load. Please refresh the page.')
      return
    }
    
    setStep(2)
    setError('')
    await startCamera()
  }

  const startCamera = async () => {
    try {
      setError('')
      
      // Check if camera is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Camera access is not available in this browser. Please use a modern browser with camera support.')
        return
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'user', 
          width: { ideal: 640 }, 
          height: { ideal: 480 } 
        }
      })
      
      if (videoRef.current) {
        const video = videoRef.current
        video.srcObject = stream
        streamRef.current = stream
        
        // Wait for video metadata before setting active
        video.onloadedmetadata = () => {
          console.log('Camera metadata loaded')
          video.play().then(() => {
            console.log('Video playing')
            setCameraActive(true)
          }).catch(err => {
            console.error('Error playing video:', err)
            setError('Failed to start video playback: ' + err.message)
          })
        }
        
        video.onerror = (err) => {
          console.error('Video error:', err)
          setError('Video playback error. Please try again.')
        }
      }
    } catch (error) {
      console.error('Camera error:', error)
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setError('Camera permission denied. Please allow camera access and try again.')
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        setError('No camera found. Please connect a camera and try again.')
      } else {
        setError('Failed to access camera: ' + error.message)
      }
    }
  }

  const startFaceDetection = async () => {
    if (!modelsLoaded || !videoRef.current || !cameraActive) {
      console.log('Face detection not ready:', { modelsLoaded, video: !!videoRef.current, cameraActive })
      return
    }

    const video = videoRef.current
    const canvas = canvasRef.current

    // Ensure video is playing
    if (video.paused) {
      try {
        await video.play()
      } catch (err) {
        console.error('Error playing video:', err)
        return
      }
    }

    const detect = async () => {
      // Use refs so we always see latest values (fixes auto-capture toggle)
      if (step !== 2 || !cameraActive || capturedRef.current) {
        return
      }

      if (!video || video.readyState < 2 || video.paused || video.ended) {
        if (step === 2 && cameraActive && !capturedRef.current) {
          detectionLoopRef.current = requestAnimationFrame(detect)
        }
        return
      }

      try {
        const detection = await detectFace(video)
        
        if (detection && detection.detection) {
          setFaceDetected(true)
          
          // Draw detection on canvas (use willReadFrequently for getImageData)
          if (canvas) {
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
            const ctx = canvas.getContext('2d', { willReadFrequently: true })
            ctx.drawImage(video, 0, 0)
            
            const box = detection.detection.box
            ctx.strokeStyle = '#10b981'
            ctx.lineWidth = 2
            ctx.strokeRect(box.x, box.y, box.width, box.height)
          }

          // Validate quality (use Settings thresholds)
          if (canvas && detection.landmarks) {
            const ctx = canvas.getContext('2d', { willReadFrequently: true })
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
            const qualityResult = validateFaceQuality(imageData, detection, detection.landmarks, faceSettings)
            setQuality(qualityResult)

            // Auto-capture if quality is good (use refs, prevent double capture)
            if (autoCaptureRef.current && qualityResult.isValid && !capturedRef.current && !autoCaptureInProgressRef.current) {
              autoCaptureInProgressRef.current = true
              handleCapture(detection)
            }
          }
        } else {
          setFaceDetected(false)
          setQuality(null)
        }
      } catch (error) {
        console.error('Detection error:', error)
        setFaceDetected(false)
        setQuality(null)
      }

      if (step === 2 && cameraActive && !capturedRef.current) {
        detectionLoopRef.current = requestAnimationFrame(detect)
      }
    }

    detect()
  }

  const handleCapture = async (detection = null) => {
    if (!videoRef.current || !canvasRef.current) return

    try {
      setLoading(true)
      setError('')

      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(video, 0, 0)

      // Get detection if not provided
      let faceDetection = detection
      if (!faceDetection) {
        faceDetection = await detectFace(video)
      }

      if (!faceDetection) {
        setError('No face detected. Please ensure your face is clearly visible.')
        setLoading(false)
        autoCaptureInProgressRef.current = false
        return
      }

      // Validate quality (uses Settings thresholds)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const qualityResult = validateFaceQuality(imageData, faceDetection, faceDetection.landmarks, faceSettings)

      if (!qualityResult.isValid) {
        setError('Face quality is insufficient: ' + qualityResult.issues.join(', '))
        setLoading(false)
        autoCaptureInProgressRef.current = false
        return
      }

      // Extract descriptor (128-element array)
      if (!faceDetection.descriptor) {
        setError('Failed to extract face descriptor. Please try again.')
        setLoading(false)
        autoCaptureInProgressRef.current = false
        return
      }

      const descriptor = Array.from(faceDetection.descriptor)

      // Validate descriptor
      if (!descriptor || descriptor.length !== 128) {
        setError('Invalid face descriptor. Please try again.')
        setLoading(false)
        autoCaptureInProgressRef.current = false
        return
      }

      // Save to Appwrite
      const userId = selectedEmployee.user_id || selectedEmployee.$id
      if (!userId) {
        setError('Employee user ID is missing. Please select a valid employee.')
        setLoading(false)
        autoCaptureInProgressRef.current = false
        return
      }

      await saveFaceDescriptor(
        userId,
        currentCompany.$id,
        descriptor,
        qualityResult.sharpness,
        autoCapture ? 'auto' : 'manual'
      )

      setCaptured(true)
      capturedRef.current = true
      autoCaptureInProgressRef.current = false
      setSuccess('Face data saved successfully!')
      
      // Stop camera
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      setCameraActive(false)

      // Move to completion step
      setTimeout(() => {
        setStep(3)
      }, 1500)
    } catch (error) {
      setError('Failed to save face data: ' + error.message)
      console.error('Capture error:', error)
      autoCaptureInProgressRef.current = false
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete face data for this employee?')) {
      return
    }

    try {
      const userId = selectedEmployee.user_id || selectedEmployee.$id
      await deleteFaceDescriptor(userId)
      setHasFaceData(false)
      setSuccess('Face data deleted successfully')
      setTimeout(() => setSuccess(''), 3000)
    } catch (error) {
      setError('Failed to delete face data: ' + error.message)
    }
  }

  const handleReset = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
    }
    if (detectionLoopRef.current) {
      cancelAnimationFrame(detectionLoopRef.current)
    }
    setStep(1)
    setCameraActive(false)
    setFaceDetected(false)
    setQuality(null)
    setCaptured(false)
    capturedRef.current = false
    autoCaptureInProgressRef.current = false
    setError('')
    setSuccess('')
  }

  if (!currentCompany) {
    return (
      <div className="face-enrollment-page">
        <div className="alert alert-warning">
          Please select a company first.
        </div>
      </div>
    )
  }

  return (
    <div className="face-enrollment-page">
      <div className="page-header">
        <h1>Face Enrollment</h1>
      </div>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          {success}
        </div>
      )}

      {/* Step 1: Employee Selection */}
      {step === 1 && selfEnrollmentMode && !user?.prefs?.employeeId && (
        <div className="enrollment-step">
          <h2>Employee link required</h2>
          <div className="alert alert-warning">
            Your account is not linked to an employee record. Ask an administrator to assign your login to the correct
            employee in <strong>Employees</strong>.
          </div>
        </div>
      )}

      {step === 1 &&
        selfEnrollmentMode &&
        user?.prefs?.employeeId &&
        !selectedEmployee &&
        employees.length > 0 &&
        !employees.some((e) => e.$id === user.prefs.employeeId) && (
          <div className="enrollment-step">
            <h2>Employee not found</h2>
            <div className="alert alert-warning">
              Your account is linked to an employee ID that is not in this company&apos;s directory. Ask an administrator
              to check your employee record and company assignment.
            </div>
          </div>
        )}

      {step === 1 && selfEnrollmentMode && user?.prefs?.employeeId && !selectedEmployee && employees.length > 0 && employees.some((e) => e.$id === user.prefs.employeeId) && (
        <div className="enrollment-step">
          <h2>Step 1: Your profile</h2>
          <p className="face-enroll-self-hint">Loading your employee record…</p>
        </div>
      )}

      {step === 1 && selfEnrollmentMode && user?.prefs?.employeeId && selectedEmployee && (
        <div className="enrollment-step">
          <h2>Step 1: Confirm</h2>
          <p className="face-enroll-self-hint">
            You are enrolling face recognition for <strong>{selectedEmployee.name}</strong>
            {selectedEmployee.employee_id ? ` (ID: ${selectedEmployee.employee_id})` : ''}.
          </p>
          {hasFaceData && <div className="alert alert-info">Face data already exists. You can replace it below.</div>}
          <div className="selected-employee-actions">
            <div className="action-buttons">
              {hasFaceData && (
                <button type="button" className="btn-danger" onClick={handleDelete}>
                  Delete Face Data
                </button>
              )}
              <button
                type="button"
                className="btn-primary"
                onClick={handleNext}
                disabled={modelsLoading}
              >
                {modelsLoading ? 'Loading face recognition...' : 'Next: Capture Face'}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 1 && !selfEnrollmentMode && (
        <div className="enrollment-step">
          <h2>Step 1: Select Employee</h2>
          <div className="employee-selector">
            {employees.length === 0 ? (
              <div className="empty-state">No employees found. Add employees first.</div>
            ) : (
              <>
                <input
                  type="search"
                  className="face-enroll-emp-search"
                  placeholder="Filter by name, ID, department…"
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  autoComplete="off"
                  aria-label="Filter employees"
                />
                {filteredFaceEmployees.length === 0 ? (
                  <div className="empty-state">No employees match your filter.</div>
                ) : (
                  <div className="employee-grid">
                    {filteredFaceEmployees.map((employee) => (
                      <div
                        key={employee.$id}
                        className={`employee-card ${selectedEmployee?.$id === employee.$id ? 'selected' : ''}`}
                        onClick={() => handleEmployeeSelect(employee)}
                      >
                        <div className="employee-name">{employee.name}</div>
                        <div className="employee-details">
                          {employee.employee_id && <span>ID: {employee.employee_id}</span>}
                          {employee.department && <span>{employee.department}</span>}
                        </div>
                        {hasFaceData && selectedEmployee?.$id === employee.$id && (
                          <div className="face-data-indicator">✓ Face data exists</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {selectedEmployee && (
              <div className="selected-employee-actions">
                <div className="selected-employee-info">
                  <h3>{selectedEmployee.name}</h3>
                  {hasFaceData && (
                    <div className="face-data-badge">
                      Face data registered
                    </div>
                  )}
                </div>
                <div className="action-buttons">
                  {hasFaceData && (
                    <button
                      className="btn-danger"
                      onClick={handleDelete}
                    >
                      Delete Face Data
                    </button>
                  )}
                  <button
                    className="btn-primary"
                    onClick={handleNext}
                    disabled={modelsLoading}
                  >
                    {modelsLoading ? 'Loading face recognition...' : 'Next: Capture Face'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Face Capture */}
      {step === 2 && (
        <div className="enrollment-step">
          <h2>Step 2: Capture Face</h2>
          
          <div className="capture-container">
            <div className="video-wrapper">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="enrollment-video"
              />
              <canvas ref={canvasRef} className="enrollment-canvas" />
              
              {!faceDetected && (
                <div className="face-guide">
                  <p>Position your face in the frame</p>
                </div>
              )}

              {faceDetected && quality && (
                <div className="quality-indicators">
                  <div className={`quality-item ${quality.brightness >= 30 && quality.brightness <= 90 ? 'good' : 'bad'}`}>
                    Brightness: {quality.brightness.toFixed(1)}%
                  </div>
                  <div className={`quality-item ${quality.faceCoverage >= 15 && quality.faceCoverage <= 60 ? 'good' : 'bad'}`}>
                    Face Size: {quality.faceCoverage.toFixed(1)}%
                  </div>
                  <div className={`quality-item ${quality.faceAngle < 15 ? 'good' : 'bad'}`}>
                    Angle: {quality.faceAngle.toFixed(1)}°
                  </div>
                  <div className={`quality-item ${quality.sharpness >= 50 ? 'good' : 'bad'}`}>
                    Sharpness: {quality.sharpness.toFixed(0)}
                  </div>
                </div>
              )}
            </div>

            <div className="capture-controls">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={autoCapture}
                  onChange={(e) => setAutoCapture(e.target.checked)}
                />
                Auto-capture when quality is good
              </label>

              {quality && !quality.isValid && (
                <div className="quality-issues">
                  <strong>Issues:</strong>
                  <ul>
                    {quality.issues.map((issue, idx) => (
                      <li key={idx}>{issue}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="capture-buttons">
                <button
                  className="btn-secondary"
                  onClick={handleReset}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  onClick={() => handleCapture()}
                  disabled={loading || !faceDetected || (quality && !quality.isValid)}
                >
                  {loading ? 'Saving...' : 'Capture Now'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Completion */}
      {step === 3 && (
        <div className="enrollment-step">
          <h2>Step 3: Enrollment Complete!</h2>
          <div className="completion-message">
            <div className="success-icon">✓</div>
            <p>Face data for <strong>{selectedEmployee?.name}</strong> has been successfully enrolled.</p>
            <button className="btn-primary" onClick={handleReset}>
              Enroll Another Employee
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default FaceEnrollment
