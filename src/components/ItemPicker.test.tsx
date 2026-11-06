import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ItemPicker } from './ItemPicker'

const items = [{ id: 'a', label: 'Kind of Blue', sub: 'by Miles Davis' }, { id: 'b', label: 'Blue Train', sub: 'by John Coltrane' }, { id: 'c', label: 'Abbey Road', sub: 'by The Beatles' }]
function Harness({ start = [] as string[] }) {
  const [sel, setSel] = useState(new Set(start))
  return <ItemPicker title="Albums" items={items} selected={sel} onChange={setSel} />
}

describe('ItemPicker', () => {
  it('shows how many are public and toggles single items', async () => {
    render(<Harness start={['a']} />)
    expect(screen.getByText(/1 of 3 public/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('checkbox', { name: /Blue Train/ }))
    expect(screen.getByText(/2 of 3 public/)).toBeInTheDocument()
    expect(within(screen.getByRole('checkbox', { name: /Blue Train/ }).closest('label')!).getByText('Public')).toBeInTheDocument()
  })
  it('bulk actions apply only to what the filter shows', async () => {
    render(<Harness />)
    await userEvent.type(screen.getByRole('searchbox'), 'blue')
    expect(screen.queryByRole('checkbox', { name: /Abbey Road/ })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Make matching public' }))
    expect(screen.getByText(/2 of 3 public/)).toBeInTheDocument()
    await userEvent.clear(screen.getByRole('searchbox'))
    expect(screen.getByRole('checkbox', { name: /Abbey Road/ })).not.toBeChecked()
    await userEvent.click(screen.getByRole('button', { name: 'Make all private' }))
    expect(screen.getByText(/0 of 3 public/)).toBeInTheDocument()
  })
  it('shows a helpful message when there is nothing to pick', () => {
    render(<ItemPicker title="Gear" items={[]} selected={new Set()} onChange={() => {}} emptyText="You haven’t added any gear." />)
    expect(screen.getByText('You haven’t added any gear.')).toBeInTheDocument()
  })
})
