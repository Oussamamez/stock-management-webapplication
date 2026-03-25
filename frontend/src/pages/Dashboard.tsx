import { useQuery } from '@tanstack/react-query'
import { api, DashboardStats } from '../lib/api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ShoppingCart, DollarSign, AlertTriangle, FileText, TrendingUp, Package } from 'lucide-react'
import { format } from 'date-fns'

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  processing: 'bg-purple-100 text-purple-800',
  shipped: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
}

function StatCard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { data, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard').then(r => r.data),
  })

  if (isLoading) return (
    <div className="flex items-center justify-center h-full min-h-96">
      <div className="text-gray-400">Loading dashboard…</div>
    </div>
  )

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-0.5">Welcome back — here's what's happening today.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={ShoppingCart} label="Orders Today" value={data?.total_orders_today ?? 0} sub={`${data?.total_orders_month ?? 0} this month`} color="bg-blue-50 text-blue-600" />
        <StatCard icon={DollarSign} label="Revenue This Month" value={`$${(data?.revenue_month ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} sub={`$${(data?.revenue_today ?? 0).toFixed(2)} today`} color="bg-green-50 text-green-600" />
        <StatCard icon={AlertTriangle} label="Low Stock Items" value={data?.low_stock_count ?? 0} sub="Need restocking" color="bg-orange-50 text-orange-600" />
        <StatCard icon={FileText} label="Outstanding Invoices" value={data?.outstanding_invoices ?? 0} sub="Draft or sent" color="bg-purple-50 text-purple-600" />
      </div>

      {/* Chart + Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue chart */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-indigo-600" />
            <h2 className="text-base font-semibold text-gray-900">Revenue (Last 30 Days)</h2>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data?.daily_revenue ?? []} barSize={6}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={4} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `$${v}`} />
              <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`, 'Revenue']} />
              <Bar dataKey="revenue" fill="#6366f1" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Low stock */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            <h2 className="text-base font-semibold text-gray-900">Low Stock Alerts</h2>
          </div>
          {(data?.low_stock_products ?? []).length === 0 ? (
            <p className="text-sm text-gray-400 mt-2">All items well-stocked!</p>
          ) : (
            <div className="space-y-3">
              {data?.low_stock_products.map(p => (
                <div key={p.id} className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.sku}</p>
                  </div>
                  <span className={`badge ml-2 shrink-0 ${p.stock_quantity === 0 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                    {p.stock_quantity} left
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent orders */}
      <div className="card">
        <div className="p-5 border-b border-gray-100 flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-indigo-600" />
          <h2 className="text-base font-semibold text-gray-900">Recent Orders</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-th">Order #</th>
                <th className="table-th">Customer</th>
                <th className="table-th">Items</th>
                <th className="table-th">Total</th>
                <th className="table-th">Status</th>
                <th className="table-th">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(data?.recent_orders ?? []).map(order => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="table-td font-mono text-xs">{order.order_number}</td>
                  <td className="table-td">{order.customer?.name}</td>
                  <td className="table-td">{order.items.length}</td>
                  <td className="table-td font-medium">${Number(order.total_amount).toFixed(2)}</td>
                  <td className="table-td">
                    <span className={`badge capitalize ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-700'}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="table-td text-gray-500">{format(new Date(order.created_at), 'MMM d, h:mm a')}</td>
                </tr>
              ))}
              {(data?.recent_orders ?? []).length === 0 && (
                <tr><td colSpan={6} className="table-td text-center text-gray-400 py-8">No orders yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
