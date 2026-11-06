import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PublicAlbumCard, PublicAlbumDetails, type PublicAlbum } from './PublicAlbumViews'

const base: PublicAlbum = { id: 'a1', title: 'Kind of Blue', artistNames: ['Miles Davis'], genres: ['Jazz'], releaseYear: 1959 }

describe('public album views', () => {
  it('shows only what was published', () => {
    render(<PublicAlbumDetails album={base} />)
    expect(screen.getByText('Kind of Blue')).toBeInTheDocument()
    expect(screen.queryByText(/\/ 10/)).toBeNull()
    expect(screen.queryByText('Top tracks')).toBeNull()
    expect(screen.queryByText('Pressings')).toBeNull()
  })

  it('shows opt-in fields when present', () => {
    render(<PublicAlbumDetails album={{ ...base, rating: 9.5, review: 'Perfect.', vibes: ['late night'], topThreeTracks: ['So What'], publicPressingSummary: ['LP · 1959 · US'] }} />)
    expect(screen.getByText('9.5 / 10')).toBeInTheDocument()
    expect(screen.getByText('Perfect.')).toBeInTheDocument()
    expect(screen.getByText('late night')).toBeInTheDocument()
    expect(screen.getByText('So What')).toBeInTheDocument()
    expect(screen.getByText('LP · 1959 · US')).toBeInTheDocument()
  })

  it('shows Discogs community numbers and prices only when they were published', () => {
    const { rerender } = render(<PublicAlbumDetails album={base} />)
    expect(screen.queryByText('Discogs community')).toBeNull()
    expect(screen.queryByText('Paid')).toBeNull()
    rerender(<PublicAlbumDetails album={{ ...base, discogs: { rating: 4.62, ratingCount: 980, have: 1200, want: 3400, url: 'https://www.discogs.com/release/9' }, purchases: [{ price: 25, currency: 'USD', date: '2025-01-02' }] }} />)
    expect(screen.getByText('Discogs community')).toBeInTheDocument()
    expect(screen.getByText(/4\.62 \/ 5/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View on Discogs' })).toHaveAttribute('href', 'https://www.discogs.com/release/9')
    expect(screen.getByText('Paid')).toBeInTheDocument()
    expect(screen.getByText(/\$25\.00/)).toBeInTheDocument()
  })

  it('opens an album from its card', async () => {
    const onOpen = vi.fn()
    render(<ul><PublicAlbumCard album={base} onOpen={onOpen} /></ul>)
    await userEvent.click(screen.getByRole('button', { name: /Kind of Blue/ }))
    expect(onOpen).toHaveBeenCalledWith(base)
  })
})
