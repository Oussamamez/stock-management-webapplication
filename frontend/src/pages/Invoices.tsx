import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, Invoice, Order, getErrorMessage } from '../lib/api'
import { Plus, Download, Eye, X, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

export default function Invoices() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [orderId, setOrderId] = useState('')
  const [taxRate, setTaxRate] = useState('10')
  const [dueDate, setDueDate] = useState('')
  const [invNotes, setInvNotes] = useState('')

  const { data: invoices = [] } = useQuery<Invoice[]>({ queryKey: ['invoices', filterStatus], queryFn: () => api.get(`/invoices?status=${filterStatus}`).then(r => r.data) })
  const { data: orders = [] } = useQuery<Order[]>({ queryKey: ['orders-invoiceable'], queryFn: () => api.get('/orders?status=confirmed').then(r => r.data) })

  const createMut = useMutation({
    mutationFn: (d: any) => api.post('/invoices', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); setShowCreate(false); setOrderId(''); toast.success('Invoice created') },
    onError: (e) => toast.error(getErrorMessage(e))
  })
  const statusMut = useMutation({
    mutationFn: ({ id, status }: any) => api.put(`/invoices/${id}/status`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); if (viewInvoice) { api.get(`/invoices/${viewInvoice.id}`).then(r => setViewInvoice(r.data)) }; toast.success('Status updated') },
    onError: (e) => toast.error(getErrorMessage(e))
  })

  const downloadPdf = async (invoice: Invoice) => {
    try {
      const res = await api.get(`/invoices/${invoice.id}/pdf`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a'); a.href = url; a.download = `${invoice.invoice_number}.pdf`; a.click()
      URL.revokeObjectURL(url)
    } catch { toast.error('Failed to download PDF') }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-500 text-sm">{invoices.length} invoices</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary"><Plus className="w-4 h-4" />Generate Invoice</button>
      </div>

      <div className="flex gap-3">
        <select className="input max-w-48" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {['draft', 'sent', 'paid', 'cancelled'].map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="table-th">Invoice #</th>
              <th className="table-th">Order</th>
              <th className="table-th">Customer</th>
              <th className="table-th">Subtotal</th>
              <th className="table-th">Tax</th>
              <th className="table-th">Total</th>
              <th className="table-th">Status</th>
              <th className="table-th">Date</th>
              <th className="table-th">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {invoices.map(inv => (
              <tr key={inv.id} className="hover:bg-gray-50">
                <td className="table-td font-mono text-xs font-medium">{inv.invoice_number}</td>
                <td className="table-td font-mono text-xs">{inv.order?.order_number}</td>
                <td className="table-td">{inv.order?.customer?.name}</td>
                <td className="table-td">${Number(inv.subtotal).toFixed(2)}</td>
                <td className="table-td text-gray-500">${Number(inv.tax_amount).toFixed(2)}</td>
                <td className="table-td font-bold">${Number(inv.total).toFixed(2)}</td>
                <td className="table-td"><span className={`badge capitalize ${STATUS_COLORS[inv.status] || ''}`}>{inv.status}</span></td>
                <td className="table-td text-gray-500">{format(new Date(inv.created_at), 'MMM d, yyyy')}</td>
                <td className="table-td">
                  <div className="flex gap-1">
                    <button onClick={() => setViewInvoice(inv)} className="btn-ghost px-2 py-1"><Eye className="w-3.5 h-3.5" /></button>
                    <button onClick={() => downloadPdf(inv)} className="btn-ghost px-2 py-1 text-indigo-600"><Download className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && <tr><td colSpan={9} className="table-td text-center text-gray-400 py-12">No invoices yet</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">Generate Invoice</h2>
              <button onClick={() => setShowCreate(false)} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">Order *</label>
                <select className="input" value={orderId} onChange={e => setOrderId(e.target.value)}>
                  <option value="">Select confirmed order…</option>
                  {orders.map(o => <option key={o.id} value={o.id}>{o.order_number} — {o.customer?.name} (${Number(o.total_amount).toFixed(2)})</option>)}
                </select>
                {orders.length === 0 && <p className="text-xs text-gray-400 mt-1">No confirmed orders without invoices</p>}
              </div>
              <div><label className="label">Tax Rate (%)</label><input className="input" type="number" step="0.1" value={taxRate} onChange={e => setTaxRate(e.target.value)} /></div>
              <div><label className="label">Due Date</label><input className="input" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
              <div><label className="label">Notes</label><textarea className="input resize-none" rows={2} value={invNotes} onChange={e => setInvNotes(e.target.value)} /></div>
            </div>
            <div className="flex gap-3 p-5 border-t bg-gray-50">
              <button onClick={() => setShowCreate(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={() => createMut.mutate({ order_id: parseInt(orderId), tax_rate: parseFloat(taxRate), due_date: dueDate ? new Date(dueDate).toISOString() : null, notes: invNotes || null })} disabled={!orderId || createMut.isPending} className="btn-primary flex-1 justify-center">Generate</button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Detail Modal */}
      {viewInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <h2 className="text-lg font-semibold">{viewInvoice.invoice_number}</h2>
                <span className={`badge capitalize ${STATUS_COLORS[viewInvoice.status] || ''}`}>{viewInvoice.status}</span>
              </div>
              <button onClick={() => setViewInvoice(null)} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-5">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><p className="text-gray-500">Order</p><p className="font-mono font-medium">{viewInvoice.order?.order_number}</p></div>
                <div><p className="text-gray-500">Customer</p><p className="font-medium">{viewInvoice.order?.customer?.name}</p></div>
                <div><p className="text-gray-500">Issued</p><p>{format(new Date(viewInvoice.issued_date), 'MMM d, yyyy')}</p></div>
                <div><p className="text-gray-500">Due</p><p>{viewInvoice.due_date ? format(new Date(viewInvoice.due_date), 'MMM d, yyyy') : 'N/A'}</p></div>
              </div>

              <table className="w-full text-sm">
                <thead><tr className="bg-gray-50"><th className="table-th">Item</th><th className="table-th">Qty</th><th className="table-th">Total</th></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {viewInvoice.order?.items.map(item => (
                    <tr key={item.id}><td className="table-td">{item.product?.name}</td><td className="table-td">{item.quantity}</td><td className="table-td">${Number(item.total_price).toFixed(2)}</td></tr>
                  ))}
                </tbody>
              </table>

              <div className="bg-gray-50 rounded-lg p-4 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>${Number(viewInvoice.subtotal).toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Tax ({Number(viewInvoice.tax_rate)}%)</span><span>${Number(viewInvoice.tax_amount).toFixed(2)}</span></div>
                <div className="flex justify-between font-bold text-base border-t pt-2"><span>Total</span><span>${Number(viewInvoice.total).toFixed(2)}</span></div>
              </div>

              <div className="flex gap-2 flex-wrap">
                {viewInvoice.status === 'draft' && <button onClick={() => statusMut.mutate({ id: viewInvoice.id, status: 'sent' })} className="btn-secondary text-sm">Mark as Sent</button>}
                {viewInvoice.status === 'sent' && <button onClick={() => statusMut.mutate({ id: viewInvoice.id, status: 'paid' })} className="btn-primary text-sm">Mark as Paid</button>}
                {viewInvoice.status !== 'cancelled' && viewInvoice.status !== 'paid' && <button onClick={() => statusMut.mutate({ id: viewInvoice.id, status: 'cancelled' })} className="btn-danger text-sm">Cancel</button>}
                <button onClick={() => downloadPdf(viewInvoice)} className="btn-secondary text-sm"><Download className="w-4 h-4" />Download PDF</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
