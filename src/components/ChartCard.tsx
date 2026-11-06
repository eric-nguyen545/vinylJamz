import type { ReactNode } from 'react'

interface Props {
  title: string
  note?: string
  columns: [string, string]
  rows: (string | number)[][]
  children: ReactNode
}

/** A chart plus its data as a table, so the numbers are available without seeing the graphic. */
export function ChartCard({ title, note, columns, rows, children }: Props) {
  return (
    <section aria-label={title} className="rounded-2xl bg-sleeve p-5">
      <h2 className="text-xl font-medium">{title}</h2>
      {note && <p className="mt-1 text-sm text-dust">{note}</p>}
      {rows.length === 0
        ? <p className="mt-6 text-dust">Not enough data yet.</p>
        : (
          <>
            <div className="mt-4" aria-hidden>{children}</div>
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-dust">View data as a table</summary>
              <table className="mt-2 w-full text-left">
                <thead className="text-dust"><tr><th scope="col" className="py-1 pr-4 font-normal">{columns[0]}</th><th scope="col" className="py-1 font-normal">{columns[1]}</th></tr></thead>
                <tbody>{rows.map((r) => <tr key={String(r[0])} className="border-t border-groove"><th scope="row" className="py-1 pr-4 font-normal">{r[0]}</th><td className="py-1">{r[1]}</td></tr>)}</tbody>
              </table>
            </details>
          </>
        )}
    </section>
  )
}
