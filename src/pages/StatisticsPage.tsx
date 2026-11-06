import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from 'recharts'
import { getDocs } from 'firebase/firestore'
import { useAuth } from '../app/AuthContext'
import { ChartCard } from '../components/ChartCard'
import { PageHeader } from '../components/PageHeader'
import { ErrorState, LoadingState } from '../components/States'
import { getFirebase } from '../firebase/config'
import { userCol } from '../firebase/paths'
import { snapToCopy, type StoredAlbum, type StoredCopy } from '../lib/albumsRepo'
import { listGear, type StoredGear } from '../lib/gearRepo'
import { formatDay } from '../lib/format'
import { listOwnedAlbums } from '../lib/publicRepo'
import { collectionValue, TYPE_LABEL } from '../lib/pricing'
import { listAllObservations, type StoredObservation } from '../lib/pricingRepo'
import { averageRating, formatRating } from '../lib/rating'
import { snapToReview, type StoredReview } from '../lib/reviewsRepo'
import { copiesWithoutPrice, cumulativeInvestment, currenciesIn, decadeCounts, genreCounts, genrePie, gearWithoutPrice, investmentTotals, priciest, purchasePoints, ratingDistribution, spendingByMonth, spendingTotals, topArtists, undatedCount, type PurchasePoint } from '../lib/stats'
import { usePreferences } from '../lib/usePreferences'

const GOLD = '#e3b04b'
const BLUE = '#7aa2f7'
/** Slice colors; the last is reserved for "Other". */
const PIE = ['#e3b04b', '#7aa2f7', '#6fcf97', '#f28b82', '#bb86fc', '#4dd0e1', '#f2994a', '#d4e157', '#6b6f85']
const axis = { fill: '#a0a2b6', fontSize: 12 }
const tip = { contentStyle: { background: '#242734', border: '1px solid #2e3140', borderRadius: 8, color: '#ece9f1' }, cursor: { fill: 'rgba(255,255,255,0.05)' } }

const money = (n: number, c: string) => { try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: c }).format(n) } catch { return `${n} ${c}` } }

interface Data { albums: StoredAlbum[]; copies: StoredCopy[]; reviews: StoredReview[]; observations: StoredObservation[]; gear: StoredGear[] }

export function StatisticsPage() {
  const { state } = useAuth()
  if (state.status !== 'owner') return null
  return <StatsBody uid={state.user.uid} />
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-sleeve p-5">
      <dt className="text-sm text-dust">{label}</dt>
      <dd className="mt-1 font-display text-3xl font-bold">{value}</dd>
      {sub && <dd className="text-xs text-dust">{sub}</dd>}
    </div>
  )
}

function StatsBody({ uid }: { uid: string }) {
  const prefs = usePreferences(uid)
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currency, setCurrency] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const { db } = getFirebase()
        const [albums, copySnap, reviewSnap, observations, gear] = await Promise.all([listOwnedAlbums(db, uid), getDocs(userCol(db, uid, 'copies')), getDocs(userCol(db, uid, 'reviews')), listAllObservations(db, uid), listGear(db, uid)])
        if (cancelled) return
        setData({
          albums,
          copies: copySnap.docs.map(snapToCopy).filter((c): c is StoredCopy => c !== null),
          reviews: reviewSnap.docs.map(snapToReview).filter((r): r is StoredReview => r !== null),
          observations, gear,
        })
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load statistics.') }
    }
    void load()
    return () => { cancelled = true }
  }, [uid])

  const stats = useMemo(() => {
    if (!data) return null
    const ownedIds = new Set(data.albums.map((a) => a.id))
    const copies = data.copies.filter((c) => ownedIds.has(c.albumId))
    const reviews = data.reviews.filter((r) => ownedIds.has(r.id))
    const totals = spendingTotals(copies)
    return {
      copies, totals, reviews,
      avg: averageRating(reviews.map((r) => r.rating)),
      rated: reviews.filter((r) => r.rating !== undefined).length,
      favorites: reviews.filter((r) => r.isFavorite).length,
      noPrice: copiesWithoutPrice(copies),
      decades: decadeCounts(data.albums),
      genres: genreCounts(data.albums),
      pie: genrePie(data.albums),
      currencies: currenciesIn(copies, data.gear),
      gearNoPrice: gearWithoutPrice(data.gear),
      artists: topArtists(data.albums, 8),
      ratings: ratingDistribution(reviews),
      albumsById: new Map(data.albums.map((a) => [a.id, a])),
      value: collectionValue(copies, data.observations),
    }
  }, [data])

  if (error) return <ErrorState title="Couldn’t load statistics" message={error} />
  if (!data || !stats) return <LoadingState label="Crunching your collection" />

  const cur = currency && stats.currencies.includes(currency) ? currency : (stats.currencies.includes(prefs.defaultCurrency) ? prefs.defaultCurrency : stats.currencies[0])
  const money1 = investmentTotals(stats.copies, data.gear).find((r) => r.currency === cur)
  const monthly = cur ? spendingByMonth(stats.copies, cur) : []
  const priciestCopies = cur ? priciest(stats.copies, cur, 5) : []
  const cumulative = cur ? cumulativeInvestment(stats.copies, data.gear, cur) : []
  const points = cur ? purchasePoints(stats.copies, (id) => stats.albumsById.get(id)?.title ?? 'Album', cur) : []
  const undated = cur ? undatedCount(stats.copies, cur) + undatedCount(data.gear, cur) : 0

  if (data.albums.length === 0 && data.gear.length === 0) {
    return (<><PageHeader title="Statistics" /><p className="text-dust">Statistics appear once you’ve added albums or gear.</p></>)
  }

  return (
    <>
      <PageHeader title="Statistics" description="Everything here is calculated from your saved records. Missing data is left out, not guessed." />
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label="Albums" value={String(data.albums.length)} />
        <Tile label="Physical copies" value={String(stats.copies.length)} />
        <Tile label="Average rating" value={stats.avg === undefined ? 'None yet' : formatRating(stats.avg, 10)} sub={`${stats.rated} rated ${stats.rated === 1 ? 'album' : 'albums'}, 0–10 scale`} />
        <Tile label="Favorites" value={String(stats.favorites)} />
      </dl>

      <section aria-labelledby="money-h" className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="money-h" className="text-2xl font-bold">Money</h2>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            {stats.currencies.length > 1 && (
              <label className="flex items-center gap-2">Currency
                <select value={cur} onChange={(e) => setCurrency(e.target.value)} className="rounded-lg border border-groove bg-sleeve px-3 py-2">{stats.currencies.map((c) => <option key={c}>{c}</option>)}</select>
              </label>
            )}
            <Link to="/gear" className="text-label underline underline-offset-4">Manage gear</Link>
          </div>
        </div>
        {money1 && cur
          ? (
            <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Tile label="Spent on records" value={money(money1.records, cur)} sub={`${money1.recordCopies} priced ${money1.recordCopies === 1 ? 'copy' : 'copies'}`} />
              <Tile label="Spent on gear" value={money(money1.gear, cur)} sub={`${money1.gearItems} priced ${money1.gearItems === 1 ? 'item' : 'items'}`} />
              <Tile label="Total invested" value={money(money1.total, cur)} sub="Records plus gear" />
              <Tile label="Average per record" value={money1.recordCopies ? money(money1.records / money1.recordCopies, cur) : 'None'} />
            </dl>
          )
          : <p className="rounded-2xl bg-sleeve p-5 text-dust">No prices yet. Add what you paid on a copy, or add gear, to see your spending.</p>}
        <p className="mt-3 text-sm text-dust">
          Currencies are never converted or added together.
          {stats.noPrice > 0 && ` ${stats.noPrice} ${stats.noPrice === 1 ? 'copy has' : 'copies have'} no price.`}
          {stats.gearNoPrice > 0 && ` ${stats.gearNoPrice} gear ${stats.gearNoPrice === 1 ? 'item has' : 'items have'} no price.`}
          {undated > 0 && ` ${undated} priced ${undated === 1 ? 'item has' : 'items have'} no date and ${undated === 1 ? 'is' : 'are'} missing from the time charts.`}
        </p>
      </section>

      <section aria-labelledby="value-h" className="mt-8 rounded-2xl bg-sleeve p-5">
        <h2 id="value-h" className="text-xl font-medium">Estimated value</h2>
        {stats.value.rows.length === 0
          ? <p className="mt-2 text-dust">Record prices on album pages to see a rough value here.</p>
          : (
            <>
              <ul className="mt-3 flex flex-col gap-2">
                {stats.value.rows.map((r) => (
                  <li key={r.currency} className="flex flex-wrap items-baseline gap-x-4">
                    <span className="font-display text-2xl font-bold">{money(r.total, r.currency)}</span>
                    <span className="text-sm text-dust">{r.valuedCopies} {r.valuedCopies === 1 ? 'copy' : 'copies'}: {(['sold', 'estimate', 'listing', 'manual'] as const).filter((t) => r.basis[t] > 0).map((t) => `${r.basis[t]} ${TYPE_LABEL[t].toLowerCase()}`).join(', ')}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-dust">
                {stats.value.unvalued > 0 ? `${stats.value.unvalued} of ${stats.value.totalCopies} copies have no price and are left out. ` : ''}
                Each copy uses its newest sold price, else estimate, else asking price. Asking prices are not what records sell for, so treat this as a rough guide, not an appraisal.
              </p>
            </>
          )}
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <ChartCard title="Total invested over time" note={cur ? `Running total in ${cur}: records in gold, gear in blue, by purchase date.` : undefined} columns={['Month', 'Running total']}
            rows={cumulative.map((m) => [m.month, cur ? `${money(m.total, cur)} (records ${money(m.records, cur)}, gear ${money(m.gear, cur)})` : String(m.total)])}>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={cumulative}><CartesianGrid stroke="#2e3140" vertical={false} /><XAxis dataKey="month" tick={axis} /><YAxis tick={axis} width={56} /><Tooltip {...tip} />
                <Area type="monotone" dataKey="records" name="Records" stackId="1" stroke={GOLD} fill={GOLD} fillOpacity={0.55} isAnimationActive={false} />
                <Area type="monotone" dataKey="gear" name="Gear" stackId="1" stroke={BLUE} fill={BLUE} fillOpacity={0.55} isAnimationActive={false} /></AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <ChartCard title="Spending by month" note={cur ? `In ${cur}, by purchase date.` : undefined} columns={['Month', 'Spent']} rows={monthly.map((m) => [m.month, cur ? money(m.total, cur) : String(m.total)])}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthly}><CartesianGrid stroke="#2e3140" vertical={false} /><XAxis dataKey="month" tick={axis} /><YAxis tick={axis} width={48} /><Tooltip {...tip} /><Bar dataKey="total" fill={GOLD} radius={[4, 4, 0, 0]} isAnimationActive={false} /></BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Every record purchase" note={cur ? `Each dot is one copy you bought, in ${cur}.` : undefined} columns={['Date', 'Album and price']} rows={points.map((p, i) => [`${p.date} #${i + 1}`, `${p.title}, ${cur ? money(p.price, cur) : p.price}`])}>
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart><CartesianGrid stroke="#2e3140" />
              <XAxis type="number" dataKey="t" name="Date" domain={['dataMin', 'dataMax']} scale="time" tick={axis} tickFormatter={(t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })} />
              <YAxis type="number" dataKey="price" name="Price" tick={axis} width={48} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }: { active?: boolean; payload?: ReadonlyArray<{ payload?: unknown }> }) => {
                const p = payload?.[0]?.payload as PurchasePoint | undefined
                if (!active || !p) return null
                return <div style={tip.contentStyle} className="p-2 text-sm"><p className="font-medium">{p.title}</p><p>{formatDay(p.date)}, {cur ? money(p.price, cur) : p.price}</p></div>
              }} />
              <Scatter data={points} fill={GOLD} isAnimationActive={false} /></ScatterChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Genres you own" note="Each album counts once, under its first genre, so the slices add up to your collection." columns={['Genre', 'Albums']} rows={stats.pie.map((g) => [g.name, g.count])}>
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart><Tooltip {...tip} />
                <Pie data={stats.pie} dataKey="count" nameKey="name" innerRadius={58} outerRadius={105} paddingAngle={2} stroke="#1c1e27" isAnimationActive={false}>
                  {stats.pie.map((g, i) => <Cell key={g.name} fill={g.name === 'Other' ? PIE[PIE.length - 1] : PIE[i % (PIE.length - 1)]} />)}
                </Pie></PieChart>
            </ResponsiveContainer>
            <ul className="w-full shrink-0 text-sm sm:w-44">
              {stats.pie.map((g, i) => <li key={g.name} className="flex items-center gap-2 py-0.5"><span className="size-3 shrink-0 rounded-sm" style={{ background: g.name === 'Other' ? PIE[PIE.length - 1] : PIE[i % (PIE.length - 1)] }} /><span className="truncate">{g.name}</span><span className="ml-auto text-dust">{g.count}</span></li>)}
            </ul>
          </div>
        </ChartCard>

        <ChartCard title="Albums by decade" note={stats.decades.missing ? `${stats.decades.missing} without a release year are left out.` : undefined} columns={['Decade', 'Albums']} rows={stats.decades.rows.map((d) => [d.decade, d.count])}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stats.decades.rows}><CartesianGrid stroke="#2e3140" vertical={false} /><XAxis dataKey="decade" tick={axis} /><YAxis allowDecimals={false} tick={axis} width={32} /><Tooltip {...tip} /><Bar dataKey="count" fill={GOLD} radius={[4, 4, 0, 0]} isAnimationActive={false} /></BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="All genres, ranked" note="An album with several genres counts toward each." columns={['Genre', 'Albums']} rows={stats.genres.map((g) => [g.name, g.count])}>
          <ResponsiveContainer width="100%" height={Math.max(180, stats.genres.length * 30)}>
            <BarChart data={stats.genres} layout="vertical"><CartesianGrid stroke="#2e3140" horizontal={false} /><XAxis type="number" allowDecimals={false} tick={axis} /><YAxis type="category" dataKey="name" tick={axis} width={96} /><Tooltip {...tip} /><Bar dataKey="count" fill={GOLD} radius={[0, 4, 4, 0]} isAnimationActive={false} /></BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Rating distribution" note="Rated albums only, on the 0–10 scale." columns={['Rating', 'Albums']} rows={stats.rated ? stats.ratings.map((r) => [r.bucket, r.count]) : []}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stats.ratings}><CartesianGrid stroke="#2e3140" vertical={false} /><XAxis dataKey="bucket" tick={axis} /><YAxis allowDecimals={false} tick={axis} width={32} /><Tooltip {...tip} /><Bar dataKey="count" fill={GOLD} radius={[4, 4, 0, 0]} isAnimationActive={false} /></BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="artists-h" className="rounded-2xl bg-sleeve p-5">
          <h2 id="artists-h" className="text-xl font-medium">Most collected artists</h2>
          <ol className="mt-3 divide-y divide-groove">{stats.artists.map((a) => <li key={a.name} className="flex justify-between py-2"><span>{a.name}</span><span className="text-dust">{a.count}</span></li>)}</ol>
        </section>
        <section aria-labelledby="priciest-h" className="rounded-2xl bg-sleeve p-5">
          <h2 id="priciest-h" className="text-xl font-medium">Priciest copies {cur && <span className="text-base font-normal text-dust">({cur})</span>}</h2>
          {priciestCopies.length === 0
            ? <p className="mt-3 text-dust">Add purchase prices to see these.</p>
            : <ol className="mt-3 divide-y divide-groove">{priciestCopies.map((c) => {
                const a = stats.albumsById.get(c.albumId)
                return <li key={c.id} className="flex justify-between gap-3 py-2"><Link to={`/collection/${c.albumId}`} className="truncate underline-offset-4 hover:underline">{a?.title ?? 'Album'}</Link><span className="shrink-0 text-dust">{money(c.purchasePrice ?? 0, c.currency ?? cur!)}</span></li>
              })}</ol>}
        </section>
      </div>
    </>
  )
}
