import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ChartCard } from './ChartCard'

describe('ChartCard', () => {
  it('exposes chart data as a table', () => {
    render(<ChartCard title="Albums by decade" columns={['Decade', 'Albums']} rows={[['1950s', 3], ['1960s', 5]]}><div>chart</div></ChartCard>)
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: '1960s' })).toBeInTheDocument()
  })
  it('says so when there is nothing to chart', () => {
    render(<ChartCard title="Empty" columns={['A', 'B']} rows={[]}><div>chart</div></ChartCard>)
    expect(screen.getByText('Not enough data yet.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
  })
})
