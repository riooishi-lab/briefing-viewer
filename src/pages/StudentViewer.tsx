import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Student, BriefingVideo, SurveyQuestion } from '../lib/supabase'
import { v4 as uuidv4 } from 'uuid'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

const extractYouTubeId = (url: string): string | null => {
  const m = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i)
  return m ? m[1] : null
}

// ─── アンケートオーバーレイ（画面下部1/3、動画再生は継続）───
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
              className="px-3 py-2.5 border border-gray-200 rounded-lg hover:bg-[#0079B3] hover:text-white hover:border-[#0079B3] transition-colors text-sm font-medium text-left"
            >
              {choice}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
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

  // Ref版で最新のstateを参照（useEffect依存を減らしプレーヤー再生成を防止）
  const questionsRef = useRef<SurveyQuestion[]>([])
  const answeredIdsRef = useRef<Set<string>>(new Set())
  const activeQuestionRef = useRef<SurveyQuestion | null>(null)
  const studentRef = useRef<Student | null>(null)
  const videoRef = useRef<BriefingVideo | null>(null)

  questionsRef.current = questions
  answeredIdsRef.current = answeredIds
  activeQuestionRef.current = activeQuestion
  studentRef.current = student
  videoRef.current = video

  const isUploadVideo = !video?.youtube_url && !!video?.video_url

  // 視聴イベント記録（ref経由で常に最新のstudent/videoを参照）
  const recordEvent = useCallback(async (eventType: string, positionSec: number) => {
    const s = studentRef.current
    const v = videoRef.current
    if (!s || !v) return
    await supabase.from('watch_events').insert({
      student_id: s.id,
      video_id: v.id,
      event_type: eventType,
      position_sec: positionSec,
      session_id: sessionIdRef.current,
      company_id: s.company_id,
    })
  }, []) // 依存なし — refで最新値を取得

  // アンケートトリガーチェック（ref経由）
  const checkSurveyTrigger = useCallback((currentTime: number) => {
    if (activeQuestionRef.current) return

    const sec = Math.floor(currentTime)
    const prevSec = prevCheckPosRef.current
    prevCheckPosRef.current = sec

    for (const q of questionsRef.current) {
      if (answeredIdsRef.current.has(q.id)) continue
      const triggered =
        (sec >= q.trigger_sec && prevSec < q.trigger_sec) ||
        (sec >= q.trigger_sec && Math.abs(sec - prevSec) > 3)
      if (triggered) {
        setActiveQuestion(q)
        break
      }
    }
  }, []) // 依存なし — refで最新値を取得

  // アンケート回答（動画は停止しない。回答後もそのまま再生継続）
  const handleAnswer = async (choice: string) => {
    const q = activeQuestionRef.current
    const s = studentRef.current
    const v = videoRef.current
    if (!q || !s || !v) return
    await supabase.from('survey_responses').insert({
      student_id: s.id,
      question_id: q.id,
      video_id: v.id,
      selected_choice: choice,
      session_id: sessionIdRef.current,
      company_id: s.company_id,
    })
    setAnsweredIds((prev) => new Set([...prev, q.id]))
    setActiveQuestion(null)
    // 動画は再生中のまま — 何もしない
  }

  // 初期化
  useEffect(() => {
    const init = async () => {
      const token = new URLSearchParams(window.location.search).get('token')
      if (!token) {
        setError('URLにトークンが含まれていません。正しいURLからアクセスしてください。')
        setLoading(false)
        return
      }

      const { data: studentData } = await supabase
        .from('students').select('*').eq('token', token).maybeSingle()

      if (!studentData) {
        setError('URLが無効です。採用担当者にご連絡ください。')
        setLoading(false)
        return
      }
      if (new Date(studentData.token_expires_at) < new Date()) {
        setError('このURLの有効期限が切れています。\n採用担当者に新しいURLの発行をご依頼ください。')
        setLoading(false)
        return
      }

      setStudent(studentData)

      const { data: videoData } = await supabase
        .from('briefing_videos').select('*')
        .eq('company_id', studentData.company_id)
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(1).maybeSingle()

      if (!videoData) {
        setError('現在公開中の説明会動画はありません。')
        setLoading(false)
        return
      }
      setVideo(videoData)

      const { data: qData } = await supabase
        .from('survey_questions').select('*')
        .eq('video_id', videoData.id)
        .order('trigger_sec', { ascending: true })
      setQuestions(qData || [])

      const { data: rData } = await supabase
        .from('survey_responses').select('question_id')
        .eq('student_id', studentData.id)
        .eq('video_id', videoData.id)
      setAnsweredIds(new Set((rData || []).map((r: { question_id: string }) => r.question_id)))
      setLoading(false)
    }
    init()
  }, [])

  // アンケートチェック共通ループ
  const startSurveyCheck = useCallback(() => {
    if (surveyCheckRef.current) clearInterval(surveyCheckRef.current)
    surveyCheckRef.current = setInterval(() => {
      const v = videoRef.current
      if (!v) return
      const isUpload = !v.youtube_url && !!v.video_url
      let currentTime = 0
      if (isUpload && nativeVideoRef.current) {
        if (nativeVideoRef.current.paused) return
        currentTime = nativeVideoRef.current.currentTime
      } else if (playerRef.current?.getCurrentTime) {
        try {
          const state = playerRef.current.getPlayerState()
          if (state !== (window as any).YT?.PlayerState?.PLAYING) return
          currentTime = playerRef.current.getCurrentTime()
        } catch { return }
      } else return
      checkSurveyTrigger(currentTime)
    }, 1000)
  }, [checkSurveyTrigger])

  // ネイティブ動画（アップロード）のイベントハンドラ
  useEffect(() => {
    if (!video || !isUploadVideo) return
    const el = nativeVideoRef.current
    if (!el) return

    const onPlay = () => {
      recordEvent('play', el.currentTime)
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      heartbeatRef.current = setInterval(() => recordEvent('heartbeat', el.currentTime), 30000)
      startSurveyCheck()
    }
    const onPause = () => {
      recordEvent('pause', el.currentTime)
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
    }
    const onEnded = () => {
      recordEvent('ended', el.duration)
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      if (surveyCheckRef.current) clearInterval(surveyCheckRef.current)
      setCompleted(true)
    }

    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    el.addEventListener('ended', onEnded)
    return () => {
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
      el.removeEventListener('ended', onEnded)
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      if (surveyCheckRef.current) clearInterval(surveyCheckRef.current)
    }
  }, [video, isUploadVideo, recordEvent, startSurveyCheck])

  // YouTube Player 初期化（依存を最小限にしてプレーヤー再生成を防止）
  useEffect(() => {
    if (!video || isUploadVideo) return
    const youtubeId = video.youtube_url ? extractYouTubeId(video.youtube_url) : null
    if (!youtubeId) return

    const initPlayer = () => {
      playerRef.current = new (window as any).YT.Player('yt-player', {
        videoId: youtubeId,
        playerVars: { rel: 0, modestbranding: 1 },
        events: {
          onStateChange: (event: any) => {
            const p = playerRef.current
            if (!p) return
            const pos = p.getCurrentTime()
            if (event.data === (window as any).YT.PlayerState.PLAYING) {
              recordEvent('play', pos)
              if (heartbeatRef.current) clearInterval(heartbeatRef.current)
              heartbeatRef.current = setInterval(() => recordEvent('heartbeat', p.getCurrentTime()), 30000)
              startSurveyCheck()
            } else if (event.data === (window as any).YT.PlayerState.PAUSED) {
              recordEvent('pause', pos)
              if (heartbeatRef.current) clearInterval(heartbeatRef.current)
            } else if (event.data === (window as any).YT.PlayerState.ENDED) {
              recordEvent('ended', p.getDuration())
              if (heartbeatRef.current) clearInterval(heartbeatRef.current)
              if (surveyCheckRef.current) clearInterval(surveyCheckRef.current)
              setCompleted(true)
            }
          },
        },
      })
    }

    if ((window as any).YT?.Player) {
      initPlayer()
    } else {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(tag)
      ;(window as any).onYouTubeIframeAPIReady = initPlayer
    }

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      if (surveyCheckRef.current) clearInterval(surveyCheckRef.current)
      playerRef.current?.destroy()
    }
    // video.idのみ依存（answeredIds等の変更でプレーヤーが再生成されない）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video?.id])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-3 animate-pulse">
          <div className="w-12 h-12 bg-[#0079B3]/20 rounded-full mx-auto" />
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

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-[#0079B3] to-[#5CA7D1] text-white px-6 py-5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold">会社説明会</h1>
          <div className="text-sm">{student.name} 様</div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="relative rounded-xl overflow-hidden bg-black aspect-video shadow-lg">
          {isUploadVideo ? (
            <video ref={nativeVideoRef} src={video.video_url!} controls className="w-full h-full" />
          ) : (
            <div id="yt-player" className="w-full h-full" />
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
