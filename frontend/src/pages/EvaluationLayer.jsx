import { useEffect, useState, useRef } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import {
  BarChart3, Play, Download, RefreshCw, AlertTriangle,
  CheckCircle, Loader, Flag, TrendingUp,
} from 'lucide-react'
import { syntheticApi, evaluationApi } from '../api/client'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import clsx from 'clsx'

const DIM_COLORS = {
  coherence: '#10b981',
  diversity:  '#8b5cf6',
  coverage:   '#6366f1',
  accuracy:   '#f59e0b',
}

const scoreColor = (v) =>
  v >= 8.5 ? 'text-emerald-400' : v >= 7 ? 'text-amber-400' : 'text-red-400'

const ScoreBar = ({ value, max = 10, color }) => (
  <div className="flex items-center gap-2">
    <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${(value / max) * 100}%`, background: color }}
      />
    </div>
    <span className={`text-xs font-mono w-8 text-right ${scoreColor(value)}`}>{value.toFixed(1)}</span>
  </div>
)

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-xl text-xs">
      <p className="font-medium text-gray-200 mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.fill }} />
          <span className="text-gray-400">{p.name}:</span>
          <span className="text-white font-mono">{Number(p.value).toFixed(2)}</span>
        </div>
      ))}
    </div>
  )
}

export default function EvaluationLayer() {
  const [datasets, setDatasets]   = useState([])
  const [activeDs, setActiveDs]   = useState(null)
  const [status, setStatus]       = useState(null)    // {evaluation_status, progress_pct, …}
  const [summary, setSummary]     = useState(null)
  const [results, setResults]     = useState([])
  const [samples, setSamples]     = useState([])
  const [running, setRunning]     = useState(false)
  const pollRef = useRef(null)

  useEffect(() => {
    syntheticApi.getDatasets().then((r) => setDatasets(r.data))
    return () => clearInterval(pollRef.current)
  }, [])

  const loadEvalData = async (datasetId) => {
    try {
      const [statusRes, samplesRes] = await Promise.all([
        evaluationApi.getStatus(datasetId),
        syntheticApi.getSamples(datasetId),
      ])
      setStatus(statusRes.data)
      setSamples(samplesRes.data)
      if (statusRes.data.evaluation_status === 'completed') {
        const [sumRes, resRes] = await Promise.all([
          evaluationApi.getSummary(datasetId).catch(() => null),
          evaluationApi.getResults(datasetId),
        ])
        setSummary(sumRes?.data || null)
        setResults(resRes.data)
      }
    } catch { /* not yet evaluated */ }
  }

  const handleSelectDataset = (id) => {
    clearInterval(pollRef.current)
    setActiveDs(id)
    setStatus(null)
    setSummary(null)
    setResults([])
    setRunning(false)
    loadEvalData(id)
  }

  const handleRun = async () => {
    if (!activeDs) return
    setRunning(true)
    setSummary(null)
    setResults([])
    await evaluationApi.run({ dataset_id: activeDs })

    // Poll for completion
    pollRef.current = setInterval(async () => {
      const r = await evaluationApi.getStatus(activeDs)
      setStatus(r.data)
      if (r.data.evaluation_status === 'completed') {
        clearInterval(pollRef.current)
        setRunning(false)
        const [sumRes, resRes] = await Promise.all([
          evaluationApi.getSummary(activeDs).catch(() => null),
          evaluationApi.getResults(activeDs),
        ])
        setSummary(sumRes?.data || null)
        setResults(resRes.data)
      }
      if (r.data.evaluation_status === 'error') {
        clearInterval(pollRef.current)
        setRunning(false)
      }
    }, 2500)
  }

  const handleExport = () => {
    const ds = datasets.find((d) => d.id === activeDs)
    const sampleMap = Object.fromEntries(samples.map((s) => [s.id, s]))
    const lines = results.map((ev) => {
      const s = sampleMap[ev.sample_id] || {}
      return JSON.stringify({
        sample_id: ev.sample_id,
        content:   s.content,
        label:     s.label,
        scores: {
          coherence: ev.coherence_score,
          diversity: ev.diversity_score,
          coverage:  ev.coverage_score,
          accuracy:  ev.accuracy_score,
          overall:   ev.overall_score,
        },
        flagged:   ev.flagged,
        reasoning: ev.reasoning,
      })
    })
    const blob = new Blob([lines.join('\n')], { type: 'application/x-ndjson' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${ds?.name?.replace(/ /g, '_')}_evaluations.jsonl`
    a.click()
  }

  // Bar chart data
  const barData = summary
    ? [
        { name: 'Coherence', value: summary.avg_coherence, fill: DIM_COLORS.coherence },
        { name: 'Diversity',  value: summary.avg_diversity, fill: DIM_COLORS.diversity  },
        { name: 'Coverage',   value: summary.avg_coverage,  fill: DIM_COLORS.coverage   },
        { name: 'Accuracy',   value: summary.avg_accuracy,  fill: DIM_COLORS.accuracy   },
      ]
    : []

  const sampleMap = Object.fromEntries(samples.map((s) => [s.id, s]))

  return (
    <div className="max-w-7xl mx-auto space-y-5">

      {/* ── Controls ── */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-48">
          <label className="label-text">Select Dataset</label>
          <select
            className="input-field"
            value={activeDs || ''}
            onChange={(e) => handleSelectDataset(Number(e.target.value))}
          >
            <option value="">— choose a dataset —</option>
            {datasets.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleRun}
          disabled={!activeDs || running}
          className="btn-primary"
        >
          {running
            ? <><LoadingSpinner size="sm" />Evaluating {status?.progress_pct ?? 0}%…</>
            : <><Play className="w-4 h-4" />Run Evaluation</>}
        </button>
        {results.length > 0 && (
          <button onClick={handleExport} className="btn-secondary">
            <Download className="w-4 h-4" />Export JSONL
          </button>
        )}
        {activeDs && (
          <button onClick={() => loadEvalData(activeDs)} className="btn-secondary">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* ── Progress Bar (while running) ── */}
      {running && status && (
        <Card>
          <CardBody className="flex items-center gap-4 py-3">
            <Loader className="w-4 h-4 text-brand-400 animate-spin" />
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-gray-400">LLM-as-Judge evaluating samples…</span>
                <span className="font-mono text-white">
                  {status.evaluated_samples}/{status.total_samples} ({status.progress_pct}%)
                </span>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-brand-600 to-purple-500 rounded-full transition-all duration-300"
                  style={{ width: `${status.progress_pct}%` }}
                />
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ── Summary Cards ── */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          {[
            { label: 'Overall',   value: summary.avg_overall,   color: 'brand'   },
            { label: 'Coherence', value: summary.avg_coherence, color: 'emerald' },
            { label: 'Diversity', value: summary.avg_diversity, color: 'purple'  },
            { label: 'Coverage',  value: summary.avg_coverage,  color: 'cyan'    },
            { label: 'Accuracy',  value: summary.avg_accuracy,  color: 'amber'   },
            { label: 'Pass Rate', value: summary.pass_rate, suffix: '%', color: summary.pass_rate >= 80 ? 'emerald' : 'amber' },
          ].map(({ label, value, suffix = '', color }) => (
            <div key={label} className="metric-card">
              <p className={`text-2xl font-bold font-mono ${color === 'brand' ? 'text-brand-400' : color === 'emerald' ? 'text-emerald-400' : color === 'purple' ? 'text-purple-400' : color === 'cyan' ? 'text-cyan-400' : color === 'amber' ? 'text-amber-400' : 'text-white'}`}>
                {value.toFixed(suffix ? 1 : 2)}{suffix}
              </p>
              <p className="text-xs text-gray-400">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Chart + Flagged ── */}
      {summary && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <Card className="xl:col-span-2">
            <CardHeader>
              <p className="section-title flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-gray-400" />
                Score Breakdown by Dimension
              </p>
              <span className="text-xs text-gray-500">{summary.total_evaluated} samples</span>
            </CardHeader>
            <CardBody>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 10]} tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1f2937' }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={60}>
                    {barData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <p className="section-title flex items-center gap-2">
                <Flag className="w-4 h-4 text-red-400" />
                Quality Gate
              </p>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="text-center">
                <p className={`text-4xl font-bold font-mono ${summary.pass_rate >= 80 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {summary.pass_rate}%
                </p>
                <p className="text-xs text-gray-500 mt-1">Pass Rate (&gt;6.0 threshold)</p>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Passed</span>
                  <span className="text-emerald-400 font-mono">{summary.total_evaluated - summary.flagged_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Flagged</span>
                  <span className="text-red-400 font-mono">{summary.flagged_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Total</span>
                  <span className="text-white font-mono">{summary.total_evaluated}</span>
                </div>
              </div>
              <div className="space-y-2 pt-2 border-t border-gray-800">
                <p className="text-xs text-gray-500 mb-2">Score Profile</p>
                {Object.entries(DIM_COLORS).map(([dim, color]) => {
                  const val = summary[`avg_${dim}`]
                  return (
                    <div key={dim}>
                      <span className="text-[10px] text-gray-500 capitalize">{dim}</span>
                      <ScoreBar value={val} color={color} />
                    </div>
                  )
                })}
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* ── Results Table ── */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <p className="section-title flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-gray-400" />
              Sample-Level Results
            </p>
            <Badge variant="default">{results.length} evaluated</Badge>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  {['#', 'Content', 'Label', 'Coh', 'Div', 'Cov', 'Acc', 'Overall', 'Status'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {results.map((ev) => {
                  const sample = sampleMap[ev.sample_id]
                  return (
                    <tr key={ev.id} className={clsx('hover:bg-gray-800/20 transition-colors', ev.flagged && 'bg-red-900/5')}>
                      <td className="px-4 py-3 text-xs text-gray-600 font-mono">{ev.sample_id}</td>
                      <td className="px-4 py-3 max-w-[220px]">
                        <p className="text-xs text-gray-300 truncate">{sample?.content || '—'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="default" className="text-[10px]">{sample?.label || '—'}</Badge>
                      </td>
                      <td className={`px-4 py-3 score-cell ${scoreColor(ev.coherence_score)}`}>{ev.coherence_score.toFixed(1)}</td>
                      <td className={`px-4 py-3 score-cell ${scoreColor(ev.diversity_score)}`}>{ev.diversity_score.toFixed(1)}</td>
                      <td className={`px-4 py-3 score-cell ${scoreColor(ev.coverage_score)}`}>{ev.coverage_score.toFixed(1)}</td>
                      <td className={`px-4 py-3 score-cell ${scoreColor(ev.accuracy_score)}`}>{ev.accuracy_score.toFixed(1)}</td>
                      <td className={`px-4 py-3 score-cell font-bold text-sm ${scoreColor(ev.overall_score)}`}>{ev.overall_score.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        {ev.flagged
                          ? <Badge variant="danger"><AlertTriangle className="w-2.5 h-2.5 mr-1" />Flagged</Badge>
                          : <Badge variant="success"><CheckCircle className="w-2.5 h-2.5 mr-1" />Pass</Badge>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!activeDs && (
        <div className="flex flex-col items-center justify-center h-64 text-gray-600 gap-3">
          <BarChart3 className="w-10 h-10" />
          <p className="text-sm">Select a dataset above to run or view evaluations.</p>
        </div>
      )}
    </div>
  )
}
