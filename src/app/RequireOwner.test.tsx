import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({ value: { status: 'signed-out' } as unknown }))
vi.mock('./AuthContext', () => ({ useAuth: () => ({ state: auth.value, signOut: vi.fn() }) }))

import { RequireOwner } from './RequireOwner'

const renderAt = () => render(
  <MemoryRouter initialEntries={['/collection/add']}>
    <Routes>
      <Route path="/view" element={<p>public site</p>} />
      <Route path="/login" element={<p>login page</p>} />
      <Route element={<RequireOwner />}><Route path="/collection/add" element={<p>edit page</p>} /></Route>
    </Routes>
  </MemoryRouter>,
)

describe('RequireOwner (editing needs the owner login)', () => {
  beforeEach(() => { auth.value = { status: 'signed-out' } })
  it('sends signed-out visitors to the public site, never to an edit page', () => {
    renderAt()
    expect(screen.getByText('public site')).toBeInTheDocument()
    expect(screen.queryByText('edit page')).toBeNull()
  })
  it('blocks a signed-in account that is not the owner', () => {
    auth.value = { status: 'not-owner', uid: 'someone', email: 'x@y.z' }
    renderAt()
    expect(screen.queryByText('edit page')).toBeNull()
    expect(screen.getByRole('heading', { name: 'This account isn’t the owner' })).toBeInTheDocument()
  })
  it('shows a start-up problem instead of an edit page', () => {
    auth.value = { status: 'error', message: 'bad key' }
    renderAt()
    expect(screen.queryByText('edit page')).toBeNull()
    expect(screen.getByRole('alert')).toHaveTextContent('bad key')
  })
  it('lets the owner through', () => {
    auth.value = { status: 'owner', user: { uid: 'u' } }
    renderAt()
    expect(screen.getByText('edit page')).toBeInTheDocument()
  })
})
