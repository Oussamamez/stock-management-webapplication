import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, Product, Category, getErrorMessage } from '../lib/api'
import { Plus, Search, Edit2, Trash2, Package, TrendingDown, AlertCircle, X } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const stockBadge = (p: Product) => {
  if (p.stock_quantity === 0) return 'bg-red-100 text-red-700'
  if (p.stock_quantity <= p.low_stock_threshold) return 'bg-orange-100 text-orange-700'
  return 'bg-green-100 text-green-700'
}
const stockLabel = (p: Product) => {
  if (p.stock_quantity === 0) return 'Out of Stock'
  if (p.stock_quantity <= p.low_stock_threshold) return 'Low Stock'
  return 'In Stock'
}

interface ProductForm { name: string; sku: string; description: string; price: string; cost_price: string; stock_quantity: string; low_stock_threshold: string; category_id: string; is_active: boolean }
const emptyForm: ProductForm = { name: '', sku: '', description: '', price: '', cost_price: '', stock_quantity: '0', low_stock_threshold: '10', category_id: '', is_active: true }

export default function Inventory() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [form, setForm] = useState<ProductForm>(emptyForm)
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null)
  const [adjustQty, setAdjustQty] = useState('')
  const [adjustReason, setAdjustReason] = useState('')

  const { data: products = [] } = useQuery<Product[]>({ queryKey: ['products', search], queryFn: () => api.get(`/products?search=${search}`).then(r => r.data) })
  const { data: categories = [] } = useQuery<Category[]>({ queryKey: ['categories'], queryFn: () => api.get('/categories').then(r => r.data) })

  const createMut = useMutation({ mutationFn: (d: any) => api.post('/products', d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); setShowModal(false); toast.success('Product created') }, onError: (e) => toast.error(getErrorMessage(e)) })
  const updateMut = useMutation({ mutationFn: ({ id, d }: any) => api.put(`/products/${id}`, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); setShowModal(false); toast.success('Product updated') }, onError: (e) => toast.error(getErrorMessage(e)) })
  const deleteMut = useMutation({ mutationFn: (id: number) => api.delete(`/products/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); toast.success('Product deleted') }, onError: (e) => toast.error(getErrorMessage(e)) })
  const adjustMut = useMutation({ mutationFn: ({ id, d }: any) => api.post(`/products/${id}/adjust-stock`, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); setAdjustProduct(null); toast.success('Stock adjusted') }, onError: (e) => toast.error(getErrorMessage(e)) })

  const openCreate = () => { setEditProduct(null); setForm(emptyForm); setShowModal(true) }
  const openEdit = (p: Product) => { setEditProduct(p); setForm({ name: p.name, sku: p.sku, description: p.description || '', price: String(p.price), cost_price: String(p.cost_price || ''), stock_quantity: String(p.stock_quantity), low_stock_threshold: String(p.low_stock_threshold), category_id: String(p.category_id || ''), is_active: p.is_active }); setShowModal(true) }

  const submitForm = () => {
    const payload = { name: form.name, sku: form.sku, description: form.description || null, price: parseFloat(form.price), cost_price: form.cost_price ? parseFloat(form.cost_price) : null, stock_quantity: parseInt(form.stock_quantity), low_stock_threshold: parseInt(form.low_stock_threshold), category_id: form.category_id ? parseInt(form.category_id) : null, is_active: form.is_active }
    if (editProduct) updateMut.mutate({ id: editProduct.id, d: payload })
    else createMut.mutate(payload)
  }

  const submitAdjust = () => {
    if (!adjustProduct || !adjustQty) return
    adjustMut.mutate({ id: adjustProduct.id, d: { adjustment: parseInt(adjustQty), reason: adjustReason || null } })
    setAdjustQty(''); setAdjustReason('')
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-gray-500 text-sm">{products.length} products</p>
        </div>
        <button onClick={openCreate} className="btn-primary"><Plus className="w-4 h-4" />Add Product</button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input className="input pl-9" placeholder="Search products or SKU…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="table-th">Product</th>
              <th className="table-th">SKU</th>
              <th className="table-th">Category</th>
              <th className="table-th">Price</th>
              <th className="table-th">Stock</th>
              <th className="table-th">Status</th>
              <th className="table-th">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {products.map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="table-td">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                      <Package className="w-4 h-4 text-indigo-500" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{p.name}</p>
                      {p.description && <p className="text-xs text-gray-400 truncate max-w-xs">{p.description}</p>}
                    </div>
                  </div>
                </td>
                <td className="table-td font-mono text-xs">{p.sku}</td>
                <td className="table-td text-gray-500">{p.category?.name || '—'}</td>
                <td className="table-td font-medium">${Number(p.price).toFixed(2)}</td>
                <td className="table-td font-mono">{p.stock_quantity}</td>
                <td className="table-td">
                  <span className={`badge ${stockBadge(p)}`}>{stockLabel(p)}</span>
                </td>
                <td className="table-td">
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setAdjustProduct(p); setAdjustQty(''); setAdjustReason('') }} className="btn-ghost px-2 py-1 text-xs"><TrendingDown className="w-3.5 h-3.5" /></button>
                    <button onClick={() => openEdit(p)} className="btn-ghost px-2 py-1 text-xs"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => { if (confirm('Delete this product?')) deleteMut.mutate(p.id) }} className="btn-ghost px-2 py-1 text-xs text-red-500 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {products.length === 0 && <tr><td colSpan={7} className="table-td text-center text-gray-400 py-12">No products found</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Product Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">{editProduct ? 'Edit Product' : 'Add Product'}</h2>
              <button onClick={() => setShowModal(false)} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><label className="label">Product Name *</label><input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
                <div><label className="label">SKU *</label><input className="input font-mono" value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} /></div>
                <div><label className="label">Category</label>
                  <select className="input" value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
                    <option value="">None</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div><label className="label">Selling Price *</label><input className="input" type="number" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} /></div>
                <div><label className="label">Cost Price</label><input className="input" type="number" step="0.01" value={form.cost_price} onChange={e => setForm(f => ({ ...f, cost_price: e.target.value }))} /></div>
                {!editProduct && <div><label className="label">Initial Stock</label><input className="input" type="number" value={form.stock_quantity} onChange={e => setForm(f => ({ ...f, stock_quantity: e.target.value }))} /></div>}
                <div><label className="label">Low Stock Alert</label><input className="input" type="number" value={form.low_stock_threshold} onChange={e => setForm(f => ({ ...f, low_stock_threshold: e.target.value }))} /></div>
                <div className="col-span-2"><label className="label">Description</label><textarea className="input resize-none" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="active" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="w-4 h-4 accent-indigo-600" />
                <label htmlFor="active" className="text-sm text-gray-700">Active (available for orders)</label>
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t bg-gray-50">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={submitForm} disabled={createMut.isPending || updateMut.isPending} className="btn-primary flex-1 justify-center">
                {editProduct ? 'Save Changes' : 'Create Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Adjust Modal */}
      {adjustProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">Adjust Stock</h2>
              <button onClick={() => setAdjustProduct(null)} className="btn-ghost p-1"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="font-medium text-gray-900">{adjustProduct.name}</p>
                <p className="text-sm text-gray-500">Current stock: <span className="font-mono font-semibold">{adjustProduct.stock_quantity}</span></p>
              </div>
              <div>
                <label className="label">Adjustment (+ to add, − to remove)</label>
                <input className="input font-mono" type="number" placeholder="+50 or -10" value={adjustQty} onChange={e => setAdjustQty(e.target.value)} />
              </div>
              <div>
                <label className="label">Reason</label>
                <input className="input" placeholder="e.g. Restock, Damage, Return" value={adjustReason} onChange={e => setAdjustReason(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t bg-gray-50">
              <button onClick={() => setAdjustProduct(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={submitAdjust} disabled={!adjustQty || adjustMut.isPending} className="btn-primary flex-1 justify-center">Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
