import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Field, inputClass } from './Field'

describe('Field accessibility', () => {
  it('connects the label to the control', () => {
    render(<Field label="Latitude"><input className={inputClass} /></Field>)
    expect(screen.getByLabelText('Latitude')).toBeInTheDocument()
  })
  it('links hint and error to the control without polluting its name', () => {
    render(<Field label="Latitude" hint="Like 45.10236" error="Must be a number"><input /></Field>)
    const input = screen.getByRole('textbox', { name: 'Latitude' })
    expect(input).toHaveAttribute('aria-invalid', 'true')
    const described = input.getAttribute('aria-describedby')!.split(' ').map((id) => document.getElementById(id)?.textContent)
    expect(described).toEqual(['Like 45.10236', 'Must be a number'])
    expect(screen.getByRole('alert')).toHaveTextContent('Must be a number')
  })
  it('does not mark a valid field invalid', () => {
    render(<Field label="Name"><input /></Field>)
    expect(screen.getByRole('textbox', { name: 'Name' })).not.toHaveAttribute('aria-invalid')
    expect(screen.getByRole('textbox', { name: 'Name' })).not.toHaveAttribute('aria-describedby')
  })
  it('works with selects and textareas', () => {
    render(<><Field label="Format"><select><option>LP</option></select></Field><Field label="Notes"><textarea /></Field></>)
    expect(screen.getByRole('combobox', { name: 'Format' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Notes' })).toBeInTheDocument()
  })
  it('gives each field its own id', () => {
    render(<><Field label="A"><input /></Field><Field label="B"><input /></Field></>)
    expect(screen.getByLabelText('A').id).not.toBe(screen.getByLabelText('B').id)
  })
})
