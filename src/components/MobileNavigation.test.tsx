import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { MobileNavigation } from './MobileNavigation'

describe('MobileNavigation', () => {
  it('shows the everyday pages and tucks the rest under More', async () => {
    render(<MemoryRouter><MobileNavigation /></MemoryRouter>)
    for (const n of ['Dashboard', 'My Collection', 'Wantlist', 'Music Journal']) expect(screen.getByRole('link', { name: n })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Statistics' })).toBeNull()
    const more = screen.getByRole('button', { name: 'More' })
    expect(more).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(more)
    expect(more).toHaveAttribute('aria-expanded', 'true')
    for (const n of ['Map Explorer', 'Gear', 'Statistics', 'Admin', 'Backup and Export', 'Settings']) expect(screen.getByRole('link', { name: n })).toBeInTheDocument()
  })
  it('closes the menu with Escape', async () => {
    render(<MemoryRouter><MobileNavigation /></MemoryRouter>)
    await userEvent.click(screen.getByRole('button', { name: 'More' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('link', { name: 'Statistics' })).toBeNull()
  })
})
