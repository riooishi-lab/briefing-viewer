import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import type { BriefingVideo, Student, SurveyQuestion, SurveyResponse, SurveySet, VideoChapter } from '../lib/supabase'
import { toast } from 'sonner'
import {
  Video, Users, BarChart3, ClipboardList, LogOut, Plus, Trash2,
  Copy, Link, Clock, CheckCircle2, XCircle, Play, Upload, Download, Loader2,
  Monitor, Smartphone, Tablet, Layers, Menu, X, Image
} from 'lucide-react'

type Tab = 'videos' | 'students' | 'chapters' | 'surveys' | 'logs'

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

  const hasVideo = videos.length > 0

  return (
    <div className="space-y-6">
      {hasVideo ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          動画は1本のみ登録できます。新しい動画を追加するには、既存の動画を削除してください。
        </div>
      ) : (
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
      )}

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

    // 視聴有無: play イベントのみに絞る（1セッション1件、行数上限に達しにくい）
    const { data: playEvents, error } = await supabase
      .from('watch_events')
      .select('student_id')
      .eq('company_id', companyId)
      .eq('event_type', 'play')
    if (error) console.error('[StudentsTab] watch_events query failed:', error.message)
    const watchedSet = new Set((playEvents || []).map((e: { student_id: string }) => e.student_id))

    setStudents(studentList.map((s: Student) => ({ ...s, watched: watchedSet.has(s.id) })))
    setLoading(false)
  }, [companyId])

  useEffect(() => { fetchStudents() }, [fetchStudents])

  // 視聴イベント追加時に自動更新
  useEffect(() => {
    const channel = supabase.channel('students-watch-status')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'watch_events',
        filter: `company_id=eq.${companyId}`,
      }, () => { fetchStudents() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [companyId, fetchStudents])

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

// ─── パート設定 ───
function ChaptersTab({ companyId }: { companyId: string }) {
  const [videos, setVideos] = useState<BriefingVideo[]>([])
  const [chapters, setChapters] = useState<VideoChapter[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null)
  const [chLabel, setChLabel] = useState('')
  const [chStartSec, setChStartSec] = useState('')
  const [uploading, setUploading] = useState<string | null>(null) // chapter id being uploaded

  const selectedVideo = videos.find(v => v.id === selectedVideoId) || null
  const displayMode = selectedVideo?.chapter_display_mode || 'text'
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  const fetchAll = useCallback(async () => {
    const { data: vData } = await supabase.from('briefing_videos').select('*').eq('company_id', companyId).order('created_at', { ascending: false })
    setVideos(vData || [])
    if (vData && vData.length > 0) setSelectedVideoId(prev => prev ?? vData[0].id)
    setLoading(false)
  }, [companyId])
  useEffect(() => { fetchAll() }, [fetchAll])

  const fetchChapters = useCallback(async () => {
    if (!selectedVideoId) return
    const { data } = await supabase.from('video_chapters').select('*').eq('video_id', selectedVideoId).order('sort_order')
    setChapters(data || [])
  }, [selectedVideoId])
  useEffect(() => { fetchChapters() }, [fetchChapters])

  const addChapter = async () => {
    if (!chLabel || !selectedVideoId) return
    const { error } = await supabase.from('video_chapters').insert({
      video_id: selectedVideoId, label: chLabel, start_sec: Number(chStartSec) || 0,
      sort_order: chapters.length, company_id: companyId,
    })
    if (error) { toast.error('追加に失敗しました'); return }
    setChLabel(''); setChStartSec('')
    toast.success('パートを追加しました')
    fetchChapters()
  }

  const deleteChapter = async (id: string) => {
    if (!confirm('このパートを削除しますか？紐付いた設問は「全体」に戻ります。')) return
    await supabase.from('video_chapters').delete().eq('id', id)
    toast.success('削除しました')
    fetchChapters()
  }

  const updateDisplayMode = async (mode: 'none' | 'text' | 'image') => {
    if (!selectedVideoId) return
    await supabase.from('briefing_videos').update({ chapter_display_mode: mode }).eq('id', selectedVideoId)
    setVideos(prev => prev.map(v => v.id === selectedVideoId ? { ...v, chapter_display_mode: mode } : v))
  }

  const updateSurveyMode = async (mode: 'all' | 'chapter_only') => {
    if (!selectedVideoId) return
    await supabase.from('briefing_videos').update({ chapter_survey_mode: mode }).eq('id', selectedVideoId)
    setVideos(prev => prev.map(v => v.id === selectedVideoId ? { ...v, chapter_survey_mode: mode } : v))
  }

  const uploadThumbnail = async (chapterId: string, file: File) => {
    setUploading(chapterId)
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${companyId}/chapters/${chapterId}.${ext}`
    const { error: upErr } = await supabase.storage.from('videos').upload(path, file, { contentType: file.type, upsert: true })
    if (upErr) { toast.error('アップロード失敗'); setUploading(null); return }
    const { data: urlData } = supabase.storage.from('videos').getPublicUrl(path)
    await supabase.from('video_chapters').update({ thumbnail_url: urlData.publicUrl }).eq('id', chapterId)
    toast.success('サムネイルを設定しました')
    setUploading(null)
    fetchChapters()
  }

  if (loading) return <p className="text-gray-400 text-center py-8">読み込み中...</p>

  return (
    <div className="space-y-6">
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
          {/* 表示モード */}
          <div className="bg-white rounded-xl border p-6 space-y-4">
            <h3 className="font-bold text-gray-800">視聴画面の表示モード</h3>
            <div className="grid grid-cols-3 gap-3">
              {([
                { key: 'none' as const, label: '設定なし', desc: '最初から再生のみ' },
                { key: 'text' as const, label: 'テキスト', desc: '文字でパート選択' },
                { key: 'image' as const, label: '画像', desc: 'サムネイルで選択' },
              ]).map(m => (
                <button key={m.key} onClick={() => updateDisplayMode(m.key)}
                  className={`p-4 rounded-xl border-2 text-left transition-colors ${displayMode === m.key ? 'border-[#1B2A4A] bg-[#1B2A4A]/5' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className="text-sm font-medium">{m.label}</div>
                  <div className="text-xs text-gray-400 mt-1">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* パート追加・一覧（none以外） */}
          {displayMode !== 'none' && (
            <div className="bg-white rounded-xl border p-6 space-y-4">
              <h3 className="font-bold text-gray-800">パート（チャプター）設定</h3>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="text-xs text-gray-500">ラベル</label>
                  <input placeholder="例: 会社概要" value={chLabel} onChange={e => setChLabel(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]" />
                </div>
                <div className="w-32">
                  <label className="text-xs text-gray-500">開始秒</label>
                  <input type="number" value={chStartSec} onChange={e => setChStartSec(e.target.value)}
                    placeholder="0" className="w-full px-3 py-2 border rounded-lg text-sm" min={0} />
                </div>
                <button onClick={addChapter} disabled={!chLabel}
                  className="px-4 py-2 bg-[#1B2A4A] text-white rounded-lg text-sm font-medium hover:bg-[#0F1D35] disabled:opacity-40 shrink-0">
                  追加
                </button>
              </div>

              {chapters.length > 0 && (
                <div className="space-y-2">
                  {chapters.map((ch, i) => (
                    <div key={ch.id} className="flex items-center gap-3 px-3 py-3 bg-gray-50 rounded-lg">
                      {/* サムネイル */}
                      <div className="w-24 h-14 rounded-lg overflow-hidden bg-gray-200 shrink-0 relative group">
                        {ch.thumbnail_url ? (
                          <img src={ch.thumbnail_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                            <Image className="h-5 w-5" />
                          </div>
                        )}
                        <label className={`absolute inset-0 cursor-pointer flex items-center justify-center transition-opacity ${
                          ch.thumbnail_url ? 'opacity-0 group-hover:opacity-100 bg-black/50' : 'opacity-100 hover:bg-gray-300'
                        }`}>
                          <span className="text-xs font-medium text-white bg-[#1B2A4A]/80 px-2 py-1 rounded">
                            {uploading === ch.id ? '...' : ch.thumbnail_url ? '変更' : '画像を選択'}
                          </span>
                          <input type="file" accept="image/*" className="hidden"
                            onChange={e => { if (e.target.files?.[0]) uploadThumbnail(ch.id, e.target.files[0]) }} />
                        </label>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">
                          <span className="text-gray-400 mr-1">{i + 1}.</span>
                          {ch.label}
                        </div>
                        <div className="text-xs text-gray-400">{fmt(ch.start_sec)}〜</div>
                      </div>
                      <button onClick={() => deleteChapter(ch.id)} className="text-red-400 hover:text-red-600 shrink-0">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {chapters.length > 0 && (
                <div className="border-t pt-4">
                  <label className="text-xs text-gray-500 block mb-2">「最初から見る」を選んだ時のアンケート表示</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" name="surveyMode" checked={selectedVideo?.chapter_survey_mode !== 'chapter_only'}
                        onChange={() => updateSurveyMode('all')} className="accent-[#1B2A4A]" />
                      すべて表示
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="radio" name="surveyMode" checked={selectedVideo?.chapter_survey_mode === 'chapter_only'}
                        onChange={() => updateSurveyMode('chapter_only')} className="accent-[#1B2A4A]" />
                      パート紐付け分のみ
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── アンケート管理（セット単位） ───
function SurveysTab({ companyId }: { companyId: string }) {
  const [videos, setVideos] = useState<BriefingVideo[]>([])
  const [sets, setSets] = useState<SurveySet[]>([])
  const [questions, setQuestions] = useState<SurveyQuestion[]>([])
  const [responses, setResponses] = useState<(SurveyResponse & { student?: Student })[]>([])
  const [chapters, setChapters] = useState<VideoChapter[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null)
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null)

  // 新規セットフォーム
  const [newSetName, setNewSetName] = useState('')
  const [copyFromSetId, setCopyFromSetId] = useState<string>('')

  // 新規設問フォーム
  const [triggerSec, setTriggerSec] = useState('')
  const [qText, setQText] = useState('')
  const [choices, setChoices] = useState(['', '', '', ''])
  const [qChapterId, setQChapterId] = useState<string>('')

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  const selectedSet = sets.find(s => s.id === selectedSetId) || null

  const fetchAll = useCallback(async () => {
    const { data: vData } = await supabase.from('briefing_videos').select('*').eq('company_id', companyId).order('created_at', { ascending: false })
    setVideos(vData || [])
    if (vData && vData.length > 0) setSelectedVideoId(prev => prev ?? vData[0].id)
    setLoading(false)
  }, [companyId])
  useEffect(() => { fetchAll() }, [fetchAll])

  const fetchVideoData = useCallback(async () => {
    if (!selectedVideoId) return
    const { data: sData } = await supabase.from('survey_sets').select('*').eq('video_id', selectedVideoId).order('created_at', { ascending: false })
    setSets(sData || [])
    const active = (sData || []).find((s: SurveySet) => s.is_active)
    setSelectedSetId(prev => {
      if (prev && (sData || []).some((s: SurveySet) => s.id === prev)) return prev
      return active?.id || (sData && sData[0]?.id) || null
    })
    const { data: chData } = await supabase.from('video_chapters').select('*').eq('video_id', selectedVideoId).order('sort_order')
    setChapters(chData || [])
  }, [selectedVideoId])
  useEffect(() => { fetchVideoData() }, [fetchVideoData])

  // セット選択時に設問・回答を取得
  useEffect(() => {
    if (!selectedSetId) { setQuestions([]); setResponses([]); return }
    const fetch = async () => {
      const { data: qData } = await supabase.from('survey_questions').select('*').eq('survey_set_id', selectedSetId).order('trigger_sec')
      setQuestions(qData || [])
      const { data: rData } = await supabase.from('survey_responses').select('*, student:students(name, email)').eq('survey_set_id', selectedSetId)
      setResponses(rData || [])
    }
    fetch()
  }, [selectedSetId])

  // ─── セット CRUD ───
  const createSet = async () => {
    if (!newSetName || !selectedVideoId) return
    // 新規セット作成
    const { data: newSet, error } = await supabase.from('survey_sets').insert({
      video_id: selectedVideoId, name: newSetName, is_active: false, company_id: companyId,
    }).select().single()
    if (error || !newSet) { toast.error('作成に失敗しました'); return }

    // コピー元が指定されている場合、設問をコピー
    if (copyFromSetId) {
      const { data: srcQuestions } = await supabase.from('survey_questions').select('*').eq('survey_set_id', copyFromSetId)
      if (srcQuestions && srcQuestions.length > 0) {
        const copies = srcQuestions.map((q: any) => ({
          video_id: selectedVideoId, trigger_sec: q.trigger_sec, question_text: q.question_text,
          choices: q.choices, chapter_id: q.chapter_id, company_id: q.company_id,
          survey_set_id: newSet.id,
        }))
        await supabase.from('survey_questions').insert(copies)
      }
    }

    setNewSetName(''); setCopyFromSetId('')
    toast.success(copyFromSetId ? 'コピーして作成しました' : '作成しました')
    fetchVideoData()
    setSelectedSetId(newSet.id)
  }

  const activateSet = async (setId: string) => {
    if (!selectedVideoId) return
    // 同じ動画の他セットを無効化
    await supabase.from('survey_sets').update({ is_active: false }).eq('video_id', selectedVideoId)
    await supabase.from('survey_sets').update({ is_active: true }).eq('id', setId)
    toast.success('有効化しました')
    fetchVideoData()
  }

  const deleteSet = async (setId: string) => {
    const target = sets.find(s => s.id === setId)
    if (!target) return
    if (target.is_active) { toast.error('有効なセットは削除できません。先に別のセットを有効化してください。'); return }
    if (!confirm(`「${target.name}」を削除しますか？設問と回答も全て削除されます。`)) return
    await supabase.from('survey_sets').delete().eq('id', setId)
    toast.success('削除しました')
    if (selectedSetId === setId) setSelectedSetId(null)
    fetchVideoData()
  }

  // ─── 設問 CRUD（選択中セットに追加） ───
  const addQuestion = async () => {
    if (!qText || !selectedSetId || !selectedVideoId) return
    if (selectedSet?.is_active) { toast.error('有効なセットには設問を追加できません。コピーして新しいセットを作成してください。'); return }
    const validChoices = choices.filter((c) => c.trim())
    if (validChoices.length < 2) { toast.error('選択肢を2つ以上入力してください'); return }
    const inputSec = Number(triggerSec) || 0
    const linkedChapter = chapters.find(ch => ch.id === qChapterId)
    const actualTriggerSec = linkedChapter ? linkedChapter.start_sec + inputSec : inputSec
    const { error } = await supabase.from('survey_questions').insert({
      video_id: selectedVideoId, trigger_sec: actualTriggerSec, question_text: qText,
      choices: validChoices, company_id: companyId,
      chapter_id: qChapterId || null, survey_set_id: selectedSetId,
    })
    if (error) { toast.error('追加に失敗しました'); return }
    setQText(''); setChoices(['', '', '', '']); setTriggerSec(''); setQChapterId('')
    toast.success('設問を追加しました')
    // リフレッシュ
    const { data: qData } = await supabase.from('survey_questions').select('*').eq('survey_set_id', selectedSetId).order('trigger_sec')
    setQuestions(qData || [])
  }

  const deleteQuestion = async (id: string) => {
    if (selectedSet?.is_active) { toast.error('有効なセットの設問は削除できません。'); return }
    if (!confirm('この設問を削除しますか？')) return
    await supabase.from('survey_questions').delete().eq('id', id)
    toast.success('削除しました')
    setQuestions((prev) => prev.filter((q) => q.id !== id))
  }

  if (loading) return <p className="text-gray-400 text-center py-8">読み込み中...</p>

  const isEditable = selectedSet && !selectedSet.is_active

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
          {/* ─── セット作成 ─── */}
          <div className="bg-white rounded-xl border p-6 space-y-4">
            <h3 className="font-bold text-gray-800">アンケートを作成</h3>
            <div className="flex gap-2 items-end flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs text-gray-500">アンケート名</label>
                <input placeholder="例: 説明会アンケート v2" value={newSetName} onChange={e => setNewSetName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B2A4A]" />
              </div>
              <div className="w-48">
                <label className="text-xs text-gray-500">作成方法</label>
                <select value={copyFromSetId} onChange={e => setCopyFromSetId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                  <option value="">新規作成</option>
                  {sets.map(s => (
                    <option key={s.id} value={s.id}>{s.name} からコピー</option>
                  ))}
                </select>
              </div>
              <button onClick={createSet} disabled={!newSetName}
                className="px-4 py-2 bg-[#1B2A4A] text-white rounded-lg text-sm font-medium hover:bg-[#0F1D35] disabled:opacity-40 shrink-0">
                作成
              </button>
            </div>
          </div>

          {/* ─── セット一覧 ─── */}
          {sets.length > 0 && (
            <div className="bg-white rounded-xl border p-6 space-y-3">
              <h3 className="font-bold text-gray-800">アンケート一覧</h3>
              <div className="space-y-2">
                {sets.map(s => (
                  <div key={s.id}
                    onClick={() => setSelectedSetId(s.id)}
                    className={`flex items-center justify-between px-4 py-3 rounded-lg cursor-pointer transition-colors ${selectedSetId === s.id ? 'bg-[#1B2A4A]/5 border border-[#1B2A4A]/20' : 'bg-gray-50 hover:bg-gray-100'}`}>
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-sm">{s.name}</span>
                      {s.is_active ? (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">有効</span>
                      ) : (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">下書き</span>
                      )}
                      <span className="text-xs text-gray-400">{new Date(s.created_at).toLocaleDateString('ja-JP')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {!s.is_active && (
                        <button onClick={(e) => { e.stopPropagation(); activateSet(s.id) }}
                          className="text-xs px-3 py-1 bg-green-600 text-white rounded-full hover:bg-green-700">
                          有効化
                        </button>
                      )}
                      {!s.is_active && (
                        <button onClick={(e) => { e.stopPropagation(); deleteSet(s.id) }}
                          className="text-red-400 hover:text-red-600">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── 選択中セットの設問 ─── */}
          {selectedSet && (
            <>
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-gray-800">{selectedSet.name} の設問</h3>
                {selectedSet.is_active && (
                  <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">有効セットは変更不可（コピーして新規作成してください）</span>
                )}
              </div>

              {/* 設問追加（下書きセットのみ） */}
              {isEditable && (
                <div className="bg-white rounded-xl border p-6 space-y-4">
                  <h3 className="font-bold text-gray-800 text-sm">設問を追加</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="text-xs text-gray-500">パート</label>
                      <select value={qChapterId} onChange={e => setQChapterId(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                        <option value="">指定なし（最初から見る）</option>
                        {chapters.map(ch => (
                          <option key={ch.id} value={ch.id}>{ch.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">{qChapterId ? 'パート開始から何秒後' : '動画開始から何秒後'}</label>
                      <input type="number" value={triggerSec} onChange={(e) => setTriggerSec(e.target.value)}
                        placeholder="60" className="w-full px-3 py-2 border rounded-lg text-sm" min={0} />
                    </div>
                    <div className="md:col-span-2">
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
              )}

              {/* 設問一覧 */}
              {questions.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <p>このセットにはまだ設問がありません</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {questions.map((q) => {
                    const qResponses = responses.filter((r) => r.question_id === q.id)
                    const choiceCounts: Record<string, number> = {}
                    ;(q.choices as string[]).forEach((c) => (choiceCounts[c] = 0))
                    qResponses.forEach((r) => (choiceCounts[r.selected_choice] = (choiceCounts[r.selected_choice] || 0) + 1))
                    const total = qResponses.length
                    const linkedChapter = chapters.find(ch => ch.id === q.chapter_id)
                    const relativeSec = linkedChapter ? Math.max(0, q.trigger_sec - linkedChapter.start_sec) : q.trigger_sec

                    return (
                      <div key={q.id} className="bg-white rounded-xl border p-5 space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {linkedChapter ? (
                                <>
                                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                                    {linkedChapter.label}
                                  </span>
                                  <span className="text-xs bg-[#1B2A4A]/10 text-[#1B2A4A] px-2 py-0.5 rounded-full font-medium">
                                    開始から {fmt(relativeSec)} 後
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                                    最初から見る
                                  </span>
                                  <span className="text-xs bg-[#1B2A4A]/10 text-[#1B2A4A] px-2 py-0.5 rounded-full font-medium">
                                    {fmt(q.trigger_sec)} 後に表示
                                  </span>
                                </>
                              )}
                            </div>
                            <p className="font-bold text-gray-800 mt-2">{q.question_text}</p>
                          </div>
                          {isEditable && (
                            <button onClick={() => deleteQuestion(q.id)} className="text-red-400 hover:text-red-600 shrink-0">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
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
    { key: 'タブレット', label: 'タブレット', color: '#93c5fd' },
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
  has_response: boolean; survey_set_name: string;
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
  const [setNames, setSetNames] = useState<string[]>([])
  const [filterSetName, setFilterSetName] = useState<string>('')

  const fetchLogs = useCallback(async () => {
    const [{ data: events, error }, { data: respData }, { data: setsData }] = await Promise.all([
      supabase.from('watch_events')
        .select('*, student:students(name, email), video:briefing_videos(title, duration_sec)')
        .eq('company_id', companyId).order('created_at', { ascending: false }).limit(10000),
      supabase.from('survey_responses').select('student_id, video_id, survey_set_id').eq('company_id', companyId),
      supabase.from('survey_sets').select('id, name').eq('company_id', companyId),
    ])
    if (error) console.error('[LogsTab] fetch failed:', error.message)
    if (!events) { setLoading(false); return }

    // 学生×動画: 回答有無を判定
    const respHasMap: Record<string, boolean> = {}
    const respSetMap: Record<string, string> = {} // 学生×動画 → survey_set_id
    ;(respData || []).forEach((r: any) => {
      const key = `${r.student_id}_${r.video_id}`
      respHasMap[key] = true
      if (r.survey_set_id) respSetMap[key] = r.survey_set_id
    })
    // セットID → 名前
    const setNameMap: Record<string, string> = {}
    ;(setsData || []).forEach((s: any) => { setNameMap[s.id] = s.name })

    const sessions: Record<string, SessionEntry> = {}
    events.forEach((e: any) => {
      const sid = e.session_id || e.id
      const t = new Date(e.created_at).getTime()
      if (!sessions[sid]) {
        const rKey = `${e.student_id}_${e.video_id}`
        const setId = respSetMap[rKey]
        sessions[sid] = {
          student_name: e.student?.name || '不明',
          student_email: e.student?.email || '',
          video_title: e.video?.title || '不明',
          first_at: t, last_at: t, ended: false, last_position: e.position_sec || 0,
          device_type: e.device_type || '',
          video_duration_sec: e.video?.duration_sec || 0,
          student_id: e.student_id,
          video_id: e.video_id,
          has_response: !!respHasMap[rKey],
          survey_set_name: setId ? (setNameMap[setId] || '') : '',
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

    const sessionList = Object.values(sessions)
    setAllSessions(sessionList)
    const names = [...new Set(sessionList.map(s => s.survey_set_name).filter(Boolean))]
    setSetNames(names)
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
    if (filterSetName && s.survey_set_name !== filterSetName) return false
    return true
  })

  const hourlyCounts = Array(24).fill(0)
  filtered.forEach((s) => { hourlyCounts[new Date(s.first_at).getHours()]++ })

  const watchSecs = filtered.map(s => Math.floor((s.last_at - s.first_at) / 1000))
  const videoDuration = filtered.reduce((max, s) => Math.max(max, s.video_duration_sec), 0)

  const logs = filtered
    .map((s) => {
      const watchSec = Math.floor((s.last_at - s.first_at) / 1000)
      return {
        student_name: s.student_name,
        student_email: s.student_email,
        student_id: s.student_id,
        video_id: s.video_id,
        played_at: new Date(s.first_at).toISOString(),
        watch_sec: watchSec,
        device_type: s.device_type,
        completed: s.video_duration_sec > 0 ? s.last_position >= s.video_duration_sec * 0.9 : s.ended,
        has_response: s.has_response,
        survey_set_name: s.survey_set_name,
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

        {/* アンケートセットフィルタ */}
        {setNames.length > 0 && (
          <>
            <div className="w-px h-5 bg-gray-200 shrink-0" />
            <span className="text-xs font-medium text-gray-500 shrink-0">アンケート</span>
            <select value={filterSetName} onChange={e => setFilterSetName(e.target.value)}
              className="px-2 py-1 border rounded text-xs text-gray-700 bg-white">
              <option value="">すべて</option>
              {setNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </>
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
                  <th className="text-left px-4 py-3 font-medium text-gray-600">アンケート</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">視聴日時</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">視聴時間</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">視聴端末</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">回答</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">完了</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.map((log, i) => {
                  const deviceLabel =
                    log.device_type === 'タブレット' ? { icon: <Tablet     className="h-3.5 w-3.5" />, label: 'タブレット' } :
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
                      <td className="px-4 py-3">
                        {log.survey_set_name ? (
                          <span className="text-xs text-gray-600">{log.survey_set_name}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
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
                        {log.has_response ? (
                          <span className="text-xs font-medium text-green-600">回答</span>
                        ) : (
                          <span className="text-xs font-medium text-gray-400">未回答</span>
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
const validTabs: Tab[] = ['videos', 'students', 'chapters', 'surveys', 'logs']
function getInitialTab(): Tab {
  const hash = window.location.hash.replace('#', '') as Tab
  return validTabs.includes(hash) ? hash : 'videos'
}

export function AdminDashboard() {
  const { adminUser, signOut } = useAuth()
  const [tab, setTabState] = useState<Tab>(getInitialTab)
  const setTab = (t: Tab) => { setTabState(t); window.location.hash = t }

  const [sidebarOpen, setSidebarOpen] = useState(false)

  if (!adminUser) return null
  const companyId = adminUser.company_id
  const companyName = adminUser.company?.name || ''

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'videos', label: '動画管理', icon: <Video className="h-5 w-5" /> },
    { key: 'students', label: '学生管理', icon: <Users className="h-5 w-5" /> },
    { key: 'chapters', label: 'パート設定', icon: <Layers className="h-5 w-5" /> },
    { key: 'surveys', label: 'アンケート', icon: <ClipboardList className="h-5 w-5" /> },
    { key: 'logs', label: '視聴ログ', icon: <BarChart3 className="h-5 w-5" /> },
  ]

  const handleTabClick = (t: Tab) => { setTab(t); setSidebarOpen(false) }

  return (
    <div className="min-h-screen bg-gray-100 md:flex">
      {/* モバイルヘッダー */}
      <div className="md:hidden bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <button onClick={() => setSidebarOpen(true)} className="p-1 text-gray-600">
          <Menu className="h-6 w-6" />
        </button>
        <span className="font-bold text-[#1B2A4A] text-sm">{tabs.find(t => t.key === tab)?.label}</span>
        <div className="w-6" />
      </div>

      {/* オーバーレイ（モバイル） */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* サイドバー */}
      <aside className={`w-56 bg-white border-r fixed top-0 left-0 bottom-0 z-40 flex flex-col transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <div className="px-4 py-5 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Video className="h-6 w-6 text-[#1B2A4A]" />
            <div>
              <h1 className="font-bold text-[#1B2A4A] text-sm leading-tight">説明会動画配信</h1>
              <p className="text-[10px] text-gray-400">{companyName}</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden p-1 text-gray-400">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 py-2 px-2 space-y-0.5">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => handleTabClick(t.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'bg-[#1B2A4A]/10 text-[#1B2A4A]'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}>
              {t.icon}
              {t.label}
            </button>
          ))}
        </nav>

        <div className="px-4 py-4 border-t space-y-2">
          <p className="text-xs text-gray-400 truncate">{adminUser.email}</p>
          <button onClick={signOut} className="w-full flex items-center gap-2 px-3 py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg text-sm transition-colors">
            <LogOut className="h-4 w-4" /> ログアウト
          </button>
        </div>
      </aside>

      {/* メインコンテンツ */}
      <main className="flex-1 md:ml-56 p-4 md:p-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl font-bold text-gray-800 mb-6 hidden md:block">{tabs.find(t => t.key === tab)?.label}</h2>
          {tab === 'videos' && <VideosTab companyId={companyId} />}
          {tab === 'students' && <StudentsTab companyId={companyId} />}
          {tab === 'chapters' && <ChaptersTab companyId={companyId} />}
          {tab === 'surveys' && <SurveysTab companyId={companyId} />}
          {tab === 'logs' && <LogsTab companyId={companyId} />}
        </div>
      </main>
    </div>
  )
}
