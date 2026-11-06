import { useMemo } from 'react'
import { ErrorState, LoadingState } from '../../components/States'
import { GEAR_CATEGORY_LABEL } from '../../lib/gearForm'
import { formatDay } from '../../lib/format'
import { publicGearSchema, type GearCategory } from '../../lib/schemas'
import { investmentTotals } from '../../lib/stats'
import { usePublicList } from '../../lib/usePublicData'
import { SectionOff, usePublicContext } from './PublicLayout'

const money = (n: number, c: string) => { try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: c }).format(n) } catch { return `${n} ${c}` } }

export function PublicGearPage() {
  const { shareId, site } = usePublicContext()
  const { items, error } = usePublicList(shareId, 'gear', publicGearSchema)
  const sorted = useMemo(() => [...(items ?? [])].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)), [items])
  const totals = useMemo(() => investmentTotals([], items ?? []).filter((t) => t.gearItems > 0), [items])
  if (!site.sections.gear) return <SectionOff />
  if (error) return <ErrorState title="Couldn’t load the gear" message={error} />
  if (!items) return <LoadingState label="Loading gear" />
  if (items.length === 0) return <p className="text-dust">No gear is shared right now.</p>
  return (
    <>
      {totals.length > 0 && <p className="mb-4 text-sm text-dust">Total spent on shared gear: {totals.map((t) => money(t.gear, t.currency)).join(' + ')}</p>}
      <ul className="grid gap-3 md:grid-cols-2">
        {sorted.map((g) => (
          <li key={g.id} className="rounded-2xl bg-sleeve p-4">
            <h2 className="text-lg font-medium">{g.name}</h2>
            <p className="text-sm text-dust">{GEAR_CATEGORY_LABEL[g.category as GearCategory] ?? g.category}{g.brand || g.model ? `, ${[g.brand, g.model].filter(Boolean).join(' ')}` : ''}</p>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 text-sm">
              {g.condition && <><dt className="text-dust">Condition</dt><dd className="capitalize">{g.condition}</dd></>}
              {g.purchaseDate && <><dt className="text-dust">Bought</dt><dd>{formatDay(g.purchaseDate)}</dd></>}
              {g.purchasePrice !== undefined && g.currency && <><dt className="text-dust">Paid</dt><dd>{money(g.purchasePrice, g.currency)}</dd></>}
            </dl>
          </li>
        ))}
      </ul>
    </>
  )
}
