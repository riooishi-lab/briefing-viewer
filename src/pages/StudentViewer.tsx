import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Student, BriefingVideo, SurveyQuestion } from '../lib/supabase'
import { v4 as uuidv4 } from 'uuid'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

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

// 動画の種類を判定するヘルパー
function getVideoType(v: BriefingVideo): 'youtube' | 'upload' | 'none' {
  if (v.youtube_url && v.youtube_url.trim()) return 'youtube'
  if (v.video_url && v.video_url.trim()) return 'upload'
  return 'none'
}

export function StudentViewer() {
  const [student, setStudent] = useState<Student | null>(null)
  const [video, setVideo] = useState<BriefingVideo | null>(null)
  const [questions, setQuestions] = useState<SurveyQuestion[]>([])
  const [answeredIds, setAnsweredIds] = useState<Set<string>>(new Set())
  const [activeQuestion, setActiveQuestion] = useState<SurveyQuestion | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [completed, setCompleted] = useState(false)

  const playerRef = useRef<any>(null)
  const nativeVideoRef = useRef<HTMLVideoElement>(null)
  const sessionIdRef = useRef<string>(uuidv4())
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const surveyCheckRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const prevCheckPosRef = useRef<number>(0)

  // Ref版で最新stateを参照（useEffectの依存を減らす）
  const questionsRef = useRef(questions)
  const answeredIdsRef = useRef(answeredIds)
  const activeQuestionRef = useRef(activeQuestion)
  const studentRef = useRef(student)
  const videoRef = useRef(video)
  questionsRef.current = questions
  answeredIdsRef.current = answeredIds
  activeQuestionRef.current = activeQuestion
  studentRef.current = student
  videoRef.current = video

  const deviceType = (() => {
    const ua = navigator.userAgent
    if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'iPad'
    if (/iPhone|Android/.test(ua) || (/Mobile/.test(ua) && !/iPad/.test(ua))) return 'スマホ'
    return 'PC'
  })()

  const recordEvent = useCallback(async (eventType: string, positionSec: number) => {
    const s = studentRef.current, v = videoRef.current
    if (!s || !v) return
    const { error } = await supabase.from('watch_events').insert({
      student_id: s.id, video_id: v.id, event_type: eventType,
      position_sec: positionSec, session_id: sessionIdRef.current, company_id: s.company_id,
      device_type: deviceType,
    })
    // device_type カラム未作成の場合はフォールバック
    if (error) {
      await supabase.from('watch_events').insert({
        student_id: s.id, video_id: v.id, event_type: eventType,
        position_sec: positionSec, session_id: sessionIdRef.current, company_id: s.company_id,
      })
    }
  }, [deviceType])

  const checkSurveyTrigger = useCallback((currentTime: number) => {
    if (activeQuestionRef.current) return
    const sec = Math.floor(currentTime)
    const prevSec = prevCheckPosRef.current
    prevCheckPosRef.current = sec
    for (const q of questionsRef.current) {
      if (answeredIdsRef.current.has(q.id)) continue
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
      // ネイティブ動画
      if (nativeVideoRef.current && !nativeVideoRef.current.paused) {
        checkSurveyTrigger(nativeVideoRef.current.currentTime)
        return
      }
      // YouTube
      try {
        const p = playerRef.current
        if (p?.getPlayerState && p.getPlayerState() === 1) { // 1 = PLAYING
          checkSurveyTrigger(p.getCurrentTime())
        }
      } catch { /* player not ready */ }
    }, 1000)
  }, [checkSurveyTrigger])

  const handleAnswer = async (choice: string) => {
    const q = activeQuestionRef.current, s = studentRef.current, v = videoRef.current
    if (!q || !s || !v) return
    await supabase.from('survey_responses').insert({
      student_id: s.id, question_id: q.id, video_id: v.id,
      selected_choice: choice, session_id: sessionIdRef.current, company_id: s.company_id,
    })
    setAnsweredIds((prev) => new Set([...prev, q.id]))
    setActiveQuestion(null)
  }

  // ─── 初期化 ───
  useEffect(() => {
    const init = async () => {
      const token = new URLSearchParams(window.location.search).get('token')
      if (!token) { setError('URLにトークンが含まれていません。'); setLoading(false); return }

      const { data: sd } = await supabase.from('students').select('*').eq('token', token).maybeSingle()
      if (!sd) { setError('URLが無効です。採用担当者にご連絡ください。'); setLoading(false); return }
      if (new Date(sd.token_expires_at) < new Date()) {
        setError('このURLの有効期限が切れています。\n採用担当者に新しいURLの発行をご依頼ください。')
        setLoading(false); return
      }
      setStudent(sd)

      // company_idで動画を取得、見つからなければcompany_idなしで全公開動画から取得
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
      console.log('[StudentViewer] video loaded:', vd.id, 'type:', vd.youtube_url ? 'youtube' : 'upload', 'youtube_url:', vd.youtube_url, 'video_url:', vd.video_url)
      setVideo(vd)

      const { data: qd } = await supabase.from('survey_questions').select('*')
        .eq('video_id', vd.id).order('trigger_sec', { ascending: true })
      setQuestions(qd || [])

      const { data: rd } = await supabase.from('survey_responses').select('question_id')
        .eq('student_id', sd.id).eq('video_id', vd.id)
      setAnsweredIds(new Set((rd || []).map((r: { question_id: string }) => r.question_id)))
      setLoading(false)
    }
    init()

    // 動画追加/公開の即時反映
    const ch = supabase.channel('video-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'briefing_videos' }, () => window.location.reload())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  // ─── ネイティブ動画のイベント ───
  useEffect(() => {
    if (!video || getVideoType(video) !== 'upload') return
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
  }, [video?.id, recordEvent, startSurveyCheck])

  // ─── YouTube Player 初期化 ───
  useEffect(() => {
    if (!video || getVideoType(video) !== 'youtube') return
    const youtubeId = extractYouTubeId(video.youtube_url)
    if (!youtubeId) {
      console.error('[YT] Could not extract YouTube ID from:', video.youtube_url)
      return
    }

    let destroyed = false

    const createPlayer = () => {
      if (destroyed) return
      if (playerRef.current) return // 既に生成済み
      const container = document.getElementById('yt-player')
      if (!container) return

      console.log('[YT] Creating player for:', youtubeId)
      playerRef.current = new (window as any).YT.Player('yt-player', {
        videoId: youtubeId,
        width: '100%',
        height: '100%',
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: async (event: any) => {
            console.log('[YT] Player ready')
            const dur = event.target?.getDuration?.()
            if (dur && dur > 0 && videoRef.current) {
              const rounded = Math.round(dur)
              const { error } = await supabase.rpc('update_video_duration', { p_video_id: videoRef.current.id, p_duration: rounded })
              if (error) {
                await supabase.from('briefing_videos').update({ duration_sec: rounded })
                  .eq('id', videoRef.current.id).is('duration_sec', null)
              }
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

    // IFrame APIスクリプトを挿入
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(tag)
    }

    // YT API + DOM の両方が揃うまでポーリング（200ms間隔、最大15秒）
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
  }, [video?.id, recordEvent, startSurveyCheck])

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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-[#1B2A4A] to-[#2C3E6B] text-white px-6 py-5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold">会社説明会</h1>
          <div className="text-sm">{student.name} 様</div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="relative rounded-xl overflow-hidden bg-black aspect-video shadow-lg">
          {videoType === 'upload' ? (
            <video ref={nativeVideoRef} src={video.video_url!} controls className="w-full h-full" />
          ) : videoType === 'youtube' ? (
            <div id="yt-player" className="w-full h-full" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/60">動画を準備中です</div>
          )}
          {activeQuestion && (
            <SurveyOverlay question={activeQuestion} onAnswer={handleAnswer} />
          )}
        </div>

        <div className="mt-6 space-y-2">
          <h2 className="text-2xl font-bold text-gray-800">{video.title}</h2>
          {video.description && <p className="text-gray-600">{video.description}</p>}
        </div>

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
