'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createEquipment, updateEquipment, deleteEquipment } from '@/lib/actions/admin/equipment'

export interface EquipmentRow {
  id: string
  name: string
  price_per_session: number
  quantity: number
  active: boolean
}

interface EquipmentPanelProps {
  initialEquipment: EquipmentRow[]
}

interface ActionResult {
  success: boolean
  error?: string
}

const inputClass =
  'w-full border border-ink/20 bg-bg px-3 py-2 font-sans text-sm focus:outline-none focus:border-ink'
const labelClass = 'font-sans text-sm uppercase tracking-widest text-muted'

export default function EquipmentPanel({ initialEquipment }: EquipmentPanelProps) {
  const [equipment, setEquipment] = useState<EquipmentRow[]>(initialEquipment)
  const [newEquipName, setNewEquipName] = useState('')
  const [newEquipPrice, setNewEquipPrice] = useState<number | ''>('')
  const [newEquipQuantity, setNewEquipQuantity] = useState<number | ''>(1)
  const [equipError, setEquipError] = useState<string | null>(null)
  const [equipLoading, setEquipLoading] = useState(false)

  async function reloadEquipment() {
    const supabase = createClient()
    const { data } = await supabase
      .from('equipment')
      .select('id, name, price_per_session, quantity, active')
      .order('sort_order')
      .order('created_at')
    setEquipment(data ?? [])
  }

  // Shared by add/toggle/quantity/delete — each mutation follows the same
  // loading -> action -> reload-or-error -> loading-off shape.
  async function runEquipmentAction(
    fn: () => Promise<ActionResult>,
    fallbackError: string,
    onSuccess?: () => void
  ) {
    setEquipLoading(true)
    const result = await fn()
    if (result.success) {
      onSuccess?.()
      await reloadEquipment()
    } else {
      setEquipError(result.error ?? fallbackError)
    }
    setEquipLoading(false)
  }

  async function handleAddEquipment(e: React.FormEvent) {
    e.preventDefault()
    setEquipError(null)
    if (newEquipName.trim().length < 1 || newEquipPrice === '' || newEquipPrice < 0) {
      setEquipError('Enter a name and a valid price.')
      return
    }
    if (newEquipQuantity === '' || !Number.isInteger(newEquipQuantity) || newEquipQuantity < 1) {
      setEquipError('Quantity must be a positive whole number.')
      return
    }
    await runEquipmentAction(
      () =>
        createEquipment({
          name: newEquipName,
          pricePerSession: Math.round(newEquipPrice as number * 100),
          quantity: newEquipQuantity as number,
        }),
      'Failed to add equipment.',
      () => {
        setNewEquipName('')
        setNewEquipPrice('')
        setNewEquipQuantity(1)
      }
    )
  }

  async function handleToggleEquipment(id: string, active: boolean) {
    await runEquipmentAction(
      () => updateEquipment(id, { active: !active }),
      'Failed to update equipment.'
    )
  }

  async function handleUpdateQuantity(id: string, quantity: number) {
    if (!Number.isInteger(quantity) || quantity < 1) return
    await runEquipmentAction(
      () => updateEquipment(id, { quantity }),
      'Failed to update equipment.'
    )
  }

  async function handleDeleteEquipment(id: string) {
    await runEquipmentAction(
      () => deleteEquipment(id),
      'Failed to delete equipment.'
    )
  }

  return (
    <div className="mt-10 pt-8 border-t border-ink/10">
      <p className={`${labelClass} mb-3`}>Equipment / Gear</p>
      <p className="mb-4 font-sans text-xs text-muted">
        Added as an optional add-on at booking time. Price is flat per session, added to the studio total.
      </p>

      {equipment.length > 0 && (
        <div className="border border-ink/20 divide-y divide-ink/10 mb-4">
          {equipment.map((item) => (
            <div key={item.id} className="flex items-center justify-between px-3 py-2 gap-3">
              <div className={`flex-1 font-sans text-sm ${item.active ? 'text-ink' : 'text-muted line-through'}`}>
                {item.name}
              </div>
              <div className="font-sans text-sm text-ink tabular-nums">
                ₱{(item.price_per_session / 100).toLocaleString('en-PH')}
              </div>
              <label className="flex items-center gap-1">
                <span className="font-sans text-xs text-muted">Qty</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={item.quantity}
                  disabled={equipLoading}
                  onChange={(e) => {
                    const value = Number(e.target.value)
                    if (Number.isInteger(value) && value >= 1) {
                      handleUpdateQuantity(item.id, value)
                    }
                  }}
                  className="w-16 border border-ink/20 bg-bg px-1 py-1 font-sans text-sm text-center focus:outline-none focus:border-ink disabled:opacity-50"
                />
              </label>
              <button
                type="button"
                onClick={() => handleToggleEquipment(item.id, item.active)}
                disabled={equipLoading}
                className="font-sans text-xs uppercase tracking-widest text-muted hover:text-ink underline disabled:opacity-50"
              >
                {item.active ? 'Disable' : 'Enable'}
              </button>
              <button
                type="button"
                onClick={() => handleDeleteEquipment(item.id)}
                disabled={equipLoading}
                className="font-sans text-xs uppercase tracking-widest text-red-600 hover:opacity-70 underline disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleAddEquipment} className="flex flex-wrap items-end gap-3">
        <label className="block flex-1 min-w-[160px]">
          <span className={labelClass}>Name</span>
          <input
            type="text"
            className={inputClass}
            placeholder="Extra mic"
            value={newEquipName}
            onChange={(e) => setNewEquipName(e.target.value)}
          />
        </label>
        <label className="block w-32">
          <span className={labelClass}>Price (₱)</span>
          <input
            type="number"
            min={0}
            step={1}
            className={inputClass}
            value={newEquipPrice}
            onChange={(e) =>
              setNewEquipPrice(e.target.value === '' ? '' : Number(e.target.value))
            }
          />
        </label>
        <label className="block w-24">
          <span className={labelClass}>Quantity</span>
          <input
            type="number"
            min={1}
            step={1}
            className={inputClass}
            value={newEquipQuantity}
            onChange={(e) =>
              setNewEquipQuantity(e.target.value === '' ? '' : Number(e.target.value))
            }
          />
        </label>
        <button
          type="submit"
          disabled={equipLoading}
          className="bg-ink text-bg px-4 py-2 font-sans text-sm hover:opacity-80 transition-opacity uppercase tracking-widest disabled:opacity-50"
        >
          {equipLoading ? 'Adding...' : 'Add'}
        </button>
      </form>

      {equipError && (
        <p className="mt-2 font-sans text-sm text-red-600">{equipError}</p>
      )}
    </div>
  )
}
