import { useEffect, useMemo, useRef, useState } from 'react'
import Spline from '@splinetool/react-spline'

function classNames(...xs){
  return xs.filter(Boolean).join(' ')
}

const API_BASE = import.meta.env.VITE_BACKEND_URL || (typeof window !== 'undefined' ? window.location.origin.replace('3000','8000') : '')

export default function App() {
  const [mode, setMode] = useState('idle') // idle | upload | camera | scanning | result
  const [fileName, setFileName] = useState('')
  const [previewURL, setPreviewURL] = useState('')
  const [result, setResult] = useState(null)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')

  // Camera refs
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const inputRef = useRef(null)

  // Reveal on scroll
  useEffect(() => {
    const io = new IntersectionObserver((entries)=>{
      entries.forEach(e=>{
        if(e.isIntersecting){ e.target.classList.add('reveal-in') }
      })
    }, { threshold: 0.15 })
    document.querySelectorAll('.reveal').forEach(el=>io.observe(el))
    return () => io.disconnect()
  }, [])

  useEffect(()=>{
    if(mode === 'camera'){
      startCamera()
    } else {
      stopCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  const startCamera = async () => {
    try {
      setError('')
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      if(videoRef.current){
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      streamRef.current = stream
    } catch (e) {
      setError('Unable to access camera. Please allow permissions or upload an image instead.')
    }
  }

  const stopCamera = () => {
    if(streamRef.current){
      streamRef.current.getTracks().forEach(t=>t.stop())
      streamRef.current = null
    }
  }

  const beginScanUI = () => {
    setMode('scanning')
    setProgress(0)
    const id = setInterval(()=>{
      setProgress(p => {
        if(p >= 96){ clearInterval(id); return 96 }
        return p + Math.random()*7
      })
    }, 180)
    return () => clearInterval(id)
  }

  const fakeDelay = (ms) => new Promise(res=>setTimeout(res, ms))

  const uploadToAPI = async (blob, name='capture.png') => {
    const endProgress = beginScanUI()
    try {
      setError('')
      const form = new FormData()
      form.append('image', blob, name)
      const resp = await fetch(`${API_BASE}/api/scan`, { method: 'POST', body: form })
      if(!resp.ok){
        throw new Error(`Scan failed (${resp.status})`)
      }
      // mimic compute
      await fakeDelay(800 + Math.random()*900)
      const data = await resp.json()
      setResult(data)
      setProgress(100)
      setMode('result')
    } catch (e) {
      console.error(e)
      setError(e.message || 'Something went wrong while scanning')
      setMode('idle')
    } finally {
      if(typeof endProgress === 'function') endProgress()
    }
  }

  const onPickFile = (e) => {
    const f = e.target.files?.[0]
    if(!f) return
    setFileName(f.name)
    const url = URL.createObjectURL(f)
    setPreviewURL(url)
    uploadToAPI(f, f.name)
  }

  const onDrop = (e) => {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if(!f) return
    setFileName(f.name)
    const url = URL.createObjectURL(f)
    setPreviewURL(url)
    uploadToAPI(f, f.name)
  }

  const onCapture = async () => {
    if(!videoRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    const w = video.videoWidth
    const h = video.videoHeight
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, w, h)
    canvas.toBlob((blob)=>{
      if(!blob) return
      const url = URL.createObjectURL(blob)
      setPreviewURL(url)
      setFileName('camera-capture.png')
      setMode('camera')
      uploadToAPI(blob, 'camera-capture.png')
    }, 'image/png', 0.95)
  }

  const resetAll = () => {
    setMode('idle')
    setResult(null)
    setProgress(0)
    setError('')
    setPreviewURL('')
    setFileName('')
  }

  const downloadReport = () => {
    if(!result) return
    const payload = {
      fileName,
      previewURL,
      scannedAt: new Date().toISOString(),
      ...result
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `scan-report-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const labels = useMemo(()=>['Organic','Plastic','Metal','Paper','Other'],[])

  return (
    <div className="min-h-screen w-full bg-[#0a0f0f] text-white overflow-x-hidden">
      {/* Hero with Spline cover */}
      <section className="relative h-[88vh] md:h-screen flex items-center justify-center">
        <div className="absolute inset-0">
          <Spline scene="https://prod.spline.design/xzUirwcZB9SOxUWt/scene.splinecode" style={{ width: '100%', height: '100%' }} />
        </div>
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(1200px_600px_at_30%_-10%,rgba(34,197,94,0.20),transparent),radial-gradient(900px_600px_at_80%_110%,rgba(45,212,191,0.12),transparent)]"></div>
        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 backdrop-blur border border-white/10 text-teal-200/90 mb-6 reveal">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Live Eco-Scan Prototype
          </div>
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight leading-tight reveal">
            <span className="text-white/90">Scan Trash.</span> <span className="text-emerald-300">Save the Planet.</span>
          </h1>
          <p className="mt-5 text-white/70 text-lg md:text-xl reveal">
            Upload an image or scan in real-time to detect waste effortlessly.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 reveal">
            <button onClick={()=>inputRef.current?.click()} className="btn-neon">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 16v-8m-4 4h8"/><rect x="3" y="3" width="18" height="18" rx="4"/></svg>
              Upload Image
            </button>
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
            <button onClick={()=>setMode('camera')} className="btn-outline">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 8h4l2-2h4l2 2h4v10H4z"/></svg>
              Open Camera Scan
            </button>
          </div>
          <div className="mt-10 flex items-center justify-center gap-6 text-sm text-white/60 reveal">
            <div className="flex items-center gap-2"><span className="badge-dot bg-emerald-400"/>Eco friendly</div>
            <div className="flex items-center gap-2"><span className="badge-dot bg-teal-400"/>Realtime</div>
            <div className="flex items-center gap-2"><span className="badge-dot bg-lime-400"/>Private</div>
          </div>
        </div>
      </section>

      {/* Upload Zone */}
      <section className="relative py-20 px-6 md:px-10 max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-8 items-stretch">
          <div className="glass p-6 md:p-8 rounded-2xl border border-white/10 reveal" onDrop={onDrop} onDragOver={(e)=>e.preventDefault()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-medium">Image Upload</h3>
              <span className="text-xs text-white/50">Drag & Drop supported</span>
            </div>
            <div className="upload-zone" onClick={()=>inputRef.current?.click()}>
              <div className="icon-circle">
                <svg className="w-9 h-9 text-emerald-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 16V8m0 0l-3 3m3-3l3 3"/><path d="M6 16v1a3 3 0 003 3h6a3 3 0 003-3v-1"/></svg>
              </div>
              <p className="text-white/80">Drop an image here or <span className="text-emerald-300">browse</span></p>
              <p className="text-xs text-white/50 mt-1">PNG, JPG up to 10MB</p>
            </div>
            {previewURL && mode !== 'camera' && (
              <div className="mt-5 rounded-xl overflow-hidden border border-white/10 bg-white/5">
                <img src={previewURL} alt="preview" className="w-full object-cover max-h-72" />
                {mode === 'scanning' && (
                  <div className="p-5">
                    <Scanning progress={progress} fileName={fileName} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Camera Panel */}
          <div className="glass p-6 md:p-8 rounded-2xl border border-white/10 reveal">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-medium">Camera Scanner</h3>
              <span className="text-xs text-white/50">Uses your device camera</span>
            </div>
            <div className={classNames('relative rounded-xl border border-emerald-500/30 overflow-hidden transition-all', mode==='camera' ? 'ring-2 ring-emerald-400/40 shadow-[0_0_0_4px_rgba(16,185,129,0.15)]' : 'opacity-90') }>
              <video ref={videoRef} playsInline muted className="w-full h-[320px] object-cover bg-black/40" />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute inset-0 pointer-events-none border-[6px] border-transparent rounded-xl scan-frame" />
            </div>
            <div className="mt-4 flex items-center gap-3">
              {mode !== 'camera' ? (
                <button onClick={()=>setMode('camera')} className="btn-outline">Activate Camera</button>
              ) : (
                <>
                  <button onClick={onCapture} className="btn-shutter">Capture</button>
                  <button onClick={()=>setMode('idle')} className="btn-ghost">Close</button>
                </>
              )}
            </div>
            {mode==='scanning' && (
              <div className="mt-5"><Scanning progress={progress} fileName={fileName || 'camera-capture.png'} /></div>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-6 text-rose-300/90 text-sm">{error}</div>
        )}
      </section>

      {/* How It Works */}
      <section className="py-20 px-6 md:px-10 max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-semibold mb-10 reveal">How it works</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[{
            title: 'Upload or Scan',
            desc: 'Choose an image or use your camera to capture waste in real-time.',
            icon: (
              <svg viewBox="0 0 24 24" className="w-7 h-7"><path d="M12 16v-8m-4 4h8" stroke="currentColor" strokeWidth="1.5" fill="none"/><rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
            )
          },{
            title: 'System Analyzes',
            desc: 'The app simulates AI detection and estimates confidence levels.',
            icon: (
              <svg viewBox="0 0 24 24" className="w-7 h-7"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
            )
          },{
            title: 'Detects & Classifies',
            desc: 'See whether trash is detected and what type it is.',
            icon: (
              <svg viewBox="0 0 24 24" className="w-7 h-7"><path d="M5 12l4 4L19 6" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
            )
          }].map((c, i)=> (
            <div key={i} className="card-step reveal">
              <div className="icon-chip">{c.icon}</div>
              <h3 className="text-lg font-medium text-white/90">{c.title}</h3>
              <p className="text-white/60 text-sm">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 border-t border-white/10/5 text-center relative">
        <div className="floating-icons pointer-events-none">
          <span className="leaf" />
          <span className="recycle" />
          <span className="earth" />
        </div>
        <p className="text-white/60">Built with 💚 for a cleaner world.</p>
        <div className="mt-4 flex items-center justify-center gap-4 text-white/50">
          {['twitter','github','linkedin'].map((s,i)=> (
            <a key={i} href="#" className="social-glow" aria-label={s}>
              <span className="sr-only">{s}</span>
              <svg viewBox="0 0 24 24" className="w-5 h-5"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg>
            </a>
          ))}
        </div>
      </footer>

      {/* Results Modal */}
      {mode==='result' && result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm opacity-100 animate-fade-in" onClick={resetAll} />
          <div className="relative w-[92%] max-w-xl rounded-2xl glass border border-white/10 p-6 md:p-7 animate-pop-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-medium">Scan Results</h3>
              <button className="btn-ghost" onClick={resetAll}>Close</button>
            </div>
            {previewURL && (
              <img src={previewURL} alt="preview" className="w-full rounded-lg border border-white/10 max-h-72 object-cover" />
            )}
            <div className="mt-5 grid gap-4">
              <div className="flex items-center gap-3">
                <span className={classNames('status-pill', result.detected ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30' : 'bg-teal-500/10 text-teal-200 border-teal-400/20')}>
                  {result.detected ? 'Trash Detected' : 'No Trash Detected'}
                </span>
                <span className="ml-auto text-sm text-white/60">{fileName}</span>
              </div>

              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-white/70">Confidence</span>
                  <span className="text-emerald-300">{Math.round(result.confidence*100)}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-400" style={{ width: `${Math.round(result.confidence*100)}%` }} />
                </div>
              </div>

              <div>
                <div className="text-sm text-white/70 mb-2">Classification</div>
                <div className="flex flex-wrap gap-2">
                  {labels.map(l => (
                    <span key={l} className={classNames('chip', l===result.label && 'chip-active')}>{l}</span>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-sm text-white/70 mb-2">Suggestions</div>
                <ul className="list-disc list-inside text-white/70 text-sm">
                  {result.suggestions?.map((s,i)=>(<li key={i}>{s}</li>))}
                </ul>
              </div>

              <div className="mt-2 flex flex-wrap gap-3">
                <button className="btn-neon" onClick={resetAll}>Scan Again</button>
                <button className="btn-outline" onClick={downloadReport}>Download Report</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Scanning({ progress, fileName }){
  return (
    <div className="rounded-xl p-4 bg-black/30 border border-white/10">
      <div className="flex items-center gap-3">
        <div className="loader" />
        <div>
          <div className="text-white/80">Analyzing Image…</div>
          <div className="text-xs text-white/50">{fileName}</div>
        </div>
        <div className="ml-auto text-emerald-300 text-sm">{Math.min(100, Math.round(progress))}%</div>
      </div>
      <div className="mt-3 h-2 w-full rounded-full bg-white/10 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-400 animate-shimmer" style={{ width: `${Math.min(100, Math.round(progress))}%` }} />
      </div>
    </div>
  )
}
