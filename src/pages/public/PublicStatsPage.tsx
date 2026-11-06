import { useMemo, useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ChartCard } from '../../components/ChartCard'
import { ErrorState, LoadingState } from '../../components/States'
import { formatRating } from '../../lib/rating'
import { publicAlbumSchema, publicGearSchema } from '../../lib/schemas'
import { averageRating } from '../../lib/rating'
import { cumulativeInvestment, decadeCounts, genrePie, investmentTotals, ratingDistribution, topArtists } from '../../lib/stats'
import { usePublicList } from '../../lib/usePublicData'
import { SectionOff, usePublicContext } from './PublicLayout'

const GOLD = '#e3b04b'
const BLUE = '#7aa2f7'
const PIE = ['#e3b04b', '#7aa2f7', '#6fcf97', '#f28b82', '#bb86fc', '#4dd0e1', '#f2994a', '#d4e157', '#6b6f85']
const axis = { fill: '#a0a2b6', fontSize: 12 }
const tip = { contentStyle: { background: '#242734', border: '1px solid #2e3140', borderRadius: 8, color: '#ece9f1' }, cursor: { fill: 'rgba(255,255,255,0.05)' } }
const money = (n: number, c: string) => { try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: c }).format(n) } catch { return `${n} ${c}` } }

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div className="rounded-2xl bg-sleeve p-5"><dt className="text-sm text-dust">{label}</dt><dd className="mt-1 font-display text-3xl font-bold">{value}</dd>{sub && <dd className="text-xs text-dust">{sub}</dd>}</div>
}

/** Everything here is computed in the visitor's browser from the documents the owner chose to publish. */
export function PublicStatsPage() {
  const { shareId, site } = usePublicContext()
  const albums = usePublicList(shareId, 'albums', publicAlbumSchema)
  const gear = usePublicList(shareId, 'gear', publicGearSchema)
  const [currency, setCurrency] = useState<string | null>(null)

  const s = useMemo(() => {
    const a = albums.items ?? []
    const copies = a.flatMap((x) => (x.purchases ?? []).map((p) => ({ albumId: x.id, purchasePrice: p.price, currency: p.currency, purchaseDate: p.date })))
    const g = site.sections.gear ? (gear.items ?? []) : []
    const totals = investmentTotals(copies, g)
    return {
      a, copies, g, totals,
      pie: genrePie(a), decades: decadeCounts(a), ratings: ratingDistribution(a), artists: topArtists(a.map((x) => ({ primaryArtist: x.artistNames[0] ?? 'Unknown' })), 8),
      avg: averageRating(a.map((x) => x.rating)), rated: a.filter((x) => x.rating !== undefined).length,
    }
  }, [albums.items, gear.items, site.sections.gear])

  if (!site.sections.stats) return <SectionOff />
  if (albums.error) return <ErrorState title="Couldn’t load statistics" message="Statistics are built from the shared collection, which isn’t available." />
  if (!albums.items) return <LoadingState label="Calculating" />
  if (s.a.length === 0) return <p className="text-dust">There isn’t enough shared yet to show statistics.</p>

  const cur = currency && s.totals.some((t) => t.currency === currency) ? currency : s.totals[0]?.currency
  const row = s.totals.find((t) => t.currency === cur)
  const series = cur ? cumulativeInvestment(s.copies, s.g, cur) : []
  const slice = (name: string, i: number) => (name === 'Other' ? PIE[PIE.length - 1] : PIE[i % (PIE.length - 1)])

  return (
    <>
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label="Albums" value={String(s.a.length)} />
        <Tile label="Genres" value={String(s.pie.filter((p) => p.name !== 'Other' && p.name !== 'No genre').length)} sub="By first listed genre" />
        <Tile label="Average rating" value={s.avg === undefined ? 'Not shared' : formatRating(s.avg, 10)} sub={s.rated ? `${s.rated} rated` : undefined} />
        <Tile label="Oldest release" value={s.a.reduce<number | undefined>((m, x) => (x.releaseYear !== undefined && (m === undefined || x.releaseYear < m) ? x.releaseYear : m), undefined)?.toString() ?? '—'} />
      </dl>

      {row && cur && (
        <section aria-labelledby="pm-h" className="mt-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 id="pm-h" className="text-2xl font-bold">Money</h2>
            {s.totals.length > 1 && <label className="flex items-center gap-2 text-sm">Currency<select value={cur} onChange={(e) => setCurrency(e.target.value)} className="rounded-lg border border-groove bg-sleeve px-3 py-2">{s.totals.map((t) => <option key={t.currency}>{t.currency}</option>)}</select></label>}
          </div>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Tile label="Spent on records" value={money(row.records, cur)} sub={`${row.recordCopies} copies`} />
            <Tile label="Spent on gear" value={money(row.gear, cur)} sub={`${row.gearItems} items`} />
            <Tile label="Total invested" value={money(row.total, cur)} />
          </dl>
        </section>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {series.length > 0 && cur && (
          <div className="lg:col-span-2">
            <ChartCard title="Total invested over time" note={`Running total in ${cur}.`} columns={['Month', 'Running total']} rows={series.map((m) => [m.month, money(m.total, cur)])}>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={series}><CartesianGrid stroke="#2e3140" vertical={false} /><XAxis dataKey="month" tick={axis} /><YAxis tick={axis} width={56} /><Tooltip {...tip} />
                  <Area type="monotone" dataKey="records" name="Records" stackId="1" stroke={GOLD} fill={GOLD} fillOpacity={0.55} isAnimationActive={false} />
                  <Area type="monotone" dataKey="gear" name="Gear" stackId="1" stroke={BLUE} fill={BLUE} fillOpacity={0.55} isAnimationActive={false} /></AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        )}
        <ChartCard title="Genres" note="Each album counts once, under its first genre." columns={['Genre', 'Albums']} rows={s.pie.map((g) => [g.name, g.count])}>
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart><Tooltip {...tip} /><Pie data={s.pie} dataKey="count" nameKey="name" innerRadius={58} outerRadius={105} paddingAngle={2} stroke="#1c1e27" isAnimationActive={false}>{s.pie.map((g, i) => <Cell key={g.name} fill={slice(g.name, i)} />)}</Pie></PieChart>
            </ResponsiveContainer>
            <ul className="w-full shrink-0 text-sm sm:w-44">{s.pie.map((g, i) => <li key={g.name} className="flex items-center gap-2 py-0.5"><span className="size-3 shrink-0 rounded-sm" style={{ background: slice(g.name, i) }} /><span className="truncate">{g.name}</span><span className="ml-auto text-dust">{g.count}</span></li>)}</ul>
          </div>
        </ChartCard>
        <ChartCard title="Albums by decade" note={s.decades.missing ? `${s.decades.missing} without a year are left out.` : undefined} columns={['Decade', 'Albums']} rows={s.decades.rows.map((d) => [d.decade, d.count])}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={s.decades.rows}><CartesianGrid stroke="#2e3140" vertical={false} /><XAxis dataKey="decade" tick={axis} /><YAxis allowDecimals={false} tick={axis} width={32} /><Tooltip {...tip} /><Bar dataKey="count" fill={GOLD} radius={[4, 4, 0, 0]} isAnimationActive={false} /></BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Rating distribution" note="Out of 10, rated albums only." columns={['Rating', 'Albums']} rows={s.rated ? s.ratings.map((r) => [r.bucket, r.count]) : []}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={s.ratings}><CartesianGrid stroke="#2e3140" vertical={false} /><XAxis dataKey="bucket" tick={axis} /><YAxis allowDecimals={false} tick={axis} width={32} /><Tooltip {...tip} /><Bar dataKey="count" fill={GOLD} radius={[4, 4, 0, 0]} isAnimationActive={false} /></BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <section aria-labelledby="pa-h" className="rounded-2xl bg-sleeve p-5">
          <h2 id="pa-h" className="text-xl font-medium">Most collected artists</h2>
          <ol className="mt-3 divide-y divide-groove">{s.artists.map((a) => <li key={a.name} className="flex justify-between py-2"><span>{a.name}</span><span className="text-dust">{a.count}</span></li>)}</ol>
        </section>
      </div>
    </>
  )
}
