import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, Order, Customer, Product, getErrorMessage } from '../lib/api'
import { Plus, Search, X, ChevronDown, Eye, Trash2, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800', confirmed: 'bg-blue-100 text-blue-800',
  processing: 'bg-purple-100 text-purple-800', shipped: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-green-100 text-green-800', cancelled: 'bg-red-100 text-red-800',
}
const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']

interface LineItem { product_id: number; quantity: number; product?: Product }

export default function Orders() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [viewOrder, setViewOrder] = useState<Order | null>(null)
  const [customerId, setCustomerId] = useState('')
  const [notes, setNotes] = useState('')
  const [lineItems, setLineItems] = useState<LineItem[]>([{ product_id: 0, quantity: 1 }])
  const [updatingStatus, setUpdatingStatus] = useState<{ orderId: number; status: string; notes: string } | null>(null)

  const { data: orders = [] } = useQuery<Order[]>({ queryKey: ['orders', search, filterStatus], queryFn: () => api.get(`/orders?search=${search}&status=${filterStatus}`).then(r => r.data) })
  const { data: customers = [] } = useQuery<Customer[]>({ queryKey: ['customers'], queryFn: () => api.get('/customers').then(r => r.data) })
  const { data: products = [] } = useQuery<Product[]>({ queryKey: ['products-all'], queryFn: () => api.get('/products').then(r => r.data) })

  const createMut = useMutation({
    mutationFn: (d: any) => api.post('/orders', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); setShowCreate(false); setCustomerId(''); setNotes(''); setLineItems([{ product_id: 0, quantity: 1 }]); toast.success('Order created') },
    onError: (e) => toast.error(getErrorMessage(e))
  })
  const statusMut = useMutation({
    mutationFn: ({ id, status, notes }: any) => api.put(`/orders/${id}/status`, { status, notes }),
    onSuccess: (_, vars) => { qc.invalidateQueries({ queryKey: ['orders'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); qc.invalidateQueries({ queryKey: ['products'] }); setUpdatingStatus(null); if (viewOrder) { api.get(`/orders/${viewOrder.id}`).then(r => setViewOrder(r.data)) }; toast.success(`Order ${vars.status}`) },
    onError: (e) => toast.error(getErrorMessage(e))
  })
  const deleteMut = useMutation({ mutationFn: (id: number) => api.delete(`/orders/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['orders'] }); toast.success('Order deleted') }, onError: (e) => toast.error(getErrorMessage(e)) })

  const orderTotal = () => lineItems.reduce((sum, item) => { const p = products.find(x => x.id === item.product_id); return sum + (p ? p.price * item.quantity : 0) }, 0)

  const submitCreate = () => {
    const validItems = lineItems.filter(i => i.product_id > 0 && i.quantity > 0)
    if (!customerId || validItems.length === 0) { toast.error('Select a customer and add at least one item'); return }
    createMut.mutate({ customer_id: parseInt(customerId), notes: notes || null, items: validItems.map(i => ({ product_id: i.product_id, quantity: i.quantity })) })
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-gray-500 text-sm">{orders.length} orders</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="w-4 h-4" />New Order</button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-9" placeholder="Search orders or customers…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input max-w-40" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {ORDER_STATUSES.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="table-th">Order #</th>
              <th className="table-th">Customer</th>
              <th className="table-th">Items</th>
              <th className="table-th">Total</th>
              <th className="table-th">Status</th>
              <th className="table-th">Date</th>
              <th className="table-th">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.map(o => (
              <tr key={o.id} className="hover:bg-gray-50">
                <td className="table-td font-mono text-xs font-medium">{o.order_number}</td>
                <td className="table-td font-medium">{o.customer?.name}</td>
                <td className="table-td">{o.items.length} items</td>
                <td className="table-td font-semibold">${Number(o.total_amount).toFixed(2)}</td>
                <td className="table-td"><span className={`badge capitalize ${STATUS_COLORS[o.status] || ''}`}>{o.status}</span></td>
                <td className="table-td text-gray-500">{format(new Date(o.created_at), 'MMM d, yyyy')}</td>
                <td className="table-td">
                  <div className="flex gap-1">
                    <button onClick={() => setViewOrder(o)} className="btn-ghost px-2 py-1"><Eye className="w-3.5 h-3.5" /></button>
                    {['pending', 'cancelled'].includes(o.status) && (
                      <button onClick={() => { if (confirm('Delete order?')) deleteMut.mutate(o.id) }} className="btn-ghost px-2 py-1 text-red-500 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={7} className="table-td text-center text-gray-400 py-12">No orders found</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Create Order Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">New Order</h2>
              <button onClick={() => setShowCreate(false)} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-5">
              <div>
                <label className="label">Customer *</label>
                <select className="input" value={customerId} onChange={e => setCustomerId(e.target.value)}>
                  <option value="">Select customer…</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}{c.email ? ` — ${c.email}` : ''}</option>)}
                </select>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label mb-0">Products *</label>
                  <button onClick={() => setLineItems(l => [...l, { product_id: 0, quantity: 1 }])} className="text-xs text-indigo-600 hover:underline">+ Add item</button>
                </div>
                <div className="space-y-2">
                  {lineItems.map((item, i) => {
                    const p = products.find(x => x.id === item.product_id)
                    return (
                      <div key={i} className="flex gap-2 items-center">
                        <select className="input flex-1" value={item.product_id} onChange={e => setLineItems(l => l.map((x, j) => j === i ? { ...x, product_id: parseInt(e.target.value) } : x))}>
                          <option value={0}>Select product…</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name} (${Number(p.price).toFixed(2)}) — Stock: {p.stock_quantity}</option>)}
                        </select>
                        <input className="input w-20" type="number" min={1} value={item.quantity} onChange={e => setLineItems(l => l.map((x, j) => j === i ? { ...x, quantity: parseInt(e.target.value) || 1 } : x))} />
                        {p && <span className="text-sm font-medium text-gray-600 w-20 shrink-0">${(p.price * item.quantity).toFixed(2)}</span>}
                        <button onClick={() => setLineItems(l => l.filter((_, j) => j !== i))} className="btn-ghost p-1 text-red-400"><X className="w-4 h-4" /></button>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-3 text-right">
                  <span className="text-base font-bold text-gray-900">Total: ${orderTotal().toFixed(2)}</span>
                </div>
              </div>
              <div><label className="label">Notes</label><textarea className="input resize-none" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional order notes…" /></div>
            </div>
            <div className="flex gap-3 p-5 border-t bg-gray-50">
              <button onClick={() => setShowCreate(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={submitCreate} disabled={createMut.isPending} className="btn-primary flex-1 justify-center">Create Order</button>
            </div>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {viewOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <h2 className="text-lg font-semibold">{viewOrder.order_number}</h2>
                <span className={`badge capitalize ${STATUS_COLORS[viewOrder.status] || ''}`}>{viewOrder.status}</span>
              </div>
              <button onClick={() => setViewOrder(null)} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-5">
              {/* Customer */}
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Customer</p>
                <p className="font-semibold text-gray-900">{viewOrder.customer?.name}</p>
                {viewOrder.customer?.email && <p className="text-sm text-gray-500">{viewOrder.customer.email}</p>}
                {viewOrder.customer?.phone && <p className="text-sm text-gray-500">{viewOrder.customer.phone}</p>}
              </div>

              {/* Items */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Items</p>
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50"><th className="table-th">Product</th><th className="table-th">Qty</th><th className="table-th">Unit</th><th className="table-th">Total</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {viewOrder.items.map(item => (
                      <tr key={item.id}>
                        <td className="table-td">{item.product?.name}</td>
                        <td className="table-td">{item.quantity}</td>
                        <td className="table-td">${Number(item.unit_price).toFixed(2)}</td>
                        <td className="table-td font-medium">${Number(item.total_price).toFixed(2)}</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50">
                      <td colSpan={3} className="table-td font-bold text-right">Total</td>
                      <td className="table-td font-bold text-lg">${Number(viewOrder.total_amount).toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Status history */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Status Timeline</p>
                <div className="space-y-2">
                  {viewOrder.status_history.map(h => (
                    <div key={h.id} className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                      <div>
                        <span className={`badge capitalize ${STATUS_COLORS[h.status] || ''}`}>{h.status}</span>
                        {h.notes && <p className="text-xs text-gray-500 mt-0.5">{h.notes}</p>}
                        <p className="text-xs text-gray-400">{format(new Date(h.created_at), 'MMM d, h:mm a')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Update status */}
              {viewOrder.status !== 'delivered' && viewOrder.status !== 'cancelled' && (
                <div className="border-t pt-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Update Status</p>
                  {updatingStatus?.orderId === viewOrder.id ? (
                    <div className="space-y-2">
                      <select className="input" value={updatingStatus.status} onChange={e => setUpdatingStatus(u => u ? { ...u, status: e.target.value } : null)}>
                        {ORDER_STATUSES.filter(s => s !== 'pending').map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
                      </select>
                      <input className="input" placeholder="Notes (optional)…" value={updatingStatus.notes} onChange={e => setUpdatingStatus(u => u ? { ...u, notes: e.target.value } : null)} />
                      <div className="flex gap-2">
                        <button onClick={() => setUpdatingStatus(null)} className="btn-secondary">Cancel</button>
                        <button onClick={() => statusMut.mutate({ id: viewOrder.id, status: updatingStatus.status, notes: updatingStatus.notes })} disabled={statusMut.isPending} className="btn-primary">Update</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setUpdatingStatus({ orderId: viewOrder.id, status: viewOrder.status, notes: '' })} className="btn-secondary">
                      <Clock className="w-4 h-4" />Change Status
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
