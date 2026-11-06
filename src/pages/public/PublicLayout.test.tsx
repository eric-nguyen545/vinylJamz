import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const site = vi.hoisted(() => ({ value: { status: 'loading' } as unknown }))
const auth = vi.hoisted(() => ({ value: { status: 'signed-out' } as unknown }))
vi.mock('../../lib/usePublicData', () => ({ usePublicSite: () => site.value }))
vi.mock('../../app/AuthContext', () => ({ useAuth: () => ({ state: auth.value }) }))

import { PublicLayout } from './PublicLayout'

const ready = (sections: Record<string, boolean>) => ({ status: 'ready', shareId: 'a'.repeat(32), site: { displayName: 'Eric’s Records', bio: 'Jazz mostly', sections: { collection: true, wantlist: false, journal: false, gear: false, places: false, stats: false, ...sections } } })
const renderAt = (path = '/view') => render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/view" element={<PublicLayout />}><Route index element={<p>collection page</p>} /></Route></Routes></MemoryRouter>)

describe('public layout (what a visitor sees)', () => {
  beforeEach(() => { auth.value = { status: 'signed-out' } })

  it('tells visitors a private collection is private, and offers owner sign-in, never an edit page', () => {
    site.value = { status: 'unavailable' }
    renderAt()
    expect(screen.getByRole('heading', { name: 'This collection is private' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Owner sign in' })).toHaveAttribute('href', '/login')
    expect(screen.queryByRole('link', { name: 'Open admin' })).toBeNull()
  })
  it('shows the site name and only the sections the owner switched on', () => {
    site.value = ready({ wantlist: true, stats: true })
    renderAt()
    expect(screen.getByRole('heading', { level: 1, name: 'Eric’s Records' })).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Sections' })
    expect(nav).toHaveTextContent('Collection')
    expect(nav).toHaveTextContent('Wantlist')
    expect(nav).toHaveTextContent('Statistics')
    expect(nav).not.toHaveTextContent('Gear')
    expect(nav).not.toHaveTextContent('Listening journal')
    expect(nav).not.toHaveTextContent('Map')
  })
  it('hides the section bar when only the collection is shared', () => {
    site.value = ready({})
    renderAt()
    expect(screen.queryByRole('navigation', { name: 'Sections' })).toBeNull()
    expect(screen.getByText('collection page')).toBeInTheDocument()
  })
  it('is read-only: no form controls or edit links anywhere in the shell', () => {
    site.value = ready({ wantlist: true })
    renderAt()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByText(/Only the owner can make changes/)).toBeInTheDocument()
  })
  it('gives the signed-in owner a way back to the admin', () => {
    auth.value = { status: 'owner', user: { uid: 'u' } }
    site.value = ready({})
    renderAt()
    expect(screen.getByRole('link', { name: 'Open admin' })).toHaveAttribute('href', '/')
    expect(screen.queryByRole('link', { name: 'Owner sign in' })).toBeNull()
  })
})
