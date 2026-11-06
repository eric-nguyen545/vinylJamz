import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { Sidebar } from './Sidebar'

describe('Sidebar', () => {
  it('links every built page, and nothing is marked unavailable', () => {
    render(<MemoryRouter><Sidebar /></MemoryRouter>)
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'My Collection' })).toHaveAttribute('href', '/collection')
    expect(screen.getByRole('link', { name: 'Wantlist' })).toHaveAttribute('href', '/wantlist')
    expect(screen.getByRole('link', { name: 'Map Explorer' })).toHaveAttribute('href', '/map')
    expect(screen.getByRole('link', { name: 'Statistics' })).toHaveAttribute('href', '/statistics')
    expect(screen.getByRole('link', { name: 'Music Journal' })).toHaveAttribute('href', '/journal')
    expect(screen.getByRole('link', { name: 'Backup and Export' })).toHaveAttribute('href', '/data')
    expect(screen.getByRole('link', { name: 'Gear' })).toHaveAttribute('href', '/gear')
    expect(screen.getByRole('link', { name: 'Admin' })).toHaveAttribute('href', '/admin')
    expect(screen.queryByText('Soon')).toBeNull()
  })
})

describe('Sidebar collapse', () => {
  it('collapses to icons, keeps every link reachable by name, and remembers the choice', async () => {
    const { default: userEvent } = await import('@testing-library/user-event')
    localStorage.clear()
    const first = render(<MemoryRouter><Sidebar /></MemoryRouter>)
    const toggle = screen.getByRole('button', { name: 'Collapse sidebar' })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await userEvent.click(toggle)
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Statistics' })).toHaveAttribute('title', 'Statistics')
    expect(localStorage.getItem('vinyl-archive:sidebar-collapsed')).toBe('1')
    first.unmount()
    render(<MemoryRouter><Sidebar /></MemoryRouter>)
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument()
    localStorage.clear()
  })
})
