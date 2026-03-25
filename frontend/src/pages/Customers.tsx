import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, Customer, getErrorMessage } from '../lib/api'
import { Plus, Search, Edit2, Trash2, Users, X, Mail, Phone, MapPin } from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

interface CustomerForm { name: string; email: string; phone: string; address: string; city: string; country: string; notes: string }
const emptyForm: CustomerForm = { name: '', email: '', phone: '', address: '', city: '', country: 'US', notes: '' }

export default function Customers() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null)
  const [form, setForm] = useState<CustomerForm>(emptyForm)

  const { data: customers = [] } = useQuery<Customer[]>({ queryKey: ['customers', search], queryFn: () => api.get(`/customers?search=${search}`).then(r => r.data) })

  const createMut = useMutation({ mutationFn: (d: any) => api.post('/customers', d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); setShowModal(false); toast.success('Customer added') }, onError: (e) => toast.error(getErrorMessage(e)) })
  const updateMut = useMutation({ mutationFn: ({ id, d }: any) => api.put(`/customers/${id}`, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); setShowModal(false); toast.success('Customer updated') }, onError: (e) => toast.error(getErrorMessage(e)) })
  const deleteMut = useMutation({ mutationFn: (id: number) => api.delete(`/customers/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['customers'] }); toast.success('Customer deleted') }, onError: (e) => toast.error(getErrorMessage(e)) })

  const openCreate = () => { setEditCustomer(null); setForm(emptyForm); setShowModal(true) }
  const openEdit = (c: Customer) => { setEditCustomer(c); setForm({ name: c.name, email: c.email || '', phone: c.phone || '', address: c.address || '', city: c.city || '', country: c.country || 'US', notes: c.notes || '' }); setShowModal(true) }

  const submit = () => {
    const payload = { name: form.name, email: form.email || null, phone: form.phone || null, address: form.address || null, city: form.city || null, country: form.country || 'US', notes: form.notes || null }
    if (editCustomer) updateMut.mutate({ id: editCustomer.id, d: payload })
    else createMut.mutate(payload)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-500 text-sm">{customers.length} customers</p>
        </div>
        <button onClick={openCreate} className="btn-primary"><Plus className="w-4 h-4" />Add Customer</button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="input pl-9" placeholder="Search customers…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="table-th">Customer</th>
              <th className="table-th">Email</th>
              <th className="table-th">Phone</th>
              <th className="table-th">Location</th>
              <th className="table-th">Joined</th>
              <th className="table-th">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {customers.map(c => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="table-td">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-semibold text-indigo-700">
                      {c.name[0].toUpperCase()}
                    </div>
                    <p className="font-medium text-gray-900">{c.name}</p>
                  </div>
                </td>
                <td className="table-td">
                  {c.email ? <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-indigo-600 hover:underline"><Mail className="w-3.5 h-3.5" />{c.email}</a> : <span className="text-gray-400">—</span>}
                </td>
                <td className="table-td text-gray-600">{c.phone || '—'}</td>
                <td className="table-td text-gray-500">
                  {c.city ? <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{c.city}, {c.country}</span> : '—'}
                </td>
                <td className="table-td text-gray-500">{format(new Date(c.created_at), 'MMM d, yyyy')}</td>
                <td className="table-td">
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(c)} className="btn-ghost px-2 py-1"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => { if (confirm('Delete customer?')) deleteMut.mutate(c.id) }} className="btn-ghost px-2 py-1 text-red-500 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {customers.length === 0 && <tr><td colSpan={6} className="table-td text-center text-gray-400 py-12">No customers found</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">{editCustomer ? 'Edit Customer' : 'Add Customer'}</h2>
              <button onClick={() => setShowModal(false)} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div><label className="label">Full Name *</label><input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
              </div>
              <div><label className="label">Address</label><input className="input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">City</label><input className="input" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
                <div><label className="label">Country</label><input className="input" value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} /></div>
              </div>
              <div><label className="label">Notes</label><textarea className="input resize-none" rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
            </div>
            <div className="flex gap-3 p-5 border-t bg-gray-50">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={submit} disabled={!form.name || createMut.isPending || updateMut.isPending} className="btn-primary flex-1 justify-center">
                {editCustomer ? 'Save Changes' : 'Add Customer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
