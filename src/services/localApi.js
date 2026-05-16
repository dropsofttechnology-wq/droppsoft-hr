import { getApiBaseUrl } from '../config/api'
import { LOCAL_USER_ID_KEY } from '../config/constants'

/**
 * fetch() to the local API with x-user-id when logged in.
 */
export async function localApiFetch(path, options = {}) {
  const base = await getApiBaseUrl()
  if (!base) {
    throw new Error('Local API base URL is not configured')
  }
  const id = typeof localStorage !== 'undefined' ? localStorage.getItem(LOCAL_USER_ID_KEY) : null
  const headers = new Headers(options.headers || {})
  if (
    !headers.has('Content-Type') &&
    options.body &&
    typeof options.body === 'string'
  ) {
    headers.set('Content-Type', 'application/json')
  }
  // FormData: let the browser set multipart boundary
  if (id) {
    headers.set('x-user-id', id)
  }
  return fetch(`${base}${path.startsWith('/') ? path : `/${path}`}`, {
    ...options,
    headers
  })
}
