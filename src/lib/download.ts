/** Saves text as a file entirely in the browser; nothing is uploaded. CSVs get a BOM so Excel reads UTF-8. */
export function downloadText(filename: string, text: string, mime: string, bom = false): void {
  const blob = new Blob([bom ? `\uFEFF${text}` : text], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
