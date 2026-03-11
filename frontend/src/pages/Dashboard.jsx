import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, RadarChart, PolarGrid,
  PolarAngleAxis, Radar,
} from 'recharts'
import {
  Database, FileText, Tag, TrendingUp, AlertTriangle,
  CheckCircle, Activity, Clock, ArrowUpRight,
} from 'lucide-react'
import { dashboardApi, syntheticApi } from '../api/client'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import { FullPageLoader } from '../components/ui/LoadingSpinner'

const SCORE_COLOR = (v) => {
  if (v >= 8.5) return 'text-emerald-400'
  if (v >= 7.0) return 'text-amber-400'
  return 'text-red-400'
}

function MetricCard({ icon: Icon, label, value, sub, color = 'brand' }) {
  const colors = {
    brand:   'text-brand-400 bg-brand-600/10',
    emerald: 'text-emerald-400 bg-emerald-600/10',
    amber:   'text-amber-400 bg-amber-600/10',
    red:     'text-red-400 bg-red-600/10',
    purple:  'text-purple-400 bg-purple-600/10',
    cyan:    'text-cyan-400 bg-cyan-600/10',
  }
  return (
    <div className="metric-card">
      <div className="flex items-start justify-between">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon className="w-4.5 h-4.5" size={18} />
        </div>
        <ArrowUpRight className="w-3.5 h-3.5 text-gray-700" />
      </div>
      <p className="text-2xl font-bold text-white mt-2">{value}</p>
      <p className="text-xs font-medium text-gray-400">{label}</p>
      {sub && <p className="text-[11px] text-gray-600 mt-0.5">{sub}</p>}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 text-xs shadow-xl">
      <p className="font-medium text-gray-200 mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-400">{p.name}:</span>
          <span className="text-white font-mono">{Number(p.value).toFixed(1)}</span>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [trends, setTrends] = useState([])
  const [activity, setActivity] = useState([])
  const [datasets, setDatasets] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      dashboardApi.getStats(),
      dashboardApi.getTrends(),
      dashboardApi.getRecentActivity(),
      syntheticApi.getDatasets(),
    ])
      .then(([s, t, a, d]) => {
        setStats(s.data)
        setTrends(t.data)
        setActivity(a.data)
        setDatasets(d.data.slice(0, 5))
      })
      .finally(() => setLoading(false))
  }, [])

  // Build radar data from latest trend point
  const radarData = trends.length
    ? [
        { dim: 'Coherence', value: trends.at(-1).coherence },
        { dim: 'Diversity',  value: trends.at(-1).diversity },
        { dim: 'Coverage',   value: trends.at(-1).coverage },
        { dim: 'Accuracy',   value: trends.at(-1).accuracy },
        { dim: 'Overall',    value: trends.at(-1).avg_score },
      ]
    : []

  if (loading) return <FullPageLoader message="Loading dashboard…" />

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard icon={Database}      label="Total Datasets"     value={stats?.total_datasets ?? 0}      color="brand"   sub="Active pipelines" />
        <MetricCard icon={FileText}      label="Total Samples"      value={stats?.total_samples ?? 0}       color="cyan"    sub="Across all sets" />
        <MetricCard icon={Tag}           label="Annotations"        value={stats?.total_annotations ?? 0}   color="purple"  sub="Human labels" />
        <MetricCard icon={TrendingUp}    label="Avg Quality Score"  value={stats ? `${stats.avg_quality_score}/10` : '—'} color="emerald" sub="LLM-as-Judge" />
        <MetricCard icon={Activity}      label="Avg κ (Kappa)"      value={stats ? stats.avg_kappa_score.toFixed(3) : '—'} color="amber"   sub="Inter-annotator" />
        <MetricCard icon={AlertTriangle} label="Flagged Samples"    value={stats?.flagged_samples ?? 0}     color="red"     sub="Below threshold" />
      </div>

      {/* ── Charts Row ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Quality Trend */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <p className="section-title">Quality Score Trends</p>
            <Badge variant="success">Live</Badge>
          </CardHeader>
          <CardBody className="pt-2">
            {trends.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-gray-600 text-sm">
                No evaluation data yet — run the Evaluation module to generate trends.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trends} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <YAxis domain={[5, 10]} tick={{ fill: '#6b7280', fontSize: 11 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
                  <Line type="monotone" dataKey="avg_score"  name="Overall"   stroke="#6366f1" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="coherence"  name="Coherence" stroke="#10b981" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                  <Line type="monotone" dataKey="accuracy"   name="Accuracy"  stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                  <Line type="monotone" dataKey="diversity"  name="Diversity" stroke="#8b5cf6" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>

        {/* Radar */}
        <Card>
          <CardHeader>
            <p className="section-title">Dimension Profile</p>
            <span className="text-xs text-gray-500">Latest batch</span>
          </CardHeader>
          <CardBody className="pt-0">
            {radarData.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-gray-600 text-sm text-center px-4">
                Run an evaluation to see the quality radar.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#1f2937" />
                  <PolarAngleAxis dataKey="dim" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <Radar dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>
      </div>

      {/* ── Bottom Row ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Datasets Table */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <p className="section-title">Recent Datasets</p>
            <a href="/generate" className="text-xs text-brand-400 hover:text-brand-300">View all →</a>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  {['Dataset', 'Type', 'Samples', 'Eval Status', 'Created'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {datasets.map((ds) => (
                  <tr key={ds.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-gray-200 max-w-[200px] truncate">{ds.name}</td>
                    <td className="px-5 py-3.5">
                      <Badge variant={ds.task_type === 'intent_classification' ? 'brand' : ds.task_type === 'sentiment_analysis' ? 'purple' : 'cyan'}>
                        {ds.task_type.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-gray-400 font-mono text-xs">{ds.sample_count}</td>
                    <td className="px-5 py-3.5">
                      <Badge variant={
                        ds.evaluation_status === 'completed' ? 'success' :
                        ds.evaluation_status === 'running'   ? 'warning' :
                        ds.evaluation_status === 'error'     ? 'danger'  : 'default'
                      }>
                        {ds.evaluation_status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs">
                      {new Date(ds.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {datasets.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-600 text-sm">No datasets yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Activity Feed */}
        <Card>
          <CardHeader>
            <p className="section-title">Recent Activity</p>
            <Clock className="w-4 h-4 text-gray-600" />
          </CardHeader>
          <CardBody className="p-0">
            <ul className="divide-y divide-gray-800/60">
              {activity.slice(0, 8).map((item, i) => (
                <li key={i} className="px-5 py-3 flex gap-3 items-start hover:bg-gray-800/20">
                  <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                    item.type === 'evaluation_completed' ? 'bg-emerald-400' :
                    item.type === 'dataset_created'      ? 'bg-brand-400'   :
                    'bg-amber-400'
                  }`} />
                  <div>
                    <p className="text-xs text-gray-300 leading-snug">{item.message}</p>
                    <p className="text-[10px] text-gray-600 mt-0.5">
                      {new Date(item.timestamp).toLocaleString()}
                    </p>
                  </div>
                </li>
              ))}
              {activity.length === 0 && (
                <li className="px-5 py-8 text-center text-gray-600 text-sm">No activity yet.</li>
              )}
            </ul>
          </CardBody>
        </Card>
      </div>

      {/* ── Annotation Completion Bar ── */}
      {stats && (
        <Card>
          <CardBody className="flex items-center gap-4">
            <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-gray-400">Annotation Completion Rate</span>
                <span className="font-mono text-white">{stats.annotation_completion_rate}%</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-brand-600 to-emerald-500 rounded-full transition-all duration-700"
                  style={{ width: `${stats.annotation_completion_rate}%` }}
                />
              </div>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  )
}
