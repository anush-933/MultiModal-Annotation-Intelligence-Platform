import { useEffect, useState } from 'react'
import {
  ClipboardList, CheckCircle, AlertTriangle, ChevronRight,
  RefreshCw, Users, Activity, Info,
} from 'lucide-react'
import { syntheticApi, annotationApi } from '../api/client'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import clsx from 'clsx'

const TASK_LABELS = {
  intent_classification: [
    'play_music', 'set_alarm', 'get_weather', 'control_device',
    'send_message', 'search_web', 'navigate', 'set_reminder',
    'schedule_meeting', 'summarize',
  ],
  sentiment_analysis: ['positive', 'negative', 'neutral', 'mixed'],
  question_answering: ['correct', 'incorrect', 'partial'],
  text_classification: ['category_a', 'category_b', 'category_c', 'other'],
}

const LABEL_COLORS = {
  positive: 'success', negative: 'danger', neutral: 'default', mixed: 'warning',
  play_music: 'purple', set_alarm: 'cyan', get_weather: 'brand',
  control_device: 'warning', send_message: 'success', search_web: 'default',
  navigate: 'cyan', set_reminder: 'amber', schedule_meeting: 'brand',
  summarize: 'purple', correct: 'success', incorrect: 'danger', partial: 'warning',
}

function KappaGauge({ kappa }) {
  const pct = Math.max(0, Math.min(100, ((kappa + 1) / 2) * 100))
  const color = kappa >= 0.8 ? '#10b981' : kappa >= 0.6 ? '#f59e0b' : '#ef4444'
  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 80 50" className="w-28">
        <path d="M 10 45 A 35 35 0 0 1 70 45" fill="none" stroke="#1f2937" strokeWidth="8" strokeLinecap="round" />
        <path
          d="M 10 45 A 35 35 0 0 1 70 45"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${pct * 1.1} 110`}
        />
        <text x="40" y="44" textAnchor="middle" fill="white" fontSize="13" fontWeight="bold" fontFamily="monospace">
          {kappa.toFixed(3)}
        </text>
      </svg>
    </div>
  )
}

export default function AnnotationWorkspace() {
  const [datasets, setDatasets]   = useState([])
  const [activeDs, setActiveDs]   = useState(null)
  const [queue, setQueue]         = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [iaaData, setIaaData]     = useState(null)
  const [annotatorId, setAnnotatorId] = useState('annotator_1')
  const [selectedLabel, setSelectedLabel] = useState('')
  const [confidence, setConfidence] = useState(0.9)
  const [notes, setNotes]         = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitMsg, setSubmitMsg] = useState(null)

  useEffect(() => {
    syntheticApi.getDatasets().then((r) => setDatasets(r.data))
  }, [])

  const loadQueue = async (datasetId) => {
    const r = await annotationApi.getQueue(datasetId)
    setQueue(r.data)
    setCurrentIdx(0)
    setSelectedLabel('')
    setNotes('')
    setSubmitMsg(null)
    loadIAA(datasetId)
  }

  const loadIAA = async (datasetId) => {
    try {
      const r = await annotationApi.getIAA(datasetId)
      setIaaData(r.data)
    } catch { /* no annotations yet */ }
  }

  const handleSelectDataset = (id) => {
    setActiveDs(id)
    loadQueue(id)
  }

  const handleSubmit = async () => {
    if (!selectedLabel || !queue[currentIdx]) return
    setSubmitting(true)
    setSubmitMsg(null)
    try {
      await annotationApi.submitAnnotation({
        sample_id: queue[currentIdx].id,
        annotator_id: annotatorId,
        label: selectedLabel,
        confidence,
        notes,
      })
      setSubmitMsg({ type: 'success', text: `Labeled as "${selectedLabel}"` })
      setTimeout(() => {
        setQueue((q) => q.filter((_, i) => i !== currentIdx))
        setCurrentIdx((i) => Math.max(0, i - 1))
        setSelectedLabel('')
        setNotes('')
        setSubmitMsg(null)
        loadIAA(activeDs)
      }, 800)
    } catch (err) {
      setSubmitMsg({
        type: 'error',
        text: err.response?.data?.detail || 'Submission failed.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const activeDataset  = datasets.find((d) => d.id === activeDs)
  const currentSample  = queue[currentIdx]
  const labels         = TASK_LABELS[activeDataset?.task_type] || []
  const totalSamples   = activeDataset?.sample_count || 0
  const annotated      = totalSamples - queue.length
  const progressPct    = totalSamples ? Math.round((annotated / totalSamples) * 100) : 0

  return (
    <div className="max-w-7xl mx-auto space-y-5">

      {/* ── Controls Row ── */}
      <div className="flex flex-wrap items-center gap-4">
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
        <div>
          <label className="label-text">Annotator ID</label>
          <input
            className="input-field w-40"
            value={annotatorId}
            onChange={(e) => setAnnotatorId(e.target.value)}
          />
        </div>
        {activeDs && (
          <button onClick={() => loadQueue(activeDs)} className="btn-secondary mt-5">
            <RefreshCw className="w-3.5 h-3.5" />Refresh
          </button>
        )}
      </div>

      {activeDs && (
        <>
          {/* ── Stats Strip ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="metric-card">
              <p className="text-xl font-bold text-white">{queue.length}</p>
              <p className="text-xs text-gray-400">Pending</p>
            </div>
            <div className="metric-card">
              <p className="text-xl font-bold text-emerald-400">{annotated}</p>
              <p className="text-xs text-gray-400">Annotated</p>
            </div>
            <div className="metric-card">
              <p className="text-xl font-bold text-brand-400">{progressPct}%</p>
              <p className="text-xs text-gray-400">Complete</p>
            </div>
            <div className="metric-card">
              {iaaData ? (
                <>
                  <p className={`text-xl font-bold font-mono ${iaaData.kappa_score >= 0.7 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    κ {iaaData.kappa_score.toFixed(3)}
                  </p>
                  <p className="text-xs text-gray-400">IAA (Cohen's κ)</p>
                </>
              ) : (
                <p className="text-xs text-gray-600 mt-2">No IAA yet</p>
              )}
            </div>
          </div>

          {/* ── Progress Bar ── */}
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-600 to-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          {/* ── Main Panel ── */}
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">

            {/* Queue List */}
            <Card className="xl:col-span-2">
              <CardHeader>
                <p className="section-title flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-gray-400" />
                  Sample Queue
                </p>
                <span className="text-xs text-gray-500">{queue.length} remaining</span>
              </CardHeader>
              <div className="overflow-y-auto max-h-[420px] divide-y divide-gray-800/60">
                {queue.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-600 gap-2">
                    <CheckCircle className="w-8 h-8 text-emerald-600" />
                    <p className="text-sm">All samples annotated!</p>
                  </div>
                ) : (
                  queue.map((s, i) => (
                    <button
                      key={s.id}
                      onClick={() => { setCurrentIdx(i); setSelectedLabel(''); setNotes('') }}
                      className={clsx(
                        'w-full flex items-start gap-3 px-4 py-3 text-left transition-colors',
                        i === currentIdx ? 'bg-brand-600/10 border-l-2 border-brand-500' : 'hover:bg-gray-800/30 border-l-2 border-transparent'
                      )}
                    >
                      <span className="text-[10px] text-gray-600 font-mono mt-0.5 w-6 shrink-0">#{s.id}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-300 truncate">{s.content}</p>
                        <div className="flex gap-1 mt-1">
                          <Badge variant="default" className="text-[9px]">{s.persona}</Badge>
                          {s.annotation_status === 'flagged' && <Badge variant="danger" className="text-[9px]">flagged</Badge>}
                        </div>
                      </div>
                      {i === currentIdx && <ChevronRight className="w-3.5 h-3.5 text-brand-400 shrink-0 mt-0.5" />}
                    </button>
                  ))
                )}
              </div>
            </Card>

            {/* Labeling Interface */}
            <Card className="xl:col-span-3">
              <CardHeader>
                <p className="section-title">Label Sample</p>
                {currentSample && (
                  <Badge variant={currentSample.annotation_status === 'flagged' ? 'danger' : 'default'}>
                    {currentSample.annotation_status}
                  </Badge>
                )}
              </CardHeader>
              <CardBody className="space-y-5">
                {!currentSample ? (
                  <div className="flex flex-col items-center justify-center h-48 text-gray-600 gap-2">
                    <Info className="w-6 h-6" />
                    <p className="text-sm">{queue.length === 0 ? 'All done! No pending samples.' : 'Select a sample from the queue.'}</p>
                  </div>
                ) : (
                  <>
                    {/* Sample content */}
                    <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                      <p className="text-gray-100 leading-relaxed">{currentSample.content}</p>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <Badge variant="brand"><Users className="w-2.5 h-2.5 mr-1" />{currentSample.persona}</Badge>
                        <Badge variant="default">{currentSample.register}</Badge>
                        {(currentSample.meta_info?.is_edge_case) && (
                          <Badge variant="warning"><AlertTriangle className="w-2.5 h-2.5 mr-1" />edge case</Badge>
                        )}
                      </div>
                    </div>

                    {/* Label buttons */}
                    <div>
                      <label className="label-text">Select Label</label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {labels.map((lbl) => (
                          <button
                            key={lbl}
                            onClick={() => setSelectedLabel(lbl)}
                            className={clsx(
                              'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                              selectedLabel === lbl
                                ? 'bg-brand-600 border-brand-500 text-white shadow-lg shadow-brand-900/40'
                                : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                            )}
                          >
                            {lbl.replace('_', ' ')}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Confidence slider */}
                    <div>
                      <div className="flex justify-between">
                        <label className="label-text">Confidence</label>
                        <span className="text-xs font-mono text-brand-400">{confidence.toFixed(2)}</span>
                      </div>
                      <input
                        type="range" min="0.5" max="1" step="0.05"
                        className="w-full accent-brand-500 mt-1"
                        value={confidence}
                        onChange={(e) => setConfidence(parseFloat(e.target.value))}
                      />
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="label-text">Notes (optional)</label>
                      <input
                        className="input-field"
                        placeholder="Any comments about this sample…"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </div>

                    {/* Submit */}
                    {submitMsg && (
                      <div className={clsx(
                        'flex items-center gap-2 p-3 rounded-lg text-xs',
                        submitMsg.type === 'success'
                          ? 'bg-emerald-900/20 border border-emerald-800/40 text-emerald-400'
                          : 'bg-red-900/20 border border-red-800/40 text-red-400'
                      )}>
                        {submitMsg.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                        {submitMsg.text}
                      </div>
                    )}

                    <button
                      onClick={handleSubmit}
                      disabled={!selectedLabel || submitting}
                      className="btn-primary w-full justify-center"
                    >
                      {submitting ? <><LoadingSpinner size="sm" />Submitting…</> : <><CheckCircle className="w-4 h-4" />Submit Annotation</>}
                    </button>
                  </>
                )}
              </CardBody>
            </Card>
          </div>

          {/* ── IAA Panel ── */}
          {iaaData && iaaData.num_samples_evaluated > 0 && (
            <Card>
              <CardHeader>
                <p className="section-title flex items-center gap-2">
                  <Activity className="w-4 h-4 text-amber-400" />
                  Inter-Annotator Agreement — Cohen's Kappa
                </p>
                <Badge variant={iaaData.kappa_score >= 0.8 ? 'success' : iaaData.kappa_score >= 0.6 ? 'warning' : 'danger'}>
                  {iaaData.interpretation}
                </Badge>
              </CardHeader>
              <CardBody>
                <div className="flex flex-wrap items-center gap-8">
                  <KappaGauge kappa={iaaData.kappa_score} />
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 flex-1">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Agreement %</p>
                      <p className="text-lg font-bold font-mono text-white">{iaaData.agreement_pct}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Samples Evaluated</p>
                      <p className="text-lg font-bold font-mono text-white">{iaaData.num_samples_evaluated}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Flagged (Disagreement)</p>
                      <p className={`text-lg font-bold font-mono ${iaaData.flagged_samples.length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {iaaData.flagged_samples.length}
                      </p>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}
        </>
      )}

      {!activeDs && (
        <div className="flex flex-col items-center justify-center h-64 text-gray-600 gap-3">
          <ClipboardList className="w-10 h-10" />
          <p className="text-sm">Select a dataset above to start annotating.</p>
        </div>
      )}
    </div>
  )
}
