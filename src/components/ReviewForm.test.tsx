import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ReviewForm } from './ReviewForm'
import { emptyReviewForm, type ReviewFormState } from '../lib/reviewForm'

const tracks = ['One', 'Two', 'Three', 'Four'].map((title, i) => ({ id: `t${i}`, position: `A${i + 1}`, title }))

function Harness({ onSubmit = () => {} }: { onSubmit?: () => void }) {
  const [v, setV] = useState<ReviewFormState>(emptyReviewForm())
  return <ReviewForm value={v} errors={{}} tracklist={tracks} ratingMax={10} onChange={setV} onSubmit={onSubmit} onCancel={() => {}} />
}

describe('ReviewForm', () => {
  it('lets you pick at most three top tracks', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    for (const t of ['One', 'Two', 'Three']) await user.click(screen.getByRole('checkbox', { name: new RegExp(t) }))
    expect(screen.getByRole('checkbox', { name: /Four/ })).toBeDisabled()
    await user.click(screen.getByRole('checkbox', { name: /Two/ }))
    expect(screen.getByRole('checkbox', { name: /Four/ })).toBeEnabled()
  })

  it('adds vibes with Enter without submitting, and removes them', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<Harness onSubmit={onSubmit} />)
    await user.type(screen.getByLabelText('Vibes'), 'Late Night{Enter}')
    expect(screen.getByText('late night')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Remove late night' }))
    expect(screen.queryByText('late night')).toBeNull()
  })
})
