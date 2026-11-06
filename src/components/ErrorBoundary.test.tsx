import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from './ErrorBoundary'
import { initErrorMessage } from '../app/AuthContext'

function Boom(): never { throw new Error('kaboom') }

describe('ErrorBoundary', () => {
  it('shows the error instead of a blank page', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    expect(screen.getByRole('heading', { name: 'Something broke' })).toBeInTheDocument()
    expect(screen.getByText('kaboom')).toBeInTheDocument()
  })
  it('renders children normally', () => {
    render(<ErrorBoundary><p>fine</p></ErrorBoundary>)
    expect(screen.getByText('fine')).toBeInTheDocument()
  })
})

describe('initErrorMessage', () => {
  it('explains an invalid API key', () => {
    expect(initErrorMessage({ code: 'auth/invalid-api-key' })).toMatch(/VITE_FIREBASE_API_KEY/)
    expect(initErrorMessage(new Error('x'))).toBe('x')
  })
})
