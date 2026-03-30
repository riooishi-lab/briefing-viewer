import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Student, BriefingVideo, SurveyQuestion, SurveySet, VideoChapter } from '../lib/supabase'
import { v4 as uuidv4 } from 'uuid'
import { AlertCircle, CheckCircle2, Play, Pause, Maximize, Minimize, Volume2, VolumeX } from 'lucide-react'

const extractYouTubeId = (url: string | null | undefined): string | null => {
  if (!url) return null
  const m = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i)
  return m ? m[1] : null
}

function SurveyOverlay({
  question,
  onAnswer,
}: {
  question: SurveyQuestion
  onAnswer: (choice: string) => void
}) {
  const choices = (question.choices as string[]) || []
  return (
    <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-black/80 backdrop-blur-sm flex items-center justify-center z-10">
      <div className="bg-white rounded-t-xl p-5 w-full h-full flex flex-col justify-center max-w-2xl mx-auto">
        <p className="text-base font-bold text-gray-800 mb-3 text-center">{question.question_text}</p>
        <div className="grid grid-cols-2 gap-2">
          {choices.map((choice, i) => (
            <button
              key={i}
              onClick={() => onAnswer(choice)}
              className="px-3 py-2.5 border border-gray-200 rounded-lg hover:bg-[#1B2A4A] hover:text-white hover:border-[#1B2A4A] transition-colors text-sm font-medium text-left"
            >
              {choice}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── チャプター選択画面（テキスト） ───
function ChapterSelectText({
  chapters, videoTitle, onSelect,
}: { chapters: VideoChapter[]; videoTitle: string; onSelect: (ch: VideoChapter | null) => void }) {
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-gray-900 to-black text-white p-6">
      <h2 className="text-lg font-bold mb-1">{videoTitle}</h2>
      <p className="text-sm text-white/60 mb-6">どこから視聴しますか？</p>
      <div className="w-full max-w-md space-y-2">
        <button onClick={() => onSelect(null)}
          className="w-full flex items-center gap-3 px-4 py-3.5 bg-white/10 hover:bg-white/20 rounded-xl transition-colors text-left">
          <Play className="h-5 w-5 text-green-400 shrink-0" />
          <div><div className="font-medium">最初から見る</div><div className="text-xs text-white/50">全編を通して視聴</div></div>
        </button>
        {chapters.map((ch) => (
          <button key={ch.id} onClick={() => onSelect(ch)}
            className="w-full flex items-center gap-3 px-4 py-3.5 bg-white/10 hover:bg-white/20 rounded-xl transition-colors text-left">
            <Play className="h-5 w-5 text-blue-400 shrink-0" />
            <div><div className="font-medium">{ch.label}</div><div className="text-xs text-white/50">{fmt(ch.start_sec)}〜</div></div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── チャプター選択画面（画像・Netflix風グリッド） ───
function ChapterSelectImage({
  chapters, videoTitle, onSelect,
}: { chapters: VideoChapter[]; videoTitle: string; onSelect: (ch: VideoChapter | null) => void }) {
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-b from-gray-900 to-black text-white overflow-auto">
      {/* メイン: 最初から見る */}
      <button onClick={() => onSelect(null)}
        className="relative w-full aspect-video bg-gray-800 hover:brightness-110 transition-all shrink-0 group">
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="w-16 h-16 bg-white/20 group-hover:bg-white/30 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors">
            <Play className="h-8 w-8 text-white ml-1" />
          </div>
          <p className="mt-3 font-bold text-lg">最初から見る</p>
          <p className="text-xs text-white/50">{videoTitle}</p>
        </div>
      </button>

      {/* サムネイルグリッド */}
      {chapters.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 p-3">
          {chapters.map((ch) => (
            <button key={ch.id} onClick={() => onSelect(ch)}
              className="relative rounded-lg overflow-hidden bg-gray-800 hover:brightness-110 transition-all group aspect-video">
              {ch.thumbnail_url ? (
                <img src={ch.thumbnail_url} alt={ch.label} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-700">
                  <Play className="h-6 w-6 text-white/40" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-2">
                <p className="text-xs font-medium truncate">{ch.label}</p>
                <p className="text-[10px] text-white/50">{fmt(ch.start_sec)}〜</p>
              </div>
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <Play className="h-5 w-5 text-white ml-0.5" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// 動画の種類を判定するヘルパー
// ─── YouTube風カスタムコントロール ───
function VideoControls({
  videoRef, isFullscreen, onToggleFullscreen,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>
  isFullscreen: boolean
  onToggleFullscreen: () => void
}) {
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [muted, setMuted] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fmt = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  const resetHideTimer = () => {
    setShowControls(true)
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => { if (videoRef.current && !videoRef.current.paused) setShowControls(false) }, 3000)
  }

  useEffect(() => {
    const el = videoRef.current
    if (!el) return
    const onPlay = () => { setPlaying(true); resetHideTimer() }
    const onPause = () => { setPlaying(false); setShowControls(true) }
    const onTime = () => setCurrentTime(el.currentTime)
    const onMeta = () => setDuration(el.duration || 0)
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', onMeta)
    if (el.duration) setDuration(el.duration)
    return () => {
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('loadedmetadata', onMeta)
    }
  }, [videoRef.current])

  const togglePlay = () => {
    const el = videoRef.current
    if (!el) return
    el.paused ? el.play() : el.pause()
  }

  const toggleMute = () => {
    const el = videoRef.current
    if (!el) return
    el.muted = !el.muted
    setMuted(el.muted)
  }

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = videoRef.current
    if (!el || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    el.currentTime = pct * duration
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div
      className="absolute inset-0 z-[5] flex flex-col justify-end"
      onMouseMove={resetHideTimer}
      onTouchStart={resetHideTimer}
      onClick={(e) => { if (e.target === e.currentTarget) togglePlay() }}
    >
      {/* 中央再生ボタン（一時停止中のみ） */}
      {!playing && (
        <button onClick={togglePlay} className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 bg-black/60 rounded-full flex items-center justify-center">
            <Play className="h-8 w-8 text-white ml-1" />
          </div>
        </button>
      )}

      {/* 下部コントロールバー */}
      <div className={`bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-10 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        {/* シークバー */}
        <div className="w-full h-1 bg-white/30 rounded-full cursor-pointer mb-3 group" onClick={seek}>
          <div className="h-full bg-red-600 rounded-full relative transition-all" style={{ width: `${progress}%` }}>
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={togglePlay} className="text-white hover:text-white/80">
              {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>
            <button onClick={toggleMute} className="text-white hover:text-white/80">
              {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
            <span className="text-white text-xs font-mono">{fmt(currentTime)} / {fmt(duration)}</span>
          </div>
          <button onClick={onToggleFullscreen} className="text-white hover:text-white/80">
            {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </button>
        </div>
      </div>
    </div>
  )
}

function getVideoType(v: BriefingVideo): 'youtube' | 'upload' | 'none' {
  if (v.youtube_url && v.youtube_url.trim()) return 'youtube'
  if (v.video_url && v.video_url.trim()) return 'upload'
  return 'none'
}

// 現在のチャプターを判定
function getCurrentChapter(sec: number, chapters: VideoChapter[]): VideoChapter | null {
  if (!chapters.length) return null
  const sorted = [...chapters].sort((a, b) => b.start_sec - a.start_sec)
  return sorted.find(c => c.start_sec <= sec) || null
}

export function StudentViewer() {
  const [student, setStudent] = useState<Student | null>(null)
  const [video, setVideo] = useState<BriefingVideo | null>(null)
  const [questions, setQuestions] = useState<SurveyQuestion[]>([])
  const [chapters, setChapters] = useState<VideoChapter[]>([])
  const [activeSurveySet, setActiveSurveySet] = useState<SurveySet | null>(null)
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(new Set())
  const [activeQuestion, setActiveQuestion] = useState<SurveyQuestion | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [completed, setCompleted] = useState(false)
  // undefined = 未選択（選択画面表示）, null = 最初から見る, VideoChapter = 特定チャプター
  const [selectedChapter, setSelectedChapter] = useState<VideoChapter | null | undefined>(undefined)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const playerRef = useRef<any>(null)
  const nativeVideoRef = useRef<HTMLVideoElement>(null)
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const sessionIdRef = useRef<string>(uuidv4())
  const tokenRef = useRef<string | null>(null)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const surveyCheckRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevCheckPosRef = useRef<number>(0)
  const seekOnReadyRef = useRef<number | null>(null)

  // Ref版で最新stateを参照
  const questionsRef = useRef(questions)
  const answeredIdsRef = useRef(answeredIds)
  const activeQuestionRef = useRef(activeQuestion)
  const studentRef = useRef(student)
  const videoRef = useRef(video)
  const chaptersRef = useRef(chapters)
  const selectedChapterRef = useRef(selectedChapter)
  const activeSurveySetRef = useRef(activeSurveySet)
  questionsRef.current = questions
  answeredIdsRef.current = answeredIds
  activeQuestionRef.current = activeQuestion
  studentRef.current = student
  videoRef.current = video
  chaptersRef.current = chapters
  selectedChapterRef.current = selectedChapter
  activeSurveySetRef.current = activeSurveySet

  const deviceType = (() => {
    const ua = navigator.userAgent
    if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'タブレット'
    if (/iPhone|Android/.test(ua) || (/Mobile/.test(ua) && !/iPad/.test(ua))) return 'スマホ'
    return 'PC'
  })()

  const recordEvent = useCallback(async (eventType: string, positionSec: number) => {
    try {
      const s = studentRef.current, v = videoRef.current
      if (!s || !v) return
      const t = tokenRef.current
      if (t) {
        try {
          const { error } = await supabase.rpc('record_watch_event', {
            p_token: t, p_video_id: v.id, p_event_type: eventType,
            p_position_sec: positionSec, p_session_id: sessionIdRef.current, p_device_type: deviceType,
          })
          if (!error) return
          console.warn('[recordEvent] RPC failed:', error.message)
        } catch (e) {
          console.warn('[recordEvent] RPC threw:', e)
        }
      }
      const { error: e2 } = await supabase.from('watch_events').insert({
        student_id: s.id, video_id: v.id, event_type: eventType,
        position_sec: positionSec, session_id: sessionIdRef.current, company_id: s.company_id,
        device_type: deviceType,
      })
      if (!e2) return
      console.warn('[recordEvent] direct insert failed:', e2.message)
      const { error: e3 } = await supabase.from('watch_events').insert({
        student_id: s.id, video_id: v.id, event_type: eventType,
        position_sec: positionSec, session_id: sessionIdRef.current, company_id: s.company_id,
      })
      if (e3) console.error('[recordEvent] all attempts failed:', e3.message)
    } catch (e) {
      console.error('[recordEvent] unexpected error:', e)
    }
  }, [deviceType])

  // ─── チャプター対応アンケートトリガー ───
  const checkSurveyTrigger = useCallback((currentTime: number) => {
    if (activeQuestionRef.current) return
    const sec = Math.floor(currentTime)
    const prevSec = prevCheckPosRef.current
    prevCheckPosRef.current = sec

    const currentCh = getCurrentChapter(sec, chaptersRef.current)

    for (const q of questionsRef.current) {
      if (answeredIdsRef.current.has(q.id)) continue

      // チャプターフィルタ
      if (q.chapter_id) {
        const sel = selectedChapterRef.current
        if (sel === undefined) continue // まだ選択画面
        if (sel === null) {
          // 最初から見る
          if (videoRef.current?.chapter_survey_mode === 'chapter_only') {
            if (currentCh?.id !== q.chapter_id) continue
          }
          // mode === 'all' → フィルタなし（全表示）
        } else {
          // 特定チャプター選択 → そのチャプターの設問のみ
          if (q.chapter_id !== sel.id) continue
        }
      }

      if ((sec >= q.trigger_sec && prevSec < q.trigger_sec) ||
          (sec >= q.trigger_sec && Math.abs(sec - prevSec) > 3)) {
        setActiveQuestion(q)
        break
      }
    }
  }, [])

  const startSurveyCheck = useCallback(() => {
    if (surveyCheckRef.current) clearInterval(surveyCheckRef.current)
    surveyCheckRef.current = setInterval(() => {
      if (nativeVideoRef.current && !nativeVideoRef.current.paused) {
        checkSurveyTrigger(nativeVideoRef.current.currentTime)
        return
      }
      try {
        const p = playerRef.current
        if (p?.getPlayerState && p.getPlayerState() === 1) {
          checkSurveyTrigger(p.getCurrentTime())
        }
      } catch { /* player not ready */ }
    }, 1000)
  }, [checkSurveyTrigger])

  const handleAnswer = async (choice: string) => {
    const q = activeQuestionRef.current, s = studentRef.current, v = videoRef.current
    if (!q || !v) return
    try {
      const t = tokenRef.current
      if (t) {
        try {
          const { error } = await supabase.rpc('record_survey_response', {
            p_token: t, p_question_id: q.id, p_video_id: v.id,
            p_selected_choice: choice, p_session_id: sessionIdRef.current,
          })
          if (!error) { setAnsweredIds((prev) => new Set([...prev, q.id])); setActiveQuestion(null); return }
          console.warn('[handleAnswer] RPC failed:', error.message)
        } catch (e) {
          console.warn('[handleAnswer] RPC threw:', e)
        }
      }
      if (s) {
        await supabase.from('survey_responses').insert({
          student_id: s.id, question_id: q.id, video_id: v.id,
          selected_choice: choice, session_id: sessionIdRef.current, company_id: s.company_id,
          survey_set_id: activeSurveySetRef.current?.id || null,
        })
      }
    } catch (e) {
      console.error('[handleAnswer] unexpected error:', e)
    }
    setAnsweredIds((prev) => new Set([...prev, q.id]))
    setActiveQuestion(null)
  }

  // ─── チャプター選択ハンドラ ───
  const handleChapterSelect = (ch: VideoChapter | null) => {
    setSelectedChapter(ch)
    const startSec = ch?.start_sec ?? 0
    if (startSec > 0) {
      seekOnReadyRef.current = startSec
      prevCheckPosRef.current = startSec
      // ネイティブ動画: 即座にシーク
      if (nativeVideoRef.current) {
        nativeVideoRef.current.currentTime = startSec
      }
      // YouTube: onReady で seekTo（playerRef がまだない場合は seekOnReadyRef で待機）
      if (playerRef.current?.seekTo) {
        playerRef.current.seekTo(startSec, true)
      }
    }
  }

  // ─── フルスクリーン ───
  const toggleFullscreen = async () => {
    const container = videoContainerRef.current
    if (!container) return
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    } else {
      await container.requestFullscreen()
    }
  }

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  // ─── 初期化 ───
  useEffect(() => {
    const init = async () => {
      const token = new URLSearchParams(window.location.search).get('token')
      if (!token) { setError('URLにトークンが含まれていません。'); setLoading(false); return }
      tokenRef.current = token

      const { data: sd } = await supabase.from('students').select('*').eq('token', token).maybeSingle()
      if (!sd) { setError('URLが無効です。採用担当者にご連絡ください。'); setLoading(false); return }
      if (new Date(sd.token_expires_at) < new Date()) {
        setError('このURLの有効期限が切れています。\n採用担当者に新しいURLの発行をご依頼ください。')
        setLoading(false); return
      }
      setStudent(sd)

      let vdQuery = supabase.from('briefing_videos').select('*').eq('is_published', true)
        .order('created_at', { ascending: false }).limit(1)
      if (sd.company_id) {
        vdQuery = supabase.from('briefing_videos').select('*')
          .eq('company_id', sd.company_id).eq('is_published', true)
          .order('created_at', { ascending: false }).limit(1)
      }
      const { data: vd } = await vdQuery.maybeSingle()
      if (!vd) {
        setError('現在公開中の説明会動画はありません。\n管理画面で動画を「公開」に設定してください。')
        setLoading(false); return
      }
      setVideo(vd)

      // チャプター取得
      const { data: chData } = await supabase.from('video_chapters').select('*')
        .eq('video_id', vd.id).order('sort_order', { ascending: true })
      const chList = chData || []
      setChapters(chList)
      // チャプターが無い / none / image の場合は選択画面をスキップ（imageは動画下にグリッド表示）
      if (chList.length === 0 || vd.chapter_display_mode !== 'text') setSelectedChapter(null)

      // 有効なアンケートセットの設問のみ取得
      const { data: setData } = await supabase.from('survey_sets').select('*')
        .eq('video_id', vd.id).eq('is_active', true).limit(1).maybeSingle()
      setActiveSurveySet(setData || null)

      let qd: any[] = []
      if (setData) {
        const { data } = await supabase.from('survey_questions').select('*')
          .eq('survey_set_id', setData.id).order('trigger_sec', { ascending: true })
        qd = data || []
      } else {
        // セット未作成時: 従来互換（全設問取得）
        const { data } = await supabase.from('survey_questions').select('*')
          .eq('video_id', vd.id).order('trigger_sec', { ascending: true })
        qd = data || []
      }
      setQuestions(qd)

      const { data: rd } = await supabase.from('survey_responses').select('question_id')
        .eq('student_id', sd.id).eq('video_id', vd.id)
      setAnsweredIds(new Set((rd || []).map((r: { question_id: string }) => r.question_id)))
      setLoading(false)
    }
    init()

    const ch = supabase.channel('video-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'briefing_videos' }, () => window.location.reload())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  // ─── ネイティブ動画のイベント ───
  useEffect(() => {
    if (!video || getVideoType(video) !== 'upload' || selectedChapter === undefined) return
    const el = nativeVideoRef.current
    if (!el) return
    const onLoadedMetadata = async () => {
      if (el.duration && el.duration > 0 && videoRef.current) {
        const dur = Math.round(el.duration)
        const { error } = await supabase.rpc('update_video_duration', { p_video_id: videoRef.current.id, p_duration: dur })
        if (error) {
          await supabase.from('briefing_videos').update({ duration_sec: dur })
            .eq('id', videoRef.current.id).is('duration_sec', null)
        }
      }
      // チャプター選択時のシーク
      if (seekOnReadyRef.current !== null) {
        el.currentTime = seekOnReadyRef.current
        seekOnReadyRef.current = null
      }
    }
    const onPlay = () => {
      recordEvent('play', el.currentTime)
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      heartbeatRef.current = setInterval(() => recordEvent('heartbeat', el.currentTime), 30000)
      startSurveyCheck()
    }
    const onPause = () => { recordEvent('pause', el.currentTime); if (heartbeatRef.current) clearInterval(heartbeatRef.current) }
    const onEnded = () => {
      recordEvent('ended', el.duration)
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      if (surveyCheckRef.current) clearInterval(surveyCheckRef.current)
      setCompleted(true)
    }
    el.addEventListener('loadedmetadata', onLoadedMetadata)
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    el.addEventListener('ended', onEnded)
    return () => {
      el.removeEventListener('loadedmetadata', onLoadedMetadata)
      el.removeEventListener('play', onPlay); el.removeEventListener('pause', onPause); el.removeEventListener('ended', onEnded)
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      if (surveyCheckRef.current) clearInterval(surveyCheckRef.current)
    }
  }, [video?.id, selectedChapter !== undefined, recordEvent, startSurveyCheck])

  // ─── YouTube Player 初期化 ───
  useEffect(() => {
    if (!video || getVideoType(video) !== 'youtube' || selectedChapter === undefined) return
    const youtubeId = extractYouTubeId(video.youtube_url)
    if (!youtubeId) {
      console.error('[YT] Could not extract YouTube ID from:', video.youtube_url)
      return
    }

    let destroyed = false

    const createPlayer = () => {
      if (destroyed) return
      if (playerRef.current) return
      const container = document.getElementById('yt-player')
      if (!container) return

      playerRef.current = new (window as any).YT.Player('yt-player', {
        videoId: youtubeId,
        width: '100%',
        height: '100%',
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: async (event: any) => {
            const dur = event.target?.getDuration?.()
            if (dur && dur > 0 && videoRef.current) {
              const rounded = Math.round(dur)
              const { error } = await supabase.rpc('update_video_duration', { p_video_id: videoRef.current.id, p_duration: rounded })
              if (error) {
                await supabase.from('briefing_videos').update({ duration_sec: rounded })
                  .eq('id', videoRef.current.id).is('duration_sec', null)
              }
            }
            // チャプター選択時のシーク
            if (seekOnReadyRef.current !== null) {
              event.target.seekTo(seekOnReadyRef.current, true)
              seekOnReadyRef.current = null
            }
          },
          onStateChange: (event: any) => {
            const p = playerRef.current
            if (!p?.getCurrentTime) return
            const pos = p.getCurrentTime()
            if (event.data === 1) {
              recordEvent('play', pos)
              if (heartbeatRef.current) clearInterval(heartbeatRef.current)
              heartbeatRef.current = setInterval(() => {
                if (playerRef.current?.getCurrentTime) recordEvent('heartbeat', playerRef.current.getCurrentTime())
              }, 30000)
              startSurveyCheck()
            } else if (event.data === 2) {
              recordEvent('pause', pos)
              if (heartbeatRef.current) clearInterval(heartbeatRef.current)
            } else if (event.data === 0) {
              recordEvent('ended', p.getDuration ? p.getDuration() : pos)
              if (heartbeatRef.current) clearInterval(heartbeatRef.current)
              if (surveyCheckRef.current) clearInterval(surveyCheckRef.current)
              setCompleted(true)
            }
          },
        },
      })
    }

    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(tag)
    }

    const poll = setInterval(() => {
      if (destroyed) { clearInterval(poll); return }
      if ((window as any).YT?.Player && document.getElementById('yt-player')) {
        clearInterval(poll)
        createPlayer()
      }
    }, 200)
    setTimeout(() => clearInterval(poll), 15000)

    return () => {
      destroyed = true
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      if (surveyCheckRef.current) clearInterval(surveyCheckRef.current)
      if (playerRef.current?.destroy) {
        try { playerRef.current.destroy() } catch { /* ignore */ }
      }
      playerRef.current = null
    }
  }, [video?.id, selectedChapter !== undefined, recordEvent, startSurveyCheck])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-3 animate-pulse">
          <div className="w-12 h-12 bg-[#1B2A4A]/20 rounded-full mx-auto" />
          <p className="text-gray-500">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full mx-4 bg-white rounded-xl shadow-lg p-8 text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto" />
          <h1 className="text-xl font-bold text-gray-800">アクセスできません</h1>
          <p className="text-gray-600 text-sm whitespace-pre-line">{error}</p>
        </div>
      </div>
    )
  }

  if (!student || !video) return null

  const videoType = getVideoType(video)
  const displayMode = video.chapter_display_mode || 'text'
  // テキストモードのみ選択画面を挟む。画像モードは動画の下にグリッド配置。
  const showChapterSelect = displayMode === 'text' && chapters.length > 0 && selectedChapter === undefined

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-[#1B2A4A] to-[#2C3E6B] text-white px-6 py-5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold">会社説明会</h1>
          <div className="text-sm">{student.name} 様</div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div
          ref={videoContainerRef}
          className={`relative rounded-xl overflow-hidden bg-black shadow-lg ${isFullscreen ? 'w-screen h-screen' : 'aspect-video'}`}
        >
          {showChapterSelect ? (
            <ChapterSelectText chapters={chapters} videoTitle={video.title} onSelect={handleChapterSelect} />
          ) : (
            <>
              {videoType === 'upload' ? (
                <>
                  <video ref={nativeVideoRef} src={video.video_url!} playsInline className="w-full h-full" />
                  <VideoControls videoRef={nativeVideoRef} isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen} />
                </>
              ) : videoType === 'youtube' ? (
                <div id="yt-player" className="w-full h-full" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/60">動画を準備中です</div>
              )}
              {activeQuestion && (
                <SurveyOverlay question={activeQuestion} onAnswer={handleAnswer} />
              )}
              {/* YouTube: 全画面ボタンのみ（プレーヤーUIはYouTube側で提供） */}
              {videoType === 'youtube' && (
                <button
                  onClick={toggleFullscreen}
                  className="absolute bottom-3 right-3 z-20 p-2 bg-black/50 hover:bg-black/70 rounded-lg text-white transition-colors"
                >
                  {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                </button>
              )}
            </>
          )}
        </div>

        <div className="mt-6 space-y-2">
          <h2 className="text-2xl font-bold text-gray-800">{video.title}</h2>
          {video.description && <p className="text-gray-600">{video.description}</p>}
        </div>

        {/* 画像モード: 動画の下にサムネイルグリッド */}
        {displayMode === 'image' && chapters.length > 0 && (
          <div className="mt-6">
            <p className="text-sm font-medium text-gray-500 mb-3">パートから選んで視聴</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {chapters.map((ch) => (
                <button key={ch.id} onClick={() => handleChapterSelect(ch)}
                  className="relative rounded-xl overflow-hidden bg-gray-900 hover:ring-2 hover:ring-[#1B2A4A] transition-all group aspect-video">
                  {ch.thumbnail_url ? (
                    <img src={ch.thumbnail_url} alt={ch.label} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-200">
                      <Play className="h-8 w-8 text-gray-400" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-2.5">
                    <p className="text-sm font-medium text-white">{ch.label}</p>
                    <p className="text-xs text-white/60">{Math.floor(ch.start_sec / 60)}:{String(ch.start_sec % 60).padStart(2, '0')}〜</p>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-12 h-12 bg-white/25 rounded-full flex items-center justify-center backdrop-blur-sm">
                      <Play className="h-6 w-6 text-white ml-0.5" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {completed && (
          <div className="mt-8 bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-3" />
            <p className="text-lg font-bold text-green-800">ご視聴ありがとうございました</p>
            <p className="text-sm text-green-600 mt-1">説明会動画の視聴が完了しました。</p>
          </div>
        )}
      </main>
    </div>
  )
}
