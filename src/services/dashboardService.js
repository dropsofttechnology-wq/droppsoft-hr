import { Query } from 'appwrite'
import { databases, DATABASE_ID, COLLECTIONS } from '../config/appwrite'
import { format } from 'date-fns'

export const getAttendanceStats = async (companyId) => {
  try {
    const today = format(new Date(), 'yyyy-MM-dd')
    const monthStart = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd')
    
    // Get today's attendance
    const todayAttendance = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.ATTENDANCE,
      [
        Query.equal('company_id', companyId),
        Query.equal('date', today),
        Query.limit(5000)
      ]
    )

    // Get month's attendance
    const monthAttendance = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.ATTENDANCE,
      [
        Query.equal('company_id', companyId),
        Query.greaterThanEqual('date', monthStart),
        Query.limit(5000)
      ]
    )

    return {
      todayPresent: todayAttendance.documents.length,
      monthPresent: monthAttendance.documents.length
    }
  } catch (error) {
    console.error('Error fetching attendance stats:', error)
    return { todayPresent: 0, monthPresent: 0 }
  }
}

export const getPayrollStats = async (companyId) => {
  try {
    const currentPeriod = format(new Date(), 'yyyy-MM')
    
    // Get current period payroll
    const payroll = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.PAYROLL_RUNS,
      [
        Query.equal('company_id', companyId),
        Query.equal('period', currentPeriod),
        Query.limit(1)
      ]
    )

    // Get total employees
    const employees = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.EMPLOYEES,
      [
        Query.equal('company_id', companyId),
        Query.equal('status', 'active'),
        Query.limit(5000)
      ]
    )

    return {
      processed: payroll.documents.length > 0,
      totalEmployees: employees.documents.length
    }
  } catch (error) {
    console.error('Error fetching payroll stats:', error)
    return { processed: false, totalEmployees: 0 }
  }
}
