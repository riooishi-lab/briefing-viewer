import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Student, BriefingVideo, SurveyQuestion } from '../lib/supabase'
import { v4 as uuidv4 } from 'uuid'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

// YouTube ID 抽出
const extractYouTubeId = (url: string): string | null => {
  const m = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i)
  return m ? m[1] : null
}

// ─── アンケートオーバーレイ ───
function SurveyOverlay({
  question,
  onAnswer,
}: {
  question: SurveyQuestion
  onAnswer: (choice: string) => void
}) {
  const choices = (question.choices as string[]) || []

  return (
    <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-10 animate-in fade-in">
      <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl">
        <p className="text-lg font-bold text-gray-800 mb-4">{question.question_text}</p>
        <div className="space-y-2">
          {choices.map((choice, i) => (
            <button
              key={i}
              onClick={() => onAnswer(choice)}
              className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-[#0079B3] hover:text-white hover:border-[#0079B3] transition-colors text-sm font-medium"
            >
              {choice}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── メインコンポーネント ───
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
  const sessionIdRef = useRef<string>(uuidv4())
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastCheckRef = useRef<number>(0)

  const companyId = student?.company_id || ''

  // 視聴イベント記録
  const recordEvent = useCallback(async (eventType: string, positionSec: number) => {
    if (!student || !video) return
    await supabase.from('watch_events').insert({
      student_id: student.id,
      video_id: video.id,
      event_type: eventType,
      position_sec: positionSec,
      session_id: sessionIdRef.current,
      company_id: companyId,
    })
  }, [student, video, companyId])

  // アンケートトリガーチェック
  const checkSurveyTrigger = useCallback((currentTime: number) => {
    if (activeQuestion) return
    const sec = Math.floor(currentTime)
    if (sec === lastCheckRef.current) return
    lastCheckRef.current = sec

    for (const q of questions) {
      if (!answeredIds.has(q.id) && sec >= q.trigger_sec && sec < q.trigger_sec + 2) {
        setActiveQuestion(q)
        playerRef.current?.pauseVideo()
        break
      }
    }
  }, [questions, answeredIds, activeQuestion])

  // アンケート回答
  const handleAnswer = async (choice: string) => {
    if (!activeQuestion || !student || !video) return
    await supabase.from('survey_responses').insert({
      student_id: student.id,
      question_id: activeQuestion.id,
      video_id: video.id,
      selected_choice: choice,
      session_id: sessionIdRef.current,
      company_id: companyId,
    })
    setAnsweredIds((prev) => new Set([...prev, activeQuestion.id]))
    setActiveQuestion(null)
    playerRef.current?.playVideo()
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
        .from('students')
        .select('*')
        .eq('token', token)
        .maybeSingle()

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

      // 公開中の動画を取得（最新1件）
      const { data: videoData } = await supabase
        .from('briefing_videos')
        .select('*')
        .eq('company_id', studentData.company_id)
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!videoData) {
        setError('現在公開中の説明会動画はありません。')
        setLoading(false)
        return
      }

      setVideo(videoData)

      // アンケート設問を取得
      const { data: qData } = await supabase
        .from('survey_questions')
        .select('*')
        .eq('video_id', videoData.id)
        .order('trigger_sec', { ascending: true })

      setQuestions(qData || [])

      // 既に回答済みの設問を取得
      const { data: rData } = await supabase
        .from('survey_responses')
        .select('question_id')
        .eq('student_id', studentData.id)
        .eq('video_id', videoData.id)

      setAnsweredIds(new Set((rData || []).map((r: { question_id: string }) => r.question_id)))
      setLoading(false)
    }

    init()
  }, [])

  // YouTube Player 初期化
  useEffect(() => {
    if (!video) return
    const youtubeId = extractYouTubeId(video.youtube_url)
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
              heartbeatRef.current = setInterval(() => {
                const t = p.getCurrentTime()
                recordEvent('heartbeat', t)
                checkSurveyTrigger(t)
              }, 30000)
              // 高頻度のアンケートチェック（1秒ごと）
              const surveyCheck = setInterval(() => {
                if (p.getPlayerState() === (window as any).YT.PlayerState.PLAYING) {
                  checkSurveyTrigger(p.getCurrentTime())
                } else {
                  clearInterval(surveyCheck)
                }
              }, 1000)
            } else if (event.data === (window as any).YT.PlayerState.PAUSED) {
              recordEvent('pause', pos)
              if (heartbeatRef.current) clearInterval(heartbeatRef.current)
            } else if (event.data === (window as any).YT.PlayerState.ENDED) {
              recordEvent('ended', p.getDuration())
              if (heartbeatRef.current) clearInterval(heartbeatRef.current)
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
      playerRef.current?.destroy()
    }
  }, [video, recordEvent, checkSurveyTrigger])

  // ─── ローディング ───
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

  // ─── エラー ───
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
      {/* ヘッダー */}
      <header className="bg-gradient-to-r from-[#0079B3] to-[#5CA7D1] text-white px-6 py-5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-lg font-bold">会社説明会</h1>
          <div className="text-sm">{student.name} 様</div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* 動画プレーヤー */}
        <div className="relative rounded-xl overflow-hidden bg-black aspect-video shadow-lg">
          <div id="yt-player" className="w-full h-full" />
          {activeQuestion && (
            <SurveyOverlay question={activeQuestion} onAnswer={handleAnswer} />
          )}
        </div>

        {/* 動画情報 */}
        <div className="mt-6 space-y-2">
          <h2 className="text-2xl font-bold text-gray-800">{video.title}</h2>
          {video.description && <p className="text-gray-600">{video.description}</p>}
        </div>

        {/* 視聴完了メッセージ */}
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
