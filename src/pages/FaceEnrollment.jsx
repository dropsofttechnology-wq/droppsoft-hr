import { useState, useEffect, useRef } from 'react'
import { useCompany } from '../contexts/CompanyContext'
import { useAuth } from '../contexts/AuthContext'
import { getEmployees } from '../services/employeeService'
import { checkFaceData, saveFaceDescriptor, deleteFaceDescriptor } from '../services/faceService'
import { useFaceRecognition } from '../hooks/useFaceRecognition'
import { validateFaceQuality } from '../utils/faceQuality'
import './FaceEnrollment.css'

const FaceEnrollment = () => {
  const { currentCompany } = useCompany()
  const { user } = useAuth()
  const { modelsLoaded, loading: modelsLoading, detectFace } = useFaceRecognition()
  
  const [employees, setEmployees] = useState([])
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [hasFaceData, setHasFaceData] = useState(false)
  const [step, setStep] = useState(1) // 1: Select Employee, 2: Capture Face, 3: Complete
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  // Camera and video
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [faceDetected, setFaceDetected] = useState(false)
  const [quality, setQuality] = useState(null)
  const [autoCapture, setAutoCapture] = useState(false)
  const [captured, setCaptured] = useState(false)

  useEffect(() => {
    if (currentCompany) {
      loadEmployees()
    }
  }, [currentCompany])

  useEffect(() => {
    if (selectedEmployee) {
      checkExistingFaceData()
    }
  }, [selectedEmployee])

  useEffect(() => {
    if (step === 2 && cameraActive) {
      startFaceDetection()
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [step, cameraActive, modelsLoaded])

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

  const handleNext = () => {
    if (!selectedEmployee) {
      setError('Please select an employee')
      return
    }
    setStep(2)
    startCamera()
  }

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 }
      })
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
        setCameraActive(true)
      }
    } catch (error) {
      setError('Failed to access camera. Please allow camera permissions.')
      console.error('Camera error:', error)
    }
  }

  const startFaceDetection = async () => {
    if (!modelsLoaded || !videoRef.current || !cameraActive) return

    const video = videoRef.current
    const canvas = canvasRef.current

    const detect = async () => {
      if (!video || video.readyState !== 4) {
        requestAnimationFrame(detect)
        return
      }

      try {
        const detection = await detectFace(video)
        
        if (detection) {
          setFaceDetected(true)
          
          // Draw detection on canvas
          if (canvas) {
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
            const ctx = canvas.getContext('2d')
            ctx.drawImage(video, 0, 0)
            
            // Draw face box
            const box = detection.detection.box
            ctx.strokeStyle = '#10b981'
            ctx.lineWidth = 2
            ctx.strokeRect(box.x, box.y, box.width, box.height)
          }

          // Validate quality
          if (canvas) {
            const imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height)
            const qualityResult = validateFaceQuality(imageData, detection, detection.landmarks)
            setQuality(qualityResult)

            // Auto-capture if quality is good
            if (autoCapture && qualityResult.isValid && !captured) {
              handleCapture(detection)
            }
          }
        } else {
          setFaceDetected(false)
          setQuality(null)
        }
      } catch (error) {
        console.error('Detection error:', error)
      }

      if (step === 2 && cameraActive && !captured) {
        requestAnimationFrame(detect)
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
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0)

      // Get detection if not provided
      let faceDetection = detection
      if (!faceDetection) {
        faceDetection = await detectFace(video)
      }

      if (!faceDetection) {
        setError('No face detected. Please ensure your face is clearly visible.')
        setLoading(false)
        return
      }

      // Validate quality
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const qualityResult = validateFaceQuality(imageData, faceDetection, faceDetection.landmarks)

      if (!qualityResult.isValid) {
        setError('Face quality is insufficient: ' + qualityResult.issues.join(', '))
        setLoading(false)
        return
      }

      // Extract descriptor (128-element array)
      const descriptor = Array.from(faceDetection.descriptor)

      // Save to Appwrite
      const userId = selectedEmployee.user_id || selectedEmployee.$id
      await saveFaceDescriptor(
        userId,
        currentCompany.$id,
        descriptor,
        qualityResult.sharpness,
        autoCapture ? 'auto' : 'manual'
      )

      setCaptured(true)
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
    setStep(1)
    setCameraActive(false)
    setFaceDetected(false)
    setQuality(null)
    setCaptured(false)
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
      {step === 1 && (
        <div className="enrollment-step">
          <h2>Step 1: Select Employee</h2>
          <div className="employee-selector">
            {employees.length === 0 ? (
              <div className="empty-state">No employees found. Add employees first.</div>
            ) : (
              <div className="employee-grid">
                {employees.map(employee => (
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
                      <div className="face-data-indicator">
                        ✓ Face data exists
                      </div>
                    )}
                  </div>
                ))}
              </div>
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
