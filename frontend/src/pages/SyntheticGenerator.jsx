import { useEffect, useState } from 'react'
import {
  Wand2, Trash2, Download, RefreshCw, ChevronDown, ChevronUp,
  Sparkles, Tag, User, BookOpen, AlertCircle, CheckCircle2,
} from 'lucide-react'
import { syntheticApi } from '../api/client'
import Card, { CardHeader, CardBody } from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import clsx from 'clsx'

const TASK_TYPES = [
  { value: 'intent_classification', label: 'Intent Classification' },
  { value: 'sentiment_analysis',    label: 'Sentiment Analysis' },
  { value: 'question_answering',    label: 'Question Answering' },
  { value: 'text_classification',   label: 'Text Classification' },
]

const PERSONA_OPTIONS = ['formal', 'casual', 'technical', 'regional', 'colloquial', 'domain_expert']

const PERSONA_BADGE = {
  formal: 'brand', casual: 'success', technical: 'cyan',
  regional: 'purple', colloquial: 'amber', domain_expert: 'warning',
}

const REGISTER_BADGE = {
  formal: 'brand', informal: 'success', technical: 'cyan', colloquial: 'purple',
}

function SampleCard({ sample, index }) {
  const [open, setOpen] = useState(false)
  const meta = sample.meta_info || {}
  return (
    <div className="glass-card p-4 space-y-2.5 hover:border-gray-700 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-gray-200 leading-snug flex-1">{sample.content}</p>
        <span className="text-[10px] text-gray-600 font-mono shrink-0">#{index + 1}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Badge variant={PERSONA_BADGE[sample.persona] || 'default'}>
          <User className="w-2.5 h-2.5 mr-1" />{sample.persona}
        </Badge>
        <Badge variant={REGISTER_BADGE[sample.register] || 'default'}>
          {sample.register}
        </Badge>
        <Badge variant="warning">
          <Tag className="w-2.5 h-2.5 mr-1" />{sample.label}
        </Badge>
        {meta.is_edge_case && <Badge variant="danger">edge case</Badge>}
        {meta.difficulty && <Badge variant="default">{meta.difficulty}</Badge>}
      </div>
      {meta.linguistic_features?.length > 0 && (
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-gray-400"
        >
          {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          linguistic features
        </button>
      )}
      {open && (
        <div className="flex flex-wrap gap-1">
          {meta.linguistic_features.map((f) => (
            <span key={f} className="text-[10px] px-1.5 py-0.5 bg-gray-800 text-gray-500 rounded font-mono">{f}</span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function SyntheticGenerator() {
  const [datasets, setDatasets]   = useState([])
  const [samples, setSamples]     = useState([])
  const [activeDs, setActiveDs]   = useState(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError]         = useState(null)
  const [success, setSuccess]     = useState(null)

  const [form, setForm] = useState({
    name:         '',
    task_schema:  '',
    task_type:    'intent_classification',
    num_samples:  10,
    persona_types: ['formal', 'casual', 'technical'],
  })

  const loadDatasets = () => syntheticApi.getDatasets().then((r) => setDatasets(r.data))

  useEffect(() => { loadDatasets() }, [])

  const togglePersona = (p) =>
    setForm((f) => ({
      ...f,
      persona_types: f.persona_types.includes(p)
        ? f.persona_types.filter((x) => x !== p)
        : [...f.persona_types, p],
    }))

  const handleGenerate = async (e) => {
    e.preventDefault()
    if (!form.name || !form.task_schema) return
    setGenerating(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await syntheticApi.generate(form)
      setSuccess(`Dataset "${res.data.name}" generated with ${res.data.sample_count ?? form.num_samples} samples!`)
      await loadDatasets()
      handleSelectDataset(res.data.id)
    } catch (err) {
      setError(err.response?.data?.detail || 'Generation failed. Check API key or server.')
    } finally {
      setGenerating(false)
    }
  }

  const handleSelectDataset = async (id) => {
    setActiveDs(id)
    const r = await syntheticApi.getSamples(id)
    setSamples(r.data)
  }

  const handleDelete = async (id) => {
    await syntheticApi.deleteDataset(id)
    setDatasets((d) => d.filter((x) => x.id !== id))
    if (activeDs === id) { setActiveDs(null); setSamples([]) }
  }

  const handleExport = async (id, name) => {
    const res = await syntheticApi.exportDataset(id)
    const url = URL.createObjectURL(new Blob([res.data]))
    const a = document.createElement('a')
    a.href = url
    a.download = `${name.replace(/ /g, '_').toLowerCase()}.jsonl`
    a.click()
    URL.revokeObjectURL(url)
  }

  const currentDataset = datasets.find((d) => d.id === activeDs)

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">

        {/* ── Config Form ── */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <p className="section-title flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-400" /> Configure Generation
            </p>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="label-text">Dataset Name</label>
                <input
                  className="input-field"
                  placeholder="e.g. Voice Assistant Intents v2"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label-text">Task Schema</label>
                <textarea
                  className="input-field resize-none h-24"
                  placeholder="Describe the task in detail, e.g. 'Multi-class intent classification for a smart home voice assistant covering 10 intent categories including media control, device automation, and scheduling.'"
                  value={form.task_schema}
                  onChange={(e) => setForm({ ...form, task_schema: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="label-text">Task Type</label>
                <select
                  className="input-field"
                  value={form.task_type}
                  onChange={(e) => setForm({ ...form, task_type: e.target.value })}
                >
                  {TASK_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-text">Number of Samples</label>
                <input
                  type="number" min={5} max={50}
                  className="input-field"
                  value={form.num_samples}
                  onChange={(e) => setForm({ ...form, num_samples: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <label className="label-text">Persona Types</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {PERSONA_OPTIONS.map((p) => (
                    <button
                      key={p} type="button"
                      onClick={() => togglePersona(p)}
                      className={clsx(
                        'px-2.5 py-1 rounded-md text-xs font-medium border transition-all',
                        form.persona_types.includes(p)
                          ? 'bg-brand-600/20 border-brand-600/50 text-brand-300'
                          : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300'
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-800/40 rounded-lg text-red-400 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />{error}
                </div>
              )}
              {success && (
                <div className="flex items-center gap-2 p-3 bg-emerald-900/20 border border-emerald-800/40 rounded-lg text-emerald-400 text-xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />{success}
                </div>
              )}

              <button type="submit" disabled={generating} className="btn-primary w-full justify-center">
                {generating
                  ? <><LoadingSpinner size="sm" />Generating with Claude…</>
                  : <><Wand2 className="w-4 h-4" />Generate Dataset</>}
              </button>
            </form>
          </CardBody>
        </Card>

        {/* ── Dataset List + Samples ── */}
        <div className="xl:col-span-3 space-y-5">
          {/* Dataset list */}
          <Card>
            <CardHeader>
              <p className="section-title">Datasets</p>
              <button onClick={loadDatasets} className="text-gray-500 hover:text-gray-300 transition-colors">
                <RefreshCw className="w-4 h-4" />
              </button>
            </CardHeader>
            <div className="divide-y divide-gray-800/60 max-h-52 overflow-y-auto">
              {datasets.length === 0 && (
                <p className="px-5 py-6 text-center text-gray-600 text-sm">No datasets yet. Generate your first one.</p>
              )}
              {datasets.map((ds) => (
                <div
                  key={ds.id}
                  onClick={() => handleSelectDataset(ds.id)}
                  className={clsx(
                    'flex items-center justify-between px-5 py-3.5 cursor-pointer transition-colors',
                    activeDs === ds.id ? 'bg-brand-600/10' : 'hover:bg-gray-800/40'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-200 truncate">{ds.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="default" className="text-[10px]">{ds.task_type.replace('_', ' ')}</Badge>
                      <span className="text-[10px] text-gray-600 font-mono">{ds.sample_count} samples</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleExport(ds.id, ds.name) }}
                      className="p-1.5 text-gray-600 hover:text-emerald-400 rounded transition-colors"
                      title="Export JSONL"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(ds.id) }}
                      className="p-1.5 text-gray-600 hover:text-red-400 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Samples grid */}
          {activeDs && (
            <Card>
              <CardHeader>
                <p className="section-title flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-gray-400" />
                  {currentDataset?.name}
                </p>
                <span className="text-xs text-gray-500">{samples.length} samples</span>
              </CardHeader>
              <CardBody>
                {samples.length === 0 ? (
                  <p className="text-center text-gray-600 text-sm py-6">
                    Dataset is still generating… refresh in a moment.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
                    {samples.map((s, i) => <SampleCard key={s.id} sample={s} index={i} />)}
                  </div>
                )}
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
