import { useState, useMemo, useEffect } from 'react'
import { filterEmployeesByQuery } from '../utils/employeePickerUtils'
import './EmployeePicker.css'

/**
 * Search-as-you-type filter above a native &lt;select&gt; of employees.
 */
export default function EmployeePicker({
  employees = [],
  value,
  onChange,
  disabled = false,
  id,
  name,
  required = false,
  filterPlaceholder = 'Type to filter by name, ID, department…',
  selectPlaceholder = 'Select employee',
  className = ''
}) {
  const [filter, setFilter] = useState('')

  const options = useMemo(
    () => filterEmployeesByQuery(employees, filter, value || ''),
    [employees, filter, value]
  )

  useEffect(() => {
    if (!value) setFilter('')
  }, [value])

  return (
    <div className={`employee-picker ${className}`.trim()}>
      <input
        type="search"
        className="employee-picker-filter"
        placeholder={filterPlaceholder}
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        disabled={disabled}
        autoComplete="off"
        aria-label="Filter employees"
      />
      <select
        id={id}
        name={name}
        value={value || ''}
        onChange={onChange}
        disabled={disabled}
        required={required}
        className="employee-picker-select"
      >
        <option value="">{selectPlaceholder}</option>
        {options.map((emp) => (
          <option key={emp.$id} value={emp.$id}>
            {emp.name}
            {emp.employee_id ? ` (${emp.employee_id})` : ''}
            {emp.department ? ` — ${emp.department}` : ''}
          </option>
        ))}
      </select>
    </div>
  )
}
