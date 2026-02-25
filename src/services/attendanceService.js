import { Query } from 'appwrite'
import { databases, DATABASE_ID, COLLECTIONS } from '../config/appwrite'
import { format } from 'date-fns'
import { getCompanySettingNumber } from '../utils/settingsHelper'

export const logAttendance = async (attendanceData) => {
  try {
    const today = format(new Date(), 'yyyy-MM-dd')
    
    // Check if attendance record exists for today
    const existing = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.ATTENDANCE,
      [
        Query.equal('user_id', attendanceData.user_id),
        Query.equal('date', today),
        Query.limit(1)
      ]
    )

    const attendanceRecord = {
      user_id: attendanceData.user_id,
      company_id: attendanceData.company_id,
      date: today,
      auth_method: attendanceData.auth_method || 'manual',
      location_lat: attendanceData.location_lat || null,
      location_lng: attendanceData.location_lng || null,
      location_address: attendanceData.location_address || '',
      reason: attendanceData.reason || '',
      updated_at: new Date().toISOString()
    }

    // Determine if clock-in or clock-out
    if (existing.documents.length > 0) {
      const record = existing.documents[0]
      if (record.clock_in_time && !record.clock_out_time) {
        // Clock out
        attendanceRecord.clock_in_time = record.clock_in_time
        attendanceRecord.clock_out_time = new Date().toISOString()
        
        // Calculate hours worked
        const clockIn = new Date(record.clock_in_time)
        const clockOut = new Date()
        const hoursWorked = (clockOut - clockIn) / (1000 * 60 * 60)
        attendanceRecord.hours_worked = hoursWorked
        
        // Calculate overtime hours based on company working hours setting
        const standardHours = await getCompanySettingNumber(attendanceData.company_id, 'working_hours', 8)
        attendanceRecord.overtime_hours = Math.max(0, hoursWorked - standardHours)

        return await databases.updateDocument(
          DATABASE_ID,
          COLLECTIONS.ATTENDANCE,
          record.$id,
          attendanceRecord
        )
      } else {
        // Already clocked out, create new record for next day or error
        throw new Error('Already clocked out for today')
      }
    } else {
      // Clock in
      attendanceRecord.clock_in_time = new Date().toISOString()
      attendanceRecord.hours_worked = 0

      return await databases.createDocument(
        DATABASE_ID,
        COLLECTIONS.ATTENDANCE,
        'unique()',
        attendanceRecord
      )
    }
  } catch (error) {
    console.error('Error logging attendance:', error)
    throw error
  }
}

export const getAttendanceStatus = async (userId) => {
  try {
    const today = format(new Date(), 'yyyy-MM-dd')
    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.ATTENDANCE,
      [
        Query.equal('user_id', userId),
        Query.equal('date', today),
        Query.limit(1)
      ]
    )

    if (response.documents.length === 0) {
      return { status: 'not_clocked_in', clock_in_time: null, clock_out_time: null }
    }

    const record = response.documents[0]
    if (record.clock_in_time && !record.clock_out_time) {
      return { status: 'clocked_in', clock_in_time: record.clock_in_time, clock_out_time: null }
    } else {
      return { status: 'clocked_out', clock_in_time: record.clock_in_time, clock_out_time: record.clock_out_time }
    }
  } catch (error) {
    console.error('Error getting attendance status:', error)
    throw error
  }
}

export const findEmployeeByQR = async (qrToken, companyId) => {
  try {
    // QR token should be employee_id or staff_no
    const employees = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.EMPLOYEES,
      [
        Query.equal('company_id', companyId),
        Query.equal('status', 'active'),
        Query.limit(5000)
      ]
    )

    // Find employee by employee_id or staff_no matching QR token
    const employee = employees.documents.find(
      emp => emp.employee_id === qrToken || emp.staff_no === qrToken
    )

    return employee || null
  } catch (error) {
    console.error('Error finding employee by QR:', error)
    throw error
  }
}

export const findEmployeeByFace = async (descriptor, companyId, allDescriptors) => {
  // This will be done client-side using face-api.js FaceMatcher
  // We just need to return the user_id from the matched descriptor
  // allDescriptors should be an array of { user_id, descriptor }
  
  // For now, return the matched user_id from the client-side matching
  return null // Client-side matching will return user_id
}
