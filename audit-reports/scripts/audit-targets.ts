/** These audit fixtures reset data: only the named isolated test ports are allowed. */
export function auditTargets() {
  const baseURL = process.env.BASE_URL ?? 'http://localhost:8080'
  const apiURL = process.env.API_BASE_URL ?? 'http://api-test:8000'
  const allowedWeb = ['http://localhost:8080', 'http://127.0.0.1:8080']
  const allowedApi = ['http://api-test:8000', 'http://localhost:8123', 'http://127.0.0.1:8123']
  if (!allowedWeb.includes(new URL(baseURL).origin) || !allowedApi.includes(new URL(apiURL).origin)) {
    throw new Error('Audit fixtures require the isolated web8080/api-test8000(or local8123) stack; never the user preview or a remote service')
  }
  return { baseURL, apiURL }
}
