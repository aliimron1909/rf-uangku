import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  DatabaseBackup,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Fingerprint,
  HardDrive,
  Info,
  KeyRound,
  Lock,
  Monitor,
  Moon,
  Palette,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Sun,
  TestTube2,
  Trash2,
  Upload,
  UserRound,
  WifiOff,
} from 'lucide-react'
import type { BackupData, ThemeMode } from '../types'
import { db, setSetting } from '../db/db'
import {
  buildBackup,
  downloadCsv,
  downloadJson,
  restoreBackup,
  toCsv,
  validateBackup,
} from '../db/backup'
import { resetMasterData } from '../db/seed'
import { useAccounts, useAllAccounts } from '../hooks/useAccounts'
import { useCategories, useAllCategories } from '../hooks/useCategories'
import { useInstallPrompt } from '../hooks/useInstallPrompt'
import { useProfile } from '../hooks/useProfile'
import { useSetting } from '../hooks/useSetting'
import { useTransactions } from '../hooks/useTransactions'
import { useLock } from '../contexts/LockContext'
import { useTheme } from '../contexts/ThemeContext'
import { useToast } from '../contexts/ToastContext'
import { listGroqChatModels, testGroq, type GroqModelInfo } from '../lib/groq'
import { isValidPin } from '../lib/pin'
import { formatDateTime, todayISO } from '../lib/dates'
import { cn, errorMessage } from '../lib/utils'
import {
  APP_VERSION,
  DEFAULT_GROQ_MODEL,
  GROQ_MODELS,
  PROFILE_NAME_MAX_LENGTH,
} from '../lib/constants'
import { profileInitials, processProfilePhoto } from '../lib/profile'
import { Button } from '../components/ui/Button'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { MasterDataSection } from '../components/settings/MasterDataSection'

export function SettingsPage() {
  const location = useLocation()
  const { toast } = useToast()
  const { theme, setTheme } = useTheme()
  const {
    hasPinConfigured,
    lock,
    changePin,
    biometricEnabled,
    biometricSupported,
    setupBiometric,
    disableBiometric,
  } = useLock()
  const { canInstall, installed, promptInstall } = useInstallPrompt()
  const transactions = useTransactions()
  const accounts = useAccounts()
  const categories = useCategories()
  // CSV should still resolve archived master data used by older transactions.
  const allAccounts = useAllAccounts()
  const allCategories = useAllCategories()

  const groqKey = useSetting<string>('groqKey', '')
  const groqModel = useSetting<string>('groqModel', DEFAULT_GROQ_MODEL)
  const lastBackupAt = useSetting<string>('lastBackupAt', '')
  const { name: profileName, photo: profilePhoto } = useProfile()

  const [profileNameInput, setProfileNameInput] = useState(profileName)
  const [profilePhotoInput, setProfilePhotoInput] = useState(profilePhoto)
  const [profileError, setProfileError] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [photoProcessing, setPhotoProcessing] = useState(false)
  const profilePhotoInputRef = useRef<HTMLInputElement>(null)

  const [keyInput, setKeyInput] = useState(groqKey)
  const [modelInput, setModelInput] = useState(groqModel)
  const [showKey, setShowKey] = useState(false)
  const [savingAi, setSavingAi] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState('')
  const [testError, setTestError] = useState('')
  const [models, setModels] = useState<GroqModelInfo[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsError, setModelsError] = useState('')
  const [modelsFetchedAt, setModelsFetchedAt] = useState('')
  const [modelFilter, setModelFilter] = useState('')

  const [pinModalOpen, setPinModalOpen] = useState(false)
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmNewPin, setConfirmNewPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinSaving, setPinSaving] = useState(false)
  const [biometricSaving, setBiometricSaving] = useState(false)

  const lastBackupDate = lastBackupAt ? new Date(lastBackupAt) : null
  const lastBackupLabel =
    lastBackupDate && !Number.isNaN(lastBackupDate.getTime())
      ? formatDateTime(lastBackupDate)
      : 'Belum pernah'

  const [pendingRestore, setPendingRestore] = useState<BackupData | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [confirmClearTx, setConfirmClearTx] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmRemoveKey, setConfirmRemoveKey] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => setKeyInput(groqKey), [groqKey])
  useEffect(() => setModelInput(groqModel), [groqModel])
  useEffect(() => setProfileNameInput(profileName), [profileName])
  useEffect(() => setProfilePhotoInput(profilePhoto), [profilePhoto])

  useEffect(() => {
    if (!location.hash) return
    const id = location.hash.slice(1)
    const timer = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 150)
    return () => window.clearTimeout(timer)
  }, [location.hash])

  async function handleProfilePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setProfileError('')
    setPhotoProcessing(true)
    try {
      const photo = await processProfilePhoto(file)
      setProfilePhotoInput(photo)
      toast('Foto siap disimpan. Tekan Simpan profil.')
    } catch (caught) {
      toast(errorMessage(caught), 'error')
    } finally {
      setPhotoProcessing(false)
    }
  }

  async function saveProfile() {
    const name = profileNameInput.trim()
    if (!name) {
      setProfileError('Nama profil tidak boleh kosong.')
      return
    }
    if (name.length > PROFILE_NAME_MAX_LENGTH) {
      setProfileError(`Nama profil maksimal ${PROFILE_NAME_MAX_LENGTH} karakter.`)
      return
    }

    setProfileError('')
    setProfileSaving(true)
    try {
      await setSetting('profileName', name)
      await setSetting('profilePhoto', profilePhotoInput)
      setProfileNameInput(name)
      toast('Profil berhasil disimpan.')
    } catch (caught) {
      toast(errorMessage(caught), 'error')
    } finally {
      setProfileSaving(false)
    }
  }

  function removeProfilePhoto() {
    setProfilePhotoInput('')
    toast('Foto profil akan dihapus setelah Anda menekan Simpan profil.', 'info')
  }

  async function saveAiSettings() {
    const key = keyInput.trim()
    const model = modelInput.trim() || DEFAULT_GROQ_MODEL
    if (!key) {
      toast('API key Groq belum diisi.', 'error')
      return
    }
    setSavingAi(true)
    try {
      await setSetting('groqKey', key)
      await setSetting('groqModel', model)
      toast('Pengaturan AI disimpan.')
    } catch (caught) {
      toast(errorMessage(caught), 'error')
    } finally {
      setSavingAi(false)
    }
  }

  async function handleTestAi() {
    const key = keyInput.trim()
    const model = modelInput.trim() || DEFAULT_GROQ_MODEL
    if (!key) {
      setTestError('Isi API key terlebih dahulu.')
      setTestResult('')
      return
    }
    setTesting(true)
    setTestResult('')
    setTestError('')
    try {
      const reply = await testGroq(key, model)
      setTestResult(`Berhasil terhubung. Jawaban model: "${reply.slice(0, 80)}"`)
    } catch (caught) {
      setTestError(errorMessage(caught))
    } finally {
      setTesting(false)
    }
  }

  async function handleFindModels() {
    const key = keyInput.trim()
    setModelsError('')
    setTestResult('')
    setTestError('')
    if (!key) {
      setModelsError('Isi API key Groq terlebih dahulu untuk mencari model aktif.')
      return
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setModelsError('Butuh koneksi internet untuk mencari model Groq yang aktif.')
      return
    }

    setModelsLoading(true)
    try {
      const list = await listGroqChatModels(key)
      setModels(list)
      setModelsFetchedAt(new Date().toISOString())
      setModelFilter('')
      if (list.length === 0) {
        setModelsError('Tidak ada model chat aktif yang ditemukan untuk API key ini.')
      }
    } catch (caught) {
      const message = errorMessage(caught)
      setModels([])
      setModelsFetchedAt('')
      setModelsError(
        message === 'Failed to fetch'
          ? 'Tidak bisa menghubungi Groq. Periksa koneksi internet lalu coba lagi.'
          : message,
      )
    } finally {
      setModelsLoading(false)
    }
  }

  async function removeAiKey() {
    try {
      await setSetting('groqKey', '')
      setKeyInput('')
      setTestResult('')
      setTestError('')
      setConfirmRemoveKey(false)
      toast('API key Groq dihapus dari perangkat.')
    } catch (caught) {
      toast(errorMessage(caught), 'error')
    }
  }

  function openPinModal() {
    setCurrentPin('')
    setNewPin('')
    setConfirmNewPin('')
    setPinError('')
    setPinModalOpen(true)
  }

  async function handleChangePin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPinError('')
    if (!isValidPin(newPin)) {
      setPinError('PIN baru harus 4–6 digit angka.')
      return
    }
    if (newPin !== confirmNewPin) {
      setPinError('Konfirmasi PIN baru belum sama.')
      return
    }
    setPinSaving(true)
    try {
      const success = await changePin(currentPin, newPin)
      if (!success) {
        setPinError('PIN saat ini salah.')
        return
      }
      setPinModalOpen(false)
      toast('PIN berhasil diubah.')
    } catch (caught) {
      setPinError(errorMessage(caught))
    } finally {
      setPinSaving(false)
    }
  }

  async function handleEnableBiometric() {
    setBiometricSaving(true)
    try {
      await setupBiometric()
      toast('Fingerprint berhasil diaktifkan.')
    } catch (caught) {
      toast(errorMessage(caught), 'error')
    } finally {
      setBiometricSaving(false)
    }
  }

  function handleDisableBiometric() {
    disableBiometric()
    toast('Fingerprint dinonaktifkan. PIN tetap bisa dipakai.')
  }

  async function handleExportJson() {
    try {
      const backup = await buildBackup()
      downloadJson(backup, `RF-Uangku-backup-${todayISO()}.json`)
      await setSetting('lastBackupAt', new Date().toISOString())
      toast('Backup JSON berhasil diunduh. Simpan file di tempat aman.')
    } catch (caught) {
      toast(errorMessage(caught), 'error')
    }
  }

  function handleExportCsv() {
    if (transactions.length === 0) {
      toast('Belum ada transaksi untuk diekspor.', 'info')
      return
    }
    downloadCsv(
      toCsv(transactions, allAccounts, allCategories),
      `RF-Uangku-transaksi-${todayISO()}.csv`,
    )
    toast('CSV transaksi berhasil diunduh.')
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      const parsed: unknown = JSON.parse(text)
      validateBackup(parsed)
      setPendingRestore(parsed)
    } catch (caught) {
      toast(errorMessage(caught), 'error')
    }
  }

  async function handleRestore() {
    if (!pendingRestore) return
    setRestoring(true)
    try {
      await restoreBackup(pendingRestore)
      setPendingRestore(null)
      toast('Data berhasil dipulihkan dari backup.')
    } catch (caught) {
      toast(errorMessage(caught), 'error')
    } finally {
      setRestoring(false)
    }
  }

  async function handleClearTransactions() {
    try {
      await db.transactions.clear()
      setConfirmClearTx(false)
      toast('Semua transaksi telah dihapus.')
    } catch (caught) {
      toast(errorMessage(caught), 'error')
    }
  }

  async function handleResetMaster() {
    try {
      await resetMasterData()
      setConfirmReset(false)
      toast('Data master dan transaksi telah direset.')
    } catch (caught) {
      toast(errorMessage(caught), 'error')
    }
  }

  async function handleInstall() {
    try {
      const accepted = await promptInstall()
      if (accepted) toast('RF Uangku berhasil dipasang di HP.')
    } catch (caught) {
      toast(errorMessage(caught), 'error')
    }
  }

  const filteredModels = models.filter((model) =>
    model.id.toLowerCase().includes(modelFilter.trim().toLowerCase()),
  )
  const currentModelNotActive =
    models.length > 0 && !models.some((model) => model.id === modelInput.trim())
  const modelsFetchedLabel = modelsFetchedAt ? formatDateTime(new Date(modelsFetchedAt)) : ''

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
          Preferensi & Data
        </p>
        <h2 className="mt-1 text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 sm:text-2xl">
          Pengaturan
        </h2>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Semua pengaturan dan data disimpan di perangkat ini.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <MiniStat label="Transaksi" value={String(transactions.length)} icon={<HardDrive className="h-4 w-4" />} />
        <MiniStat label="Rekening aktif" value={String(accounts.length)} icon={<DatabaseBackup className="h-4 w-4" />} />
        <MiniStat label="Kategori aktif" value={String(categories.length)} icon={<Sparkles className="h-4 w-4" />} />
      </div>

      <Section
        id="profil"
        icon={<UserRound className="h-5 w-5" />}
        title="Profil"
        description="Nama dan foto hanya disimpan di perangkat ini."
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-emerald-600 text-xl font-extrabold text-white shadow-sm ring-4 ring-emerald-50 dark:ring-emerald-950/60">
              {profilePhotoInput ? (
                <img
                  src={profilePhotoInput}
                  alt="Foto profil"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>{profileInitials(profileNameInput)}</span>
              )}
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                onClick={() => profilePhotoInputRef.current?.click()}
                loading={photoProcessing}
              >
                <Camera className="h-3.5 w-3.5" />
                {profilePhotoInput ? 'Ganti foto' : 'Pilih foto'}
              </Button>
              {profilePhotoInput && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={removeProfilePhoto}
                  disabled={photoProcessing}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Hapus
                </Button>
              )}
            </div>
            <input
              ref={profilePhotoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => void handleProfilePhotoChange(event)}
            />
          </div>

          <div className="flex-1 space-y-3">
            <Input
              label="Nama profil"
              value={profileNameInput}
              onChange={(event) => {
                setProfileNameInput(event.target.value)
                if (profileError) setProfileError('')
              }}
              maxLength={PROFILE_NAME_MAX_LENGTH}
              placeholder="Contoh: Rafi"
              leftIcon={<UserRound className="h-4 w-4" />}
              error={profileError}
              hint={`Dipakai untuk sapaan dashboard dan laporan PDF. Maks. ${PROFILE_NAME_MAX_LENGTH} karakter.`}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={() => void saveProfile()}
                loading={profileSaving}
                disabled={photoProcessing}
              >
                <Save className="h-3.5 w-3.5" />
                Simpan profil
              </Button>
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                {profilePhotoInput ? 'Foto siap disimpan.' : 'Belum ada foto profil.'}
              </span>
            </div>
            <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-[11px] leading-relaxed text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
              Foto diperkecil otomatis ke 256×256 dan disimpan lokal. Foto profil tidak mengganti
              ikon aplikasi/APK.
            </p>
          </div>
        </div>
      </Section>

      <Section
        icon={<ShieldCheck className="h-5 w-5" />}
        title="Keamanan"
        description="PIN 4–6 digit untuk mengunci tampilan aplikasi."
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {hasPinConfigured ? 'PIN aktif' : 'PIN belum dibuat'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                PIN hanya membatasi akses tampilan, bukan enkripsi database.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={openPinModal}>
              Ubah PIN
            </Button>
            <Button variant="secondary" size="sm" onClick={lock} disabled={!hasPinConfigured}>
              <Lock className="h-3.5 w-3.5" />
              Kunci sekarang
            </Button>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-3 border-t border-slate-100 pt-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-300">
              <Fingerprint className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {biometricEnabled ? 'Fingerprint aktif' : 'Fingerprint belum aktif'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {biometricSupported
                  ? 'Buka aplikasi dengan sidik jari. PIN tetap menjadi cadangan.'
                  : 'Perangkat atau browser ini belum mendukung fingerprint WebAuthn.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {biometricEnabled ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleEnableBiometric()}
                  loading={biometricSaving}
                  disabled={!biometricSupported}
                >
                  <Fingerprint className="h-3.5 w-3.5" />
                  Daftarkan ulang
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDisableBiometric}
                  disabled={biometricSaving}
                >
                  Nonaktifkan
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void handleEnableBiometric()}
                loading={biometricSaving}
                disabled={!biometricSupported}
              >
                <Fingerprint className="h-3.5 w-3.5" />
                Aktifkan
              </Button>
            )}
          </div>
        </div>
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Lupa PIN? Dari layar kunci, pilih “Lupa PIN?” untuk mereset PIN dan fingerprint. Data
          transaksi tetap tersimpan. Jangan bagikan perangkat dalam keadaan terbuka.
        </p>
        <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
          Fingerprint terikat ke domain aplikasi ini dan hanya membuka tampilan, bukan mengenkripsi
          database. Credential fingerprint tidak ikut backup JSON.
        </p>
      </Section>

      <Section
        icon={<Palette className="h-5 w-5" />}
        title="Tampilan"
        description="Pilih tema yang paling nyaman untuk mata."
      >
        <div className="grid grid-cols-3 gap-2">
          <ThemeButton
            label="Terang"
            icon={<Sun className="h-4 w-4" />}
            active={theme === 'light'}
            onClick={() => setTheme('light' as ThemeMode)}
          />
          <ThemeButton
            label="Gelap"
            icon={<Moon className="h-4 w-4" />}
            active={theme === 'dark'}
            onClick={() => setTheme('dark' as ThemeMode)}
          />
          <ThemeButton
            label="Sistem"
            icon={<Monitor className="h-4 w-4" />}
            active={theme === 'system'}
            onClick={() => setTheme('system' as ThemeMode)}
          />
        </div>
      </Section>

      <Section
        icon={<Sparkles className="h-5 w-5" />}
        title="AI Groq"
        description="Isi cepat dan chat transaksi dengan bahasa sehari-hari. API key disimpan lokal di perangkat."
      >
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                label="API Key Groq"
                type={showKey ? 'text' : 'password'}
                value={keyInput}
                onChange={(event) => setKeyInput(event.target.value)}
                placeholder="gsk_..."
                leftIcon={<KeyRound className="h-4 w-4" />}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <button
              type="button"
              onClick={() => setShowKey((value) => !value)}
              className="mt-6 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
              aria-label={showKey ? 'Sembunyikan API key' : 'Tampilkan API key'}
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <Input
            label="Model Groq"
            value={modelInput}
            onChange={(event) => setModelInput(event.target.value)}
            list="groq-models"
            hint="Default: llama-3.3-70b-versatile. Tekan Cari model aktif untuk melihat daftar terbaru dari Groq."
            spellCheck={false}
          />
          <datalist id="groq-models">
            {GROQ_MODELS.map((model) => (
              <option key={model} value={model} />
            ))}
          </datalist>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void saveAiSettings()} loading={savingAi}>
              <Save className="h-3.5 w-3.5" />
              Simpan pengaturan AI
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleTestAi()}
              loading={testing}
            >
              <TestTube2 className="h-3.5 w-3.5" />
              Tes koneksi
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleFindModels()}
              loading={modelsLoading}
            >
              <Search className="h-3.5 w-3.5" />
              Cari model aktif
            </Button>
            {groqKey && (
              <Button size="sm" variant="ghost" onClick={() => setConfirmRemoveKey(true)}>
                <Trash2 className="h-3.5 w-3.5" />
                Hapus key
              </Button>
            )}
          </div>

          <p className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
            <WifiOff className="h-3.5 w-3.5" />
            Pencarian model membutuhkan koneksi internet. Daftar diambil langsung dari Groq.
          </p>

          {modelsError && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{modelsError}</p>
            </div>
          )}

          {models.length > 0 && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 dark:border-emerald-900 dark:bg-emerald-950/20">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                    Model chat aktif
                  </p>
                  <p className="text-[11px] text-emerald-800/70 dark:text-emerald-300/70">
                    {models.length} model ditemukan
                    {modelsFetchedLabel ? ` · ${modelsFetchedLabel}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setModels([])
                    setModelsFetchedAt('')
                    setModelFilter('')
                    setModelsError('')
                  }}
                  className="text-[11px] font-semibold text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  Tutup
                </button>
              </div>

              <div className="mt-2">
                <Input
                  value={modelFilter}
                  onChange={(event) => setModelFilter(event.target.value)}
                  placeholder="Cari nama model..."
                  leftIcon={<Search className="h-4 w-4" />}
                  spellCheck={false}
                />
              </div>

              <div className="mt-2 max-h-56 space-y-1 overflow-y-auto pr-1">
                {filteredModels.length === 0 ? (
                  <p className="px-1 py-2 text-xs text-slate-500 dark:text-slate-400">
                    Tidak ada model yang cocok dengan pencarian.
                  </p>
                ) : (
                  filteredModels.map((model) => {
                    const selected = model.id === modelInput.trim()
                    return (
                      <button
                        key={model.id}
                        type="button"
                        onClick={() => {
                          setModelInput(model.id)
                          setModelsError('')
                          setTestResult('')
                          setTestError('')
                        }}
                        aria-pressed={selected}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition',
                          selected
                            ? 'border-emerald-300 bg-white dark:border-emerald-800 dark:bg-slate-900'
                            : 'border-transparent bg-white/70 hover:border-emerald-200 hover:bg-white dark:bg-slate-900/60 dark:hover:border-emerald-900 dark:hover:bg-slate-900',
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                            {model.id}
                          </p>
                          <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                            {model.ownedBy ? `${model.ownedBy} · ` : ''}
                            {model.contextWindow
                              ? `${Math.round(model.contextWindow / 1000)}k context`
                              : 'Model chat'}
                          </p>
                        </div>
                        {selected ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <span className="shrink-0 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            Pakai
                          </span>
                        )}
                      </button>
                    )
                  })
                )}
              </div>

              {currentModelNotActive && (
                <p className="mt-2 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
                  Model yang sedang dipakai tidak ada di daftar aktif. Pilih model lain, atau tetap
                  pakai jika Anda yakin model tersebut masih tersedia.
                </p>
              )}
            </div>
          )}

          {testResult && (
            <div className="flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{testResult}</p>
            </div>
          )}
          {testError && (
            <div className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-xs text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{testError}</p>
            </div>
          )}

          <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-[11px] leading-relaxed text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            <p>
              Buat API key gratis di{' '}
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-emerald-600 underline underline-offset-2 dark:text-emerald-400"
              >
                console.groq.com/keys
                <ExternalLink className="h-3 w-3" />
              </a>
              . Key hanya dikirim langsung dari browser ke Groq saat Anda memakai isi cepat atau
              chat AI, termasuk saat mencari daftar model aktif. Jangan pakai aplikasi ini di
              perangkat bersama.
            </p>
          </div>
        </div>
      </Section>

      <Section
        id="backup"
        icon={<DatabaseBackup className="h-5 w-5" />}
        title="Backup & Data"
        description="Data lokal bisa hilang jika penyimpanan browser dibersihkan. Backup rutin sangat disarankan."
      >
        <div className="mb-4 flex flex-col gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Backup terakhir:{' '}
            <span className="font-semibold text-slate-800 dark:text-slate-100">
              {lastBackupLabel}
            </span>
          </span>
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            {transactions.length} transaksi · {allAccounts.length} rekening · {allCategories.length} kategori
          </span>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Button onClick={() => void handleExportJson()}>
            <Download className="h-4 w-4" />
            Unduh Backup JSON
          </Button>
          <Button variant="outline" onClick={handleExportCsv}>
            <FileSpreadsheet className="h-4 w-4" />
            Ekspor Transaksi CSV
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4" />
            Pulihkan dari Backup
          </Button>
          <Button variant="outline" onClick={() => setConfirmClearTx(true)} disabled={transactions.length === 0}>
            <Trash2 className="h-4 w-4" />
            Hapus Semua Transaksi
          </Button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => void handleFileChange(event)}
        />

        <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-[11px] leading-relaxed text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Memulihkan backup akan <span className="font-bold">mengganti seluruh data lokal</span>{' '}
            dengan isi file. Unduh backup terbaru dulu jika ragu. File backup JSON berisi seluruh
            transaksi, rekening, kategori, dan profil.
          </p>
        </div>

        <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
          <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Zona berbahaya</p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            Reset ke data awal akan menghapus semua transaksi dan mengembalikan rekening/kategori
            bawaan.
          </p>
          <Button
            variant="danger"
            size="sm"
            className="mt-2"
            onClick={() => setConfirmReset(true)}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reset ke data awal
          </Button>
        </div>
      </Section>

      <MasterDataSection />

      <Section
        icon={<Smartphone className="h-5 w-5" />}
        title="Aplikasi"
        description="Pasang RF Uangku di layar utama HP agar seperti aplikasi biasa."
      >
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {installed ? 'Sudah terpasang' : canInstall ? 'Siap dipasang' : 'Pasang manual'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Versi {APP_VERSION} · PWA offline-first
              </p>
            </div>
            {installed ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Terpasang
              </span>
            ) : canInstall ? (
              <Button size="sm" onClick={() => void handleInstall()}>
                <Download className="h-3.5 w-3.5" />
                Pasang aplikasi
              </Button>
            ) : (
              <span className="text-[11px] text-slate-400 dark:text-slate-500">
                Gunakan menu browser
              </span>
            )}
          </div>

          <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-[11px] leading-relaxed text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            <p className="font-semibold text-slate-700 dark:text-slate-200">Android / Chrome:</p>
            <p>Menu ⋮ → “Tambahkan ke layar utama” / “Install app”.</p>
            <p className="mt-1.5 font-semibold text-slate-700 dark:text-slate-200">iPhone / Safari:</p>
            <p>Tombol Bagikan → “Tambahkan ke Layar Utama”.</p>
          </div>
        </div>
      </Section>

      <Section
        icon={<Info className="h-5 w-5" />}
        title="Tentang RF Uangku"
        description="Aplikasi keuangan pribadi yang sederhana, lokal, dan privat."
      >
        <div className="space-y-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          <p>
            RF Uangku menyimpan seluruh data di IndexedDB browser/perangkat. Tidak ada server,
            tidak ada akun, dan tidak ada pengiriman data ke pihak lain — kecuali teks dan API key
            yang Anda kirim ke Groq saat memakai isi cepat, chat AI, atau mencari model aktif.
          </p>
          <p>
            Dibangun dengan React, Vite, Tailwind CSS, Dexie, Recharts, dan jsPDF. Ikon dan tampilan
            dibuat khusus untuk pemakaian pribadi di satu HP.
          </p>
          <p className="font-medium text-slate-600 dark:text-slate-300">
            Versi {APP_VERSION} · Data milik Anda sepenuhnya.
          </p>
        </div>
      </Section>

      <Modal
        open={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        title="Ubah PIN"
        description="Masukkan PIN saat ini, lalu buat PIN baru 4–6 digit."
        size="sm"
      >
        <form onSubmit={handleChangePin} className="space-y-3">
          <Input
            label="PIN saat ini"
            type="password"
            inputMode="numeric"
            maxLength={6}
            autoFocus
            value={currentPin}
            onChange={(event) => setCurrentPin(event.target.value.replace(/\D/g, ''))}
            placeholder="PIN lama"
            leftIcon={<KeyRound className="h-4 w-4" />}
          />
          <Input
            label="PIN baru"
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={newPin}
            onChange={(event) => setNewPin(event.target.value.replace(/\D/g, ''))}
            placeholder="4–6 digit"
          />
          <Input
            label="Ulangi PIN baru"
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={confirmNewPin}
            onChange={(event) => setConfirmNewPin(event.target.value.replace(/\D/g, ''))}
            placeholder="Ulangi PIN baru"
            error={pinError}
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setPinModalOpen(false)} disabled={pinSaving}>
              Batal
            </Button>
            <Button type="submit" loading={pinSaving}>
              Simpan PIN
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmRemoveKey}
        title="Hapus API key Groq?"
        message="Fitur isi cepat dan chat AI tidak akan bisa dipakai sampai Anda memasukkan key baru. Transaksi yang sudah ada tidak terpengaruh."
        confirmLabel="Hapus key"
        danger
        onCancel={() => setConfirmRemoveKey(false)}
        onConfirm={() => void removeAiKey()}
      />

      <ConfirmDialog
        open={Boolean(pendingRestore)}
        title="Pulihkan data dari backup?"
        message="Seluruh transaksi, rekening, dan kategori saat ini akan diganti dengan isi file backup. Profil juga ikut dipulihkan jika tersedia di file. Tindakan ini tidak bisa dibatalkan."
        confirmLabel="Pulihkan data"
        danger
        loading={restoring}
        onCancel={() => setPendingRestore(null)}
        onConfirm={() => void handleRestore()}
      />

      <ConfirmDialog
        open={confirmClearTx}
        title="Hapus semua transaksi?"
        message="Semua transaksi akan dihapus permanen. Rekening dan kategori tetap ada. Sebaiknya unduh backup JSON terlebih dahulu."
        confirmLabel="Hapus semua"
        danger
        onCancel={() => setConfirmClearTx(false)}
        onConfirm={() => void handleClearTransactions()}
      />

      <ConfirmDialog
        open={confirmReset}
        title="Reset ke data awal?"
        message="Semua transaksi akan dihapus, lalu rekening dan kategori dikembalikan ke daftar bawaan. Tindakan ini tidak bisa dibatalkan."
        confirmLabel="Reset data"
        danger
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => void handleResetMaster()}
      />
    </div>
  )
}

interface SectionProps {
  id?: string
  icon: ReactNode
  title: string
  description: string
  children: ReactNode
}

function Section({ id, icon, title, description, children }: SectionProps) {
  return (
    <section
      id={id}
      className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-start gap-3 border-b border-slate-100 px-4 py-4 dark:border-slate-800 sm:px-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300">
          {icon}
        </div>
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{title}</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {description}
          </p>
        </div>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  )
}

interface ThemeButtonProps {
  label: string
  icon: ReactNode
  active: boolean
  onClick: () => void
}

function ThemeButton({ label, icon, active, onClick }: ThemeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-semibold transition ${
        active
          ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500/20 dark:border-emerald-500 dark:bg-emerald-950/50 dark:text-emerald-300'
          : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

interface MiniStatProps {
  label: string
  value: string
  icon: ReactNode
}

function MiniStat({ label, value, icon }: MiniStatProps) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        {icon}
      </span>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          {label}
        </p>
        <p className="text-lg font-extrabold text-slate-800 dark:text-slate-100">{value}</p>
      </div>
    </div>
  )
}
