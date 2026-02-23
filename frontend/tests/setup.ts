import "@testing-library/jest-dom"

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

// Provide Supabase envs for tests (avoid createBrowserClient errors)
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co"
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key"
