import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import type { BriefingVideo, Student, SurveyQuestion, SurveyResponse } from '../lib/supabase'
import { toast } from 'sonner'
import {
  Video, Users, BarChart3, ClipboardList, LogOut, Plus, Trash2,
  Copy, Link, Clock, CheckCircle2, XCircle, Play, Upload, Download, Loader2,
  Monitor, Smartphone, Tablet
} from 'lucide-react'

type Tab = 'videos' | 'students' | 'surveys' | 'logs'

// YouTube ID 抽出
const extractYouTubeId = (url: string): string | null => {
  const m = url.match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i)
  return m ? m[1] : null
}

// ─── 動画管理 ───
type AddMode = 'youtube' | 'upload'

function VideosTab({ companyId }: { companyId: string }) {
  const [videos, setVideos] = useState<BriefingVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [desc, setDesc] = useState('')
  const [addMode, setAddMode] = useState<AddMode>('youtube')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchVideos = useCallback(async () => {
    const { data } = await supabase.from('briefing_videos').select('*').eq('company_id', companyId).order('created_at', { ascending: false })
    setVideos(data || [])
    setLoading(false)
  }, [companyId])

  useEffect(() => { fetchVideos() }, [fetchVideos])

  const addYouTubeVideo = async () => {
    if (!title || !url) return
    if (!extractYouTubeId(url)) { toast.error('有効なYouTube URLを入力してください'); return }
    const { error } = await supabase.from('briefing_videos').insert({ title, youtube_url: url, description: desc || null, company_id: companyId })
    if (error) { toast.error('追加に失敗しました'); return }
    setTitle(''); setUrl(''); setDesc('')
    toast.success('動画を追加しました')
    fetchVideos()
  }

  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('video/')) { toast.error('動画ファイルを選択してください'); return }
    if (file.size > 500 * 1024 * 1024) { toast.error('ファイルサイズは500MB以下にしてください'); return }
    setSelectedFile(file)
  }

  const uploadVideo = async () => {
    if (!selectedFile || !title) return
    setUploading(true)
    const ext = selectedFile.name.split('.').pop() || 'mp4'
    const path = `${companyId}/${crypto.randomUUID()}.${ext}`

    const { error: uploadError } = await supabase.storage.from('videos').upload(path, selectedFile, { contentType: selectedFile.type })
    if (uploadError) {
      toast.error(`アップロード失敗: ${uploadError.message}`)
      setUploading(false)
      return
    }

    const { data: urlData } = supabase.storage.from('videos').getPublicUrl(path)

    const { error: dbError } = await supabase.from('briefing_videos').insert({
      title, description: desc || null, video_url: urlData.publicUrl, company_id: companyId,
    })
    if (dbError) { toast.error('DB登録に失敗しました'); setUploading(false); return }

    setTitle(''); setDesc(''); setSelectedFile(null)
    if (fileRef.current) fileRef.current.value = ''
    setUploading(false)
    toast.success('動画をアップロードしました')
    fetchVideos()
  }

  const togglePublish = async (id: string, current: boolean) => {
    await supabase.from('briefing_videos').update({ is_published: !current }).eq('id', id)
    fetchVideos()
  }

  const deleteVideo = async (id: string) => {
    if (!confirm('この動画を削除しますか？関連するアンケート・視聴ログも全て削除されます。')) return
    await supabase.from('briefing_videos').delete().eq('id', id)
    toast.success('削除しました')
    fetchVideos()
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-800">動画を追加</h3>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setAddMode('youtube')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${addMode === 'youtube' ? 'bg-white shadow text-[#1B2A4A]' : 'text-gray-500'}`}>
              YouTube URL
            </button>
            <button onClick={() => setAddMode('upload')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${addMode === 'upload' ? 'bg-white shadow text-[#1B2A4A]' : 'text-gray-500'}`}>
              ファイルアップロード
            </button>
          </div>
        </div>

        <input placeholder="タイトル *" value={title} onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]" />

        {addMode === 'youtube' ? (
          <>
            <input placeholder="YouTube URL *" value={url} onChange={(e) => setUrl(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]" />
            <input placeholder="説明（任意）" value={desc} onChange={(e) => setDesc(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]" />
            <button onClick={addYouTubeVideo} disabled={!title || !url}
              className="px-4 py-2 bg-[#1B2A4A] text-white rounded-lg text-sm font-medium hover:bg-[#0F1D35] disabled:opacity-40 flex items-center gap-2">
              <Plus className="h-4 w-4" /> 追加
            </button>
          </>
        ) : (
          <>
            <input placeholder="説明（任意）" value={desc} onChange={(e) => setDesc(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]" />
            <div>
              <input ref={fileRef} type="file" accept="video/*" onChange={handleFileSelect}
                className="text-sm file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-gray-100 file:text-gray-700 file:text-sm file:cursor-pointer" />
              {selectedFile && <p className="text-xs text-green-600 mt-1">{selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(1)} MB)</p>}
            </div>
            <button onClick={uploadVideo} disabled={!title || !selectedFile || uploading}
              className="px-4 py-2 bg-[#1B2A4A] text-white rounded-lg text-sm font-medium hover:bg-[#0F1D35] disabled:opacity-40 flex items-center gap-2">
              {uploading ? <><Loader2 className="h-4 w-4 animate-spin" /> アップロード中...</> : <><Upload className="h-4 w-4" /> アップロード</>}
            </button>
            <p className="text-xs text-gray-400">対応形式: MP4, WebM, MOV（500MB以下）</p>
          </>
        )}
      </div>

      {loading ? <p className="text-gray-400 text-center py-8">読み込み中...</p> : videos.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Video className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p>動画がまだありません</p>
        </div>
      ) : (
        <div className="space-y-3">
          {videos.map((v) => {
            const ytId = v.youtube_url ? extractYouTubeId(v.youtube_url) : null
            const isUpload = !v.youtube_url && v.video_url
            return (
              <div key={v.id} className="bg-white rounded-xl border p-4 flex gap-4 items-center">
                {ytId ? (
                  <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} alt="" className="w-32 h-18 rounded object-cover shrink-0" />
                ) : isUpload ? (
                  <div className="w-32 h-18 rounded bg-gray-100 flex items-center justify-center shrink-0">
                    <Upload className="h-6 w-6 text-gray-400" />
                  </div>
                ) : null}
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-gray-800 truncate">{v.title}</h4>
                  {v.description && <p className="text-sm text-gray-500 truncate">{v.description}</p>}
                  <p className="text-xs text-gray-400 mt-1">
                    {isUpload ? 'アップロード動画' : 'YouTube'} • {new Date(v.created_at).toLocaleDateString('ja-JP')}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => togglePublish(v.id, v.is_published)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium ${v.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {v.is_published ? '公開中' : '非公開'}
                  </button>
                  <button onClick={() => deleteVideo(v.id)} className="p-1.5 text-red-400 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── 学生管理 ───
interface StudentWithStatus extends Student {
  watched: boolean
}

function StudentsTab({ companyId }: { companyId: string }) {
  const [students, setStudents] = useState<StudentWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [csvMode, setCsvMode] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchStudents = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('students').select('*').eq('company_id', companyId).order('created_at', { ascending: false })
    const studentList = data || []

    // 説明会動画の視聴有無を取得（playイベントが1つでもあれば視聴済み）
    const { data: playEvents } = await supabase
      .from('watch_events')
      .select('student_id')
      .eq('company_id', companyId)
      .in('event_type', ['play', 'heartbeat', 'ended'])
    const watchedSet = new Set((playEvents || []).map((e: { student_id: string }) => e.student_id))

    setStudents(studentList.map((s: Student) => ({ ...s, watched: watchedSet.has(s.id) })))
    setLoading(false)
  }, [companyId])

  useEffect(() => { fetchStudents() }, [fetchStudents])

  const addStudent = async () => {
    if (!name || !email) return
    const { error } = await supabase.from('students').insert({ name, email, company_id: companyId })
    if (error) { toast.error(error.message.includes('unique') ? 'このメールアドレスは既に登録されています' : '追加に失敗しました'); return }
    setName(''); setEmail('')
    toast.success('学生を追加しました')
    fetchStudents()
  }

  // CSV インポート
  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const lines = text.split(/\r?\n/).filter((l) => l.trim())
    if (lines.length < 2) { toast.error('CSVに有効なデータがありません'); return }

    const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''))
    const nameIdx = headers.findIndex((h) => h === '名前' || h === 'name')
    const emailIdx = headers.findIndex((h) => h === 'メールアドレス' || h === 'email')
    if (nameIdx === -1 || emailIdx === -1) {
      toast.error('ヘッダーに「名前」「メールアドレス」が必要です')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const rows: { name: string; email: string; company_id: string }[] = []
    const errors: string[] = []
    const seen = new Set<string>()

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
      const n = cols[nameIdx]?.trim()
      const em = cols[emailIdx]?.trim().toLowerCase()
      if (!n || !em) continue
      if (!emailRegex.test(em)) { errors.push(`行${i + 1}: メール形式不正 (${em})`); continue }
      if (seen.has(em)) { errors.push(`行${i + 1}: 重複 (${em})`); continue }
      seen.add(em)
      rows.push({ name: n, email: em, company_id: companyId })
    }

    if (errors.length > 0) {
      toast.error(errors.slice(0, 3).join('\n') + (errors.length > 3 ? `\n...他${errors.length - 3}件` : ''))
      return
    }
    if (rows.length === 0) { toast.error('有効なデータがありません'); return }

    const { error } = await supabase.from('students').upsert(rows, { onConflict: 'email' })
    if (error) { toast.error(`インポート失敗: ${error.message}`); return }
    toast.success(`${rows.length}名をインポートしました`)
    if (fileRef.current) fileRef.current.value = ''
    setCsvMode(false)
    fetchStudents()
  }

  const downloadSample = () => {
    const csv = '名前,メールアドレス\n田中太郎,tanaka@example.com\n佐藤花子,sato@example.com'
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'students_sample.csv'
    a.click()
  }

  const deleteStudent = async (id: string, sName: string) => {
    if (!confirm(`${sName} のデータを完全に削除しますか？`)) return
    await supabase.from('students').delete().eq('id', id)
    toast.success('削除しました')
    fetchStudents()
  }

  const copyUrl = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/watch?token=${token}`)
    toast.success('URLをコピーしました')
  }

  return (
    <div className="space-y-6">
      {/* 追加フォーム */}
      <div className="bg-white rounded-xl border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-800">学生を追加</h3>
          <button onClick={() => setCsvMode(!csvMode)}
            className="text-sm text-[#1B2A4A] hover:underline flex items-center gap-1">
            <Upload className="h-3.5 w-3.5" /> {csvMode ? '個別追加に切替' : 'CSVで一括追加'}
          </button>
        </div>

        {csvMode ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input ref={fileRef} type="file" accept=".csv" onChange={handleCsvUpload}
                className="text-sm file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-[#1B2A4A] file:text-white file:text-sm file:cursor-pointer" />
              <button onClick={downloadSample} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                <Download className="h-3 w-3" /> サンプルCSV
              </button>
            </div>
            <p className="text-xs text-gray-400">ヘッダー: 名前,メールアドレス（UTF-8）</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input placeholder="氏名 *" value={name} onChange={(e) => setName(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]" />
              <input placeholder="メールアドレス *" value={email} onChange={(e) => setEmail(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]" />
            </div>
            <button onClick={addStudent} disabled={!name || !email}
              className="px-4 py-2 bg-[#1B2A4A] text-white rounded-lg text-sm font-medium hover:bg-[#0F1D35] disabled:opacity-40 flex items-center gap-2">
              <Plus className="h-4 w-4" /> 追加
            </button>
          </>
        )}
      </div>

      {/* 一覧 */}
      {loading ? <p className="text-gray-400 text-center py-8">読み込み中...</p> : students.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Users className="h-10 w-10 mx-auto mb-2 opacity-40" />
          <p>学生がまだ登録されていません</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">氏名</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">メールアドレス</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">説明会視聴</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">有効期限</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">視聴URL</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {students.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-gray-500">{s.email}</td>
                  <td className="px-4 py-3">
                    {s.watched ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded-full">
                        <CheckCircle2 className="h-3 w-3" /> 視聴済み
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                        <XCircle className="h-3 w-3" /> 未視聴
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{new Date(s.token_expires_at).toLocaleDateString('ja-JP')}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => copyUrl(s.token)} className="text-[#1B2A4A] hover:underline flex items-center gap-1 text-xs">
                      <Link className="h-3 w-3" /><Copy className="h-3 w-3" /> コピー
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => deleteStudent(s.id, s.name)} className="text-red-400 hover:text-red-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── アンケート管理 ───
function SurveysTab({ companyId }: { companyId: string }) {
  const [videos, setVideos] = useState<BriefingVideo[]>([])
  const [questions, setQuestions] = useState<SurveyQuestion[]>([])
  const [responses, setResponses] = useState<(SurveyResponse & { student?: Student })[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null)

  // 新規設問フォーム
  const [triggerSec, setTriggerSec] = useState(60)
  const [qText, setQText] = useState('')
  const [choices, setChoices] = useState(['', '', '', ''])

  const fetchAll = useCallback(async () => {
    const { data: vData } = await supabase.from('briefing_videos').select('*').eq('company_id', companyId).order('created_at', { ascending: false })
    setVideos(vData || [])
    if (vData && vData.length > 0 && !selectedVideoId) setSelectedVideoId(vData[0].id)
    setLoading(false)
  }, [companyId, selectedVideoId])

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    if (!selectedVideoId) return
    const fetchQ = async () => {
      const { data: qData } = await supabase.from('survey_questions').select('*').eq('video_id', selectedVideoId).order('trigger_sec')
      setQuestions(qData || [])
      const { data: rData } = await supabase.from('survey_responses').select('*, student:students(name, email)').eq('video_id', selectedVideoId)
      setResponses(rData || [])
    }
    fetchQ()
  }, [selectedVideoId])

  const addQuestion = async () => {
    if (!qText || !selectedVideoId) return
    const validChoices = choices.filter((c) => c.trim())
    if (validChoices.length < 2) { toast.error('選択肢を2つ以上入力してください'); return }
    const { error } = await supabase.from('survey_questions').insert({
      video_id: selectedVideoId, trigger_sec: triggerSec, question_text: qText,
      choices: validChoices, company_id: companyId,
    })
    if (error) { toast.error('追加に失敗しました'); return }
    setQText(''); setChoices(['', '', '', '']); setTriggerSec(60)
    toast.success('設問を追加しました')
    const { data: qData } = await supabase.from('survey_questions').select('*').eq('video_id', selectedVideoId).order('trigger_sec')
    setQuestions(qData || [])
  }

  const deleteQuestion = async (id: string) => {
    if (!confirm('この設問と回答を削除しますか？')) return
    await supabase.from('survey_questions').delete().eq('id', id)
    toast.success('削除しました')
    setQuestions((prev) => prev.filter((q) => q.id !== id))
  }

  if (loading) return <p className="text-gray-400 text-center py-8">読み込み中...</p>

  return (
    <div className="space-y-6">
      {/* 動画選択 */}
      <div className="flex gap-2 flex-wrap">
        {videos.map((v) => (
          <button key={v.id} onClick={() => setSelectedVideoId(v.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${selectedVideoId === v.id ? 'bg-[#1B2A4A] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {v.title}
          </button>
        ))}
      </div>

      {selectedVideoId && (
        <>
          {/* 設問追加 */}
          <div className="bg-white rounded-xl border p-6 space-y-4">
            <h3 className="font-bold text-gray-800">アンケート設問を追加</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs text-gray-500">表示タイミング（秒）</label>
                <input type="number" value={triggerSec} onChange={(e) => setTriggerSec(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg text-sm" min={0} />
              </div>
              <div className="md:col-span-3">
                <label className="text-xs text-gray-500">質問文</label>
                <input placeholder="例: この説明で最も興味を持ったポイントは？" value={qText} onChange={(e) => setQText(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">選択肢（2〜4つ）</label>
              <div className="grid grid-cols-2 gap-2">
                {choices.map((c, i) => (
                  <input key={i} placeholder={`選択肢${i + 1}`} value={c}
                    onChange={(e) => setChoices((prev) => prev.map((p, j) => j === i ? e.target.value : p))}
                    className="px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]" />
                ))}
              </div>
            </div>
            <button onClick={addQuestion} disabled={!qText}
              className="px-4 py-2 bg-[#1B2A4A] text-white rounded-lg text-sm font-medium hover:bg-[#0F1D35] disabled:opacity-40 flex items-center gap-2">
              <Plus className="h-4 w-4" /> 追加
            </button>
          </div>

          {/* 設問一覧 + 回答集計 */}
          {questions.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p>この動画にはまだ設問がありません</p>
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((q) => {
                const qResponses = responses.filter((r) => r.question_id === q.id)
                const choiceCounts: Record<string, number> = {}
                ;(q.choices as string[]).forEach((c) => (choiceCounts[c] = 0))
                qResponses.forEach((r) => (choiceCounts[r.selected_choice] = (choiceCounts[r.selected_choice] || 0) + 1))
                const total = qResponses.length

                return (
                  <div key={q.id} className="bg-white rounded-xl border p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs bg-[#1B2A4A]/10 text-[#1B2A4A] px-2 py-0.5 rounded-full font-medium">
                          {Math.floor(q.trigger_sec / 60)}:{String(q.trigger_sec % 60).padStart(2, '0')} 後に表示
                        </span>
                        <p className="font-bold text-gray-800 mt-2">{q.question_text}</p>
                      </div>
                      <button onClick={() => deleteQuestion(q.id)} className="text-red-400 hover:text-red-600 shrink-0">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {/* 回答集計バー */}
                    <div className="space-y-2">
                      {Object.entries(choiceCounts).map(([choice, count]) => {
                        const pct = total > 0 ? (count / total) * 100 : 0
                        return (
                          <div key={choice} className="flex items-center gap-3">
                            <span className="text-sm text-gray-700 w-40 truncate">{choice}</span>
                            <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-[#1B2A4A]/70 rounded-full transition-all" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-gray-500 w-16 text-right">{count}票 ({pct.toFixed(0)}%)</span>
                          </div>
                        )
                      })}
                    </div>
                    <p className="text-xs text-gray-400">回答数: {total}件</p>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── 時間帯別視聴グラフ ───
function HourlyChart({ hourlyCounts }: { hourlyCounts: number[] }) {
  const [hoveredHour, setHoveredHour] = useState<number | null>(null)
  const maxCount = Math.max(...hourlyCounts, 1)
  const total = hourlyCounts.reduce((a, b) => a + b, 0)
  const peakHour = hourlyCounts.indexOf(Math.max(...hourlyCounts))

  const BAR_W = 14
  const BAR_GAP = 5
  const CHART_H = 120
  const PAD_L = 28
  const PAD_R = 8
  const PAD_T = 24
  const PAD_B = 24
  const svgW = PAD_L + 24 * (BAR_W + BAR_GAP) - BAR_GAP + PAD_R
  const svgH = PAD_T + CHART_H + PAD_B

  const gridValues = [0, Math.ceil(maxCount / 2), maxCount]

  return (
    <div className="bg-white rounded-xl border p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-[#1B2A4A]" />
          時間帯別 視聴集中度
        </h3>
        <span className="text-xs text-gray-400">{total} セッション</span>
      </div>

      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full" style={{ minWidth: 360 }}>
          {/* Grid lines */}
          {gridValues.map((val) => {
            const y = PAD_T + CHART_H - (val / maxCount) * CHART_H
            return (
              <g key={val}>
                <line x1={PAD_L} y1={y} x2={svgW - PAD_R} y2={y} stroke="#f3f4f6" strokeWidth={1} />
                <text x={PAD_L - 4} y={y + 3.5} textAnchor="end" fontSize={9} fill="#d1d5db">{val}</text>
              </g>
            )
          })}

          {/* Baseline */}
          <line x1={PAD_L} y1={PAD_T + CHART_H} x2={svgW - PAD_R} y2={PAD_T + CHART_H} stroke="#e5e7eb" strokeWidth={1} />

          {/* Bars */}
          {hourlyCounts.map((count, hour) => {
            const x = PAD_L + hour * (BAR_W + BAR_GAP)
            const barH = (count / maxCount) * CHART_H
            const y = PAD_T + CHART_H - barH
            const isPeak = count > 0 && count === Math.max(...hourlyCounts)
            const isHovered = hoveredHour === hour

            // Tooltip x: clamp so it doesn't overflow
            const tipW = 56
            const tipX = Math.min(Math.max(x + BAR_W / 2 - tipW / 2, PAD_L), svgW - PAD_R - tipW)

            return (
              <g key={hour}>
                {count > 0 ? (
                  <rect
                    x={x} y={y} width={BAR_W} height={barH} rx={2.5}
                    fill={isPeak ? '#1B2A4A' : isHovered ? '#3b82f6' : '#93c5fd'}
                    style={{ transition: 'fill 0.15s' }}
                    onMouseEnter={() => setHoveredHour(hour)}
                    onMouseLeave={() => setHoveredHour(null)}
                    className="cursor-default"
                  />
                ) : (
                  <rect x={x} y={PAD_T + CHART_H - 1} width={BAR_W} height={1} rx={1} fill="#f3f4f6" />
                )}
                {/* X-axis label every 3 hours */}
                {hour % 3 === 0 && (
                  <text x={x + BAR_W / 2} y={PAD_T + CHART_H + 14} textAnchor="middle" fontSize={9} fill="#9ca3af">
                    {hour}時
                  </text>
                )}
                {/* Tooltip */}
                {isHovered && count > 0 && (
                  <g>
                    <rect x={tipX} y={y - 22} width={tipW} height={17} rx={3} fill="#111827" />
                    <text x={tipX + tipW / 2} y={y - 10} textAnchor="middle" fontSize={10} fill="white">
                      {hour}時: {count}回
                    </text>
                  </g>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      {total > 0 && (
        <p className="text-xs text-gray-500">
          ピーク: <span className="font-medium text-[#1B2A4A]">{peakHour}時台</span>（{Math.max(...hourlyCounts)}セッション）
        </p>
      )}
    </div>
  )
}

// ─── 端末別円グラフ ───
function DevicePieChart({ sessions }: { sessions: { device_type: string }[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const devices = [
    { key: 'PC',    label: 'PC',    color: '#1B2A4A' },
    { key: 'スマホ', label: 'スマホ', color: '#3b82f6' },
    { key: 'iPad',  label: 'iPad',  color: '#93c5fd' },
  ]
  const counts = devices.map(d => sessions.filter(s => s.device_type === d.key).length)
  const total = counts.reduce((a, b) => a + b, 0)

  const cx = 80, cy = 80, r = 65, ir = 38
  const toXY = (angleDeg: number, radius: number) => {
    const rad = (angleDeg - 90) * Math.PI / 180
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) }
  }
  const slicePath = (start: number, end: number) => {
    if (end - start >= 360) end = 359.999
    const s1 = toXY(start, r), e1 = toXY(end, r)
    const s2 = toXY(start, ir), e2 = toXY(end, ir)
    const lg = end - start > 180 ? 1 : 0
    return `M ${s1.x} ${s1.y} A ${r} ${r} 0 ${lg} 1 ${e1.x} ${e1.y} L ${e2.x} ${e2.y} A ${ir} ${ir} 0 ${lg} 0 ${s2.x} ${s2.y} Z`
  }

  let angle = 0
  const slices = counts.map((count, i) => {
    const deg = total > 0 ? (count / total) * 360 : 0
    const start = angle; angle += deg
    return { ...devices[i], count, pct: total > 0 ? Math.round(count / total * 100) : 0, start, end: angle }
  })

  return (
    <div className="bg-white rounded-xl border p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
        <Monitor className="h-4 w-4 text-[#1B2A4A]" />
        端末別 視聴割合
      </h3>
      <div className="flex items-center gap-6">
        <svg viewBox="0 0 160 160" style={{ width: 140, height: 140, flexShrink: 0 }}>
          {total === 0 ? (
            <circle cx={cx} cy={cy} r={r} fill="#f3f4f6" />
          ) : slices.map((s, i) => s.count > 0 && (
            <path key={s.key} d={slicePath(s.start, s.end)} fill={s.color}
              opacity={hoveredIdx === null || hoveredIdx === i ? 1 : 0.4}
              style={{ transition: 'opacity 0.15s' }}
              onMouseEnter={() => setHoveredIdx(i)} onMouseLeave={() => setHoveredIdx(null)}
              className="cursor-default" />
          ))}
          <text x={cx} y={cy - 6} textAnchor="middle" fontSize={22} fontWeight="bold" fill="#1B2A4A">{total}</text>
          <text x={cx} y={cy + 11} textAnchor="middle" fontSize={10} fill="#9ca3af">セッション</text>
        </svg>
        <div className="space-y-3 flex-1">
          {slices.map((s, i) => (
            <div key={s.key}
              className={`flex items-center gap-2 text-sm transition-opacity ${hoveredIdx !== null && hoveredIdx !== i ? 'opacity-30' : ''}`}
              onMouseEnter={() => setHoveredIdx(i)} onMouseLeave={() => setHoveredIdx(null)}
            >
              <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-gray-600 flex-1">{s.label}</span>
              <span className="font-semibold text-gray-800">{s.count}</span>
              <span className="text-gray-400 text-xs w-9 text-right">{s.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── 視聴時間分布グラフ ───
function WatchDurationChart({ watchSecs, videoDuration }: { watchSecs: number[]; videoDuration: number }) {
  const [hoveredBin, setHoveredBin] = useState<number | null>(null)
  const BINS = 10

  const maxDur = videoDuration > 0 ? videoDuration : Math.max(...watchSecs, 60)
  const binSize = maxDur / BINS
  const binCounts = Array(BINS).fill(0)
  watchSecs.forEach(sec => { if (sec > 0) binCounts[Math.min(Math.floor(sec / binSize), BINS - 1)]++ })

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
  const maxCount = Math.max(...binCounts, 1)
  const total = watchSecs.filter(s => s > 0).length

  const BAR_W = 28, BAR_GAP = 6, CHART_H = 120
  const PAD_L = 28, PAD_R = 8, PAD_T = 24, PAD_B = 36
  const svgW = PAD_L + BINS * (BAR_W + BAR_GAP) - BAR_GAP + PAD_R
  const svgH = PAD_T + CHART_H + PAD_B
  const gridValues = [0, Math.ceil(maxCount / 2), maxCount]

  return (
    <div className="bg-white rounded-xl border p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Clock className="h-4 w-4 text-[#1B2A4A]" />
          視聴時間 分布
        </h3>
        <span className="text-xs text-gray-400">{total} セッション</span>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full" style={{ minWidth: 280 }}>
          {gridValues.map(val => {
            const y = PAD_T + CHART_H - (val / maxCount) * CHART_H
            return (
              <g key={val}>
                <line x1={PAD_L} y1={y} x2={svgW - PAD_R} y2={y} stroke="#f3f4f6" strokeWidth={1} />
                <text x={PAD_L - 4} y={y + 3.5} textAnchor="end" fontSize={9} fill="#d1d5db">{val}</text>
              </g>
            )
          })}
          <line x1={PAD_L} y1={PAD_T + CHART_H} x2={svgW - PAD_R} y2={PAD_T + CHART_H} stroke="#e5e7eb" strokeWidth={1} />

          {binCounts.map((count, i) => {
            const x = PAD_L + i * (BAR_W + BAR_GAP)
            const barH = (count / maxCount) * CHART_H
            const y = PAD_T + CHART_H - barH
            const isPeak = count > 0 && count === Math.max(...binCounts)
            const isHovered = hoveredBin === i
            const tipW = 80
            const tipX = Math.min(Math.max(x + BAR_W / 2 - tipW / 2, PAD_L), svgW - PAD_R - tipW)
            return (
              <g key={i}>
                {count > 0 ? (
                  <rect x={x} y={y} width={BAR_W} height={barH} rx={2.5}
                    fill={isPeak ? '#1B2A4A' : isHovered ? '#3b82f6' : '#93c5fd'}
                    style={{ transition: 'fill 0.15s' }}
                    onMouseEnter={() => setHoveredBin(i)} onMouseLeave={() => setHoveredBin(null)}
                    className="cursor-default" />
                ) : (
                  <rect x={x} y={PAD_T + CHART_H - 1} width={BAR_W} height={1} rx={1} fill="#f3f4f6" />
                )}
                <text x={x + BAR_W / 2} y={PAD_T + CHART_H + 14} textAnchor="middle" fontSize={8} fill="#9ca3af">
                  {fmt((i + 1) * binSize)}
                </text>
                {isHovered && count > 0 && (
                  <g>
                    <rect x={tipX} y={y - 22} width={tipW} height={17} rx={3} fill="#111827" />
                    <text x={tipX + tipW / 2} y={y - 10} textAnchor="middle" fontSize={9} fill="white">
                      〜{fmt((i + 1) * binSize)}: {count}人
                    </text>
                  </g>
                )}
              </g>
            )
          })}
        </svg>
      </div>
      {maxDur > 0 && (
        <p className="text-xs text-gray-400 mt-1">動画尺 {fmt(maxDur)} を {BINS} 分割</p>
      )}
    </div>
  )
}

// ─── アンケート回答モーダル ───
function SurveyResponseModal({ studentId, videoId, studentName, onClose }: {
  studentId: string; videoId: string; studentName: string; onClose: () => void
}) {
  const [responses, setResponses] = useState<{ question_text: string; selected_choice: string; trigger_sec: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      // まずjoinで取得を試みる
      const { data, error } = await supabase
        .from('survey_responses')
        .select('selected_choice, question_id, question:survey_questions(question_text, trigger_sec)')
        .eq('student_id', studentId)
        .eq('video_id', videoId)

      if (!error && data && data.length > 0) {
        const rows = data.map((r: any) => ({
          question_text: r.question?.question_text || '',
          selected_choice: r.selected_choice,
          trigger_sec: r.question?.trigger_sec ?? 0,
        })).sort((a: any, b: any) => a.trigger_sec - b.trigger_sec)
        setResponses(rows)
        setLoading(false)
        return
      }

      // joinが失敗した場合のフォールバック: 個別に取得
      const { data: resData } = await supabase
        .from('survey_responses')
        .select('selected_choice, question_id')
        .eq('student_id', studentId)
        .eq('video_id', videoId)

      if (!resData || resData.length === 0) { setLoading(false); return }

      const qIds = resData.map((r: any) => r.question_id)
      const { data: qData } = await supabase
        .from('survey_questions')
        .select('id, question_text, trigger_sec')
        .in('id', qIds)

      const qMap = new Map((qData || []).map((q: any) => [q.id, q]))
      const rows = resData.map((r: any) => {
        const q = qMap.get(r.question_id)
        return {
          question_text: q?.question_text || '',
          selected_choice: r.selected_choice,
          trigger_sec: q?.trigger_sec ?? 0,
        }
      }).sort((a, b) => a.trigger_sec - b.trigger_sec)
      setResponses(rows)
      setLoading(false)
    }
    fetchData()
  }, [studentId, videoId])

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md space-y-4 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 text-sm">{studentName} のアンケート回答</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <XCircle className="h-5 w-5" />
          </button>
        </div>
        {loading ? (
          <p className="text-gray-400 text-sm text-center py-6">読み込み中...</p>
        ) : responses.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-6">回答はありません</p>
        ) : (
          <div className="space-y-3">
            {responses.map((r, i) => (
              <div key={i} className="border rounded-xl p-4 space-y-1.5">
                <div className="text-xs text-gray-400">{fmt(r.trigger_sec)} 時点</div>
                <div className="text-sm font-medium text-gray-700">{r.question_text}</div>
                <div className="text-sm font-semibold text-[#1B2A4A]">→ {r.selected_choice}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 視聴ログ ───
type SessionEntry = {
  student_name: string; student_email: string; video_title: string;
  first_at: number; last_at: number; ended: boolean; last_position: number;
  device_type: string; video_duration_sec: number;
  student_id: string; video_id: string;
}

type Preset = '今日' | '今週' | '今月' | '全期間' | 'カスタム'

function getPresetRange(preset: Preset): { from: string; to: string } {
  const now = new Date()
  const toStr = now.toISOString().slice(0, 10)
  if (preset === '今日') return { from: toStr, to: toStr }
  if (preset === '今週') {
    const d = new Date(now)
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7)) // Monday
    return { from: d.toISOString().slice(0, 10), to: toStr }
  }
  if (preset === '今月') {
    return { from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, to: toStr }
  }
  return { from: '', to: '' }
}

function LogsTab({ companyId }: { companyId: string }) {
  const [allSessions, setAllSessions] = useState<SessionEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [preset, setPreset] = useState<Preset>('全期間')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [view, setView] = useState<'logs' | 'analytics'>('logs')
  const [selectedLog, setSelectedLog] = useState<{ studentId: string; videoId: string; studentName: string } | null>(null)

  const fetchLogs = useCallback(async () => {
    const { data: events } = await supabase
      .from('watch_events')
      .select('*, student:students(name, email), video:briefing_videos(title, duration_sec)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (!events) { setLoading(false); return }

    const sessions: Record<string, SessionEntry> = {}
    events.forEach((e: any) => {
      const sid = e.session_id || e.id
      const t = new Date(e.created_at).getTime()
      if (!sessions[sid]) {
        sessions[sid] = {
          student_name: e.student?.name || '不明',
          student_email: e.student?.email || '',
          video_title: e.video?.title || '不明',
          first_at: t, last_at: t, ended: false, last_position: e.position_sec || 0,
          device_type: e.device_type || '',
          video_duration_sec: e.video?.duration_sec || 0,
          student_id: e.student_id,
          video_id: e.video_id,
        }
      }
      if (t < sessions[sid].first_at) {
        sessions[sid].first_at = t
        if (e.device_type) sessions[sid].device_type = e.device_type
      }
      if (t > sessions[sid].last_at) {
        sessions[sid].last_at = t
        sessions[sid].last_position = e.position_sec || sessions[sid].last_position
      }
      if (e.event_type === 'ended') sessions[sid].ended = true
    })

    setAllSessions(Object.values(sessions))
    setLoading(false)
  }, [companyId])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  // リアルタイム購読: 新しいwatch_eventが入ったら自動更新
  useEffect(() => {
    const channel = supabase.channel('watch-events-realtime')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'watch_events',
        filter: `company_id=eq.${companyId}`,
      }, () => { fetchLogs() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [companyId, fetchLogs])

  // フィルター適用
  const { from: presetFrom, to: presetTo } = getPresetRange(preset)
  const fromStr = preset === 'カスタム' ? customFrom : presetFrom
  const toStr   = preset === 'カスタム' ? customTo   : presetTo

  const filtered = allSessions.filter((s) => {
    const d = new Date(s.first_at)
    const dStr = d.toISOString().slice(0, 10)
    if (fromStr && dStr < fromStr) return false
    if (toStr   && dStr > toStr)   return false
    return true
  })

  const hourlyCounts = Array(24).fill(0)
  filtered.forEach((s) => { hourlyCounts[new Date(s.first_at).getHours()]++ })

  const watchSecs = filtered.map(s => {
    const timeDiff = Math.floor((s.last_at - s.first_at) / 1000)
    return s.last_position > 0 ? Math.round(s.last_position) : timeDiff
  })
  const videoDuration = filtered.reduce((max, s) => Math.max(max, s.video_duration_sec), 0)

  const logs = filtered
    .map((s) => {
      const timeDiffSec = Math.floor((s.last_at - s.first_at) / 1000)
      const watchSec = s.last_position > 0 ? Math.round(s.last_position) : timeDiffSec
      return {
        student_name: s.student_name,
        student_email: s.student_email,
        student_id: s.student_id,
        video_id: s.video_id,
        played_at: new Date(s.first_at).toISOString(),
        watch_sec: watchSec,
        device_type: s.device_type,
        completed: s.ended,
      }
    })
    .sort((a, b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime())

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

  if (loading) return <p className="text-gray-400 text-center py-8">読み込み中...</p>

  const presets: Preset[] = ['今日', '今週', '今月', '全期間', 'カスタム']

  return (
    <div className="space-y-6">
      {/* ビュー切り替え＋期間フィルター */}
      <div className="bg-white rounded-xl border p-4 flex flex-wrap items-center gap-4">
        {/* ログ / 分析 切り替え */}
        <div className="flex rounded-lg border overflow-hidden shrink-0">
          <button
            onClick={() => setView('logs')}
            className={`px-4 py-1.5 text-xs font-medium transition-colors ${view === 'logs' ? 'bg-[#1B2A4A] text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            ログ
          </button>
          <button
            onClick={() => setView('analytics')}
            className={`px-4 py-1.5 text-xs font-medium transition-colors ${view === 'analytics' ? 'bg-[#1B2A4A] text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            分析
          </button>
        </div>

        <div className="w-px h-5 bg-gray-200 shrink-0" />

        {/* 期間フィルター */}
        <span className="text-xs font-medium text-gray-500 shrink-0">期間</span>
        <div className="flex gap-1.5 flex-wrap">
          {presets.map((p) => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                preset === p ? 'bg-[#1B2A4A] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        {preset === 'カスタム' && (
          <div className="flex items-center gap-2">
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
              className="border rounded px-2 py-1 text-xs text-gray-700" />
            <span className="text-gray-400 text-xs">〜</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
              className="border rounded px-2 py-1 text-xs text-gray-700" />
          </div>
        )}
      </div>

      {/* 分析ビュー */}
      {view === 'analytics' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <DevicePieChart sessions={filtered} />
            <WatchDurationChart watchSecs={watchSecs} videoDuration={videoDuration} />
          </div>
          <HourlyChart hourlyCounts={hourlyCounts} />
        </div>
      )}

      {/* ログビュー */}
      {view === 'logs' && (
        logs.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Play className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p>該当する視聴ログがありません</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">学生</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">視聴日時</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">視聴時間</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">視聴端末</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">完了</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((log, i) => {
                  const deviceLabel =
                    log.device_type === 'iPad'  ? { icon: <Tablet     className="h-3.5 w-3.5" />, label: 'iPad'  } :
                    log.device_type === 'スマホ' ? { icon: <Smartphone className="h-3.5 w-3.5" />, label: 'スマホ' } :
                    log.device_type === 'PC'    ? { icon: <Monitor    className="h-3.5 w-3.5" />, label: 'PC'    } :
                    null
                  return (
                    <tr key={i}
                      className="hover:bg-blue-50 cursor-pointer transition-colors"
                      onClick={() => setSelectedLog({ studentId: log.student_id, videoId: log.video_id, studentName: log.student_name })}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium">{log.student_name}</div>
                        <div className="text-xs text-gray-400">{log.student_email}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{new Date(log.played_at).toLocaleString('ja-JP')}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatTime(log.watch_sec)}</span>
                      </td>
                      <td className="px-4 py-3">
                        {deviceLabel ? (
                          <span className="inline-flex items-center gap-1.5 text-gray-600">
                            {deviceLabel.icon}{deviceLabel.label}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {log.completed ? (
                          <span className="inline-flex items-center gap-1 text-green-600"><CheckCircle2 className="h-4 w-4" /> 完了</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-gray-400"><XCircle className="h-4 w-4" /> 途中</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {selectedLog && (
        <SurveyResponseModal
          studentId={selectedLog.studentId}
          videoId={selectedLog.videoId}
          studentName={selectedLog.studentName}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </div>
  )
}

// ─── メインダッシュボード ───
export function AdminDashboard() {
  const { adminUser, signOut } = useAuth()
  const [tab, setTab] = useState<Tab>('videos')

  if (!adminUser) return null
  const companyId = adminUser.company_id
  const companyName = adminUser.company?.name || ''

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'videos', label: '動画管理', icon: <Video className="h-4 w-4" /> },
    { key: 'students', label: '学生管理', icon: <Users className="h-4 w-4" /> },
    { key: 'surveys', label: 'アンケート', icon: <ClipboardList className="h-4 w-4" /> },
    { key: 'logs', label: '視聴ログ', icon: <BarChart3 className="h-4 w-4" /> },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Video className="h-6 w-6 text-[#1B2A4A]" />
            <div>
              <h1 className="font-bold text-[#1B2A4A] text-lg">説明会動画配信</h1>
              <p className="text-xs text-gray-400">{companyName}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-400">{adminUser.email}</span>
            <button onClick={signOut} className="text-gray-400 hover:text-gray-600 flex items-center gap-1 text-sm">
              <LogOut className="h-4 w-4" /> ログアウト
            </button>
          </div>
        </div>
      </header>

      {/* タブ */}
      <div className="max-w-6xl mx-auto px-6 pt-6">
        <div className="flex gap-1 border-b">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-[#1B2A4A] text-[#1B2A4A]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* コンテンツ */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        {tab === 'videos' && <VideosTab companyId={companyId} />}
        {tab === 'students' && <StudentsTab companyId={companyId} />}
        {tab === 'surveys' && <SurveysTab companyId={companyId} />}
        {tab === 'logs' && <LogsTab companyId={companyId} />}
      </div>
    </div>
  )
}
