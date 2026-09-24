import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Users, Settings, Plus, Trash2, AlertCircle, 
  TrendingUp, RefreshCw, CheckCircle2, Receipt, FileDown, Maximize2,
  Wallet, Scale, Heart
} from 'lucide-react';
import { exportLaporanPdf } from './exportPdf';

interface Anggota {
  id: string | number;
  nama: string;
}

interface Pertemuan {
  id: string | number;
  hari: string;
  tanggal: string;
}

interface Pembayaran {
  id?: string | number;
  anggotaId: string | number;
  pertemuanId: string | number;
  status: boolean;
}

interface Pengeluaran {
  id: string | number;
  tanggal: string;
  keterangan: string;
  nominal: number;
}

interface Pengaturan {
  periode: string;
  nominal: number;
}

// Helper: Format tanggal pengeluaran
function formatTanggalPengeluaran(value: string | undefined | null): string {
  if (!value) return '-';
  const trimmed = String(value).trim();
  if (!trimmed) return '-';
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
    try {
      const date = new Date(trimmed);
      if (!isNaN(date.getTime())) {
        return new Intl.DateTimeFormat('id-ID', {
          timeZone: 'Asia/Jakarta',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        }).format(date);
      }
    } catch (e) {
      // fallback
    }
  }
  return trimmed;
}

// A1. Helper: Normalisasi data pengeluaran dari Google Sheets
function normalizePengeluaran(rows: any[]): Pengeluaran[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    if (!row) return null;
    const getVal = (keys: string[]) => {
      for (const k of keys) {
        const foundKey = Object.keys(row).find(
          (rk) => rk.toLowerCase() === k.toLowerCase()
        );
        if (foundKey !== undefined) return row[foundKey];
      }
      return undefined;
    };

    const id = getVal(['id']) ?? ('x' + Math.random());
    const tanggal = formatTanggalPengeluaran(String(getVal(['tanggal', 'date']) || ''));
    const keterangan = String(getVal(['keterangan', 'ket', 'deskripsi']) || '');
    const nominal = Number(getVal(['nominal', 'jumlah', 'amount']) || 0);

    return { id, tanggal, keterangan, nominal: isNaN(nominal) ? 0 : nominal };
  }).filter(Boolean) as Pengeluaran[];
}

// A1. Helper: Normalisasi data pembayaran dari Google Sheets
function normalizePembayaran(rows: any[]): Pembayaran[] {
  const map = new Map<string, Pembayaran>();
  
  for (const row of rows) {
    if (!row) continue;
    const getVal = (keys: string[]) => {
      for (const k of keys) {
        const foundKey = Object.keys(row).find(
          (rk) => rk.toLowerCase() === k.toLowerCase()
        );
        if (foundKey !== undefined) return row[foundKey];
      }
      return undefined;
    };

    const id = getVal(['id']);
    const anggotaIdRaw = getVal(['anggotaid']);
    const pertemuanIdRaw = getVal(['pertemuanid']);
    const statusRaw = getVal(['status']);

    if (anggotaIdRaw === undefined || pertemuanIdRaw === undefined) continue;

    const anggotaId = String(anggotaIdRaw);
    const pertemuanId = String(pertemuanIdRaw);
    const status = statusRaw === true || statusRaw === 'TRUE' || statusRaw === 'true';

    const key = `${anggotaId}-${pertemuanId}`;
    if (map.has(key)) {
      const existing = map.get(key)!;
      if (status) {
        existing.status = true;
      }
    } else {
      map.set(key, { id, anggotaId, pertemuanId, status });
    }
  }

  return Array.from(map.values());
}

// Helper: Normalisasi tanggal pertemuan
function formatTanggalPertemuan(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  const trimmed = String(value).trim();
  if (!trimmed) return '';
  if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
    try {
      const date = new Date(trimmed);
      if (!isNaN(date.getTime())) {
        return new Intl.DateTimeFormat('id-ID', {
          timeZone: 'Asia/Jakarta',
          day: 'numeric'
        }).format(date);
      }
    } catch (e) {
      // fallback
    }
  }
  return trimmed;
}

// Helper: Kapitalisasi nama hari (huruf pertama besar)
function kapitalisasiHari(hari: string | undefined | null): string {
  if (!hari) return '';
  const trimmed = String(hari).trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

// Helper: Normalisasi data pertemuan dari Google Sheets
function normalizePertemuan(rows: any[]): Pertemuan[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => {
    if (!row) return null;
    const getVal = (keys: string[]) => {
      for (const k of keys) {
        const foundKey = Object.keys(row).find(
          (rk) => rk.toLowerCase() === k.toLowerCase()
        );
        if (foundKey !== undefined) return row[foundKey];
      }
      return undefined;
    };

    const id = getVal(['id']) ?? ('x' + Math.random());
    const hari = kapitalisasiHari(String(getVal(['hari', 'day']) || ''));
    const tanggalRaw = getVal(['tanggal', 'date']);
    const tanggal = formatTanggalPertemuan(tanggalRaw);

    return { id, hari, tanggal };
  }).filter(Boolean) as Pertemuan[];
}

function getInitialGasUrl(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    const gasParam = params.get('gas');

    if (gasParam !== null) {
      const trimmedGas = gasParam.trim();
      const isValid = trimmedGas.startsWith('https://script.google.com/macros/s/') && trimmedGas.endsWith('/exec');
      
      if (isValid) {
        localStorage.setItem('gas_web_app_url', trimmedGas);
      }

      params.delete('gas');
      const newSearch = params.toString();
      const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash;
      window.history.replaceState({}, '', newUrl);

      if (isValid) {
        return trimmedGas;
      }
    }

    return localStorage.getItem('gas_web_app_url') || '';
  } catch (err) {
    return '';
  }
}

async function fetchWithRetry(url: string, options?: RequestInit, maxRetries = 2): Promise<any> {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.toLowerCase().includes('application/json')) {
        throw new Error('Response is not valid JSON (received HTML or non-JSON content)');
      }
      const data = await res.json();
      return data;
    } catch (err) {
      attempt++;
      if (attempt > maxRetries) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
}

export default function App() {

  const [gasUrl, setGasUrl] = useState<string>(getInitialGasUrl);

  const [anggota, setAnggota] = useState<Anggota[]>([]);
  const [pertemuan, setPertemuan] = useState<Pertemuan[]>([]);
  const [pembayaran, setPembayaran] = useState<Pembayaran[]>([]);
  const [pengeluaran, setPengeluaran] = useState<Pengeluaran[]>([]);
  const [pengaturan, setPengaturan] = useState<Pengaturan>({ periode: 'Oktober 2026', nominal: 10000 });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'grid' | 'rekap' | 'pengeluaran' | 'riwayat' | 'pengaturan'>('grid');
  const [showAddAnggotaModal, setShowAddAnggotaModal] = useState(false);
  const [showAddPertemuanModal, setShowAddPertemuanModal] = useState(false);
  const [showAddPengeluaranModal, setShowAddPengeluaranModal] = useState(false);
  
  const [newAnggotaNama, setNewAnggotaNama] = useState('');
  const [newHari, setNewHari] = useState('Kamis');
  const [newTanggal, setNewTanggal] = useState('');

  const [newPengeluaranTanggal, setNewPengeluaranTanggal] = useState('');
  const [newPengeluaranKeterangan, setNewPengeluaranKeterangan] = useState('');
  const [newPengeluaranNominal, setNewPengeluaranNominal] = useState<number | ''>('');

  const [editPeriode, setEditPeriode] = useState('Oktober 2026');
  const [editNominal, setEditNominal] = useState(10000);
  const [inputGasUrl, setInputGasUrl] = useState('');
  const [togglingKeys, setTogglingKeys] = useState<Set<string>>(new Set());
  const [exportingPdf, setExportingPdf] = useState(false);

  // State untuk saran landscape & layar penuh
  const [isPortrait, setIsPortrait] = useState<boolean>(() => {
    try {
      return window.matchMedia('(orientation: portrait)').matches || window.innerHeight > window.innerWidth;
    } catch {
      return window.innerHeight > window.innerWidth;
    }
  });
  const [isSmallScreen, setIsSmallScreen] = useState<boolean>(() => {
    try {
      return window.matchMedia('(max-width: 767px)').matches || window.innerWidth < 768;
    } catch {
      return window.innerWidth < 768;
    }
  });
  const [isLandscapeDismissed, setIsLandscapeDismissed] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('kassh_dismiss_landscape_banner');
      if (!stored) return false;

      // Fallback for legacy boolean format ('true' / 'false')
      if (stored === 'true') {
        localStorage.setItem('kassh_dismiss_landscape_banner', Date.now().toString());
        return true;
      }
      if (stored === 'false') {
        localStorage.removeItem('kassh_dismiss_landscape_banner');
        return false;
      }

      const dismissedTime = Number(stored);
      if (isNaN(dismissedTime)) {
        return false;
      }

      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - dismissedTime > SEVEN_DAYS_MS) {
        localStorage.removeItem('kassh_dismiss_landscape_banner');
        return false;
      }

      return true;
    } catch {
      return false;
    }
  });
  const [isFullscreen, setIsFullscreen] = useState<boolean>(() => {
    try {
      return Boolean(document.fullscreenElement);
    } catch {
      return false;
    }
  });
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);

  useEffect(() => {
    const updateOrientation = () => {
      try {
        const portrait = window.matchMedia('(orientation: portrait)').matches || window.innerHeight > window.innerWidth;
        const small = window.matchMedia('(max-width: 767px)').matches || window.innerWidth < 768;
        setIsPortrait(portrait);
        setIsSmallScreen(small);
      } catch {
        setIsPortrait(window.innerHeight > window.innerWidth);
        setIsSmallScreen(window.innerWidth < 768);
      }
    };

    updateOrientation();

    window.addEventListener('resize', updateOrientation);
    window.addEventListener('orientationchange', updateOrientation);

    const portraitQuery = window.matchMedia('(orientation: portrait)');
    const smallQuery = window.matchMedia('(max-width: 767px)');

    try {
      if (portraitQuery.addEventListener) {
        portraitQuery.addEventListener('change', updateOrientation);
      } else if ((portraitQuery as any).addListener) {
        (portraitQuery as any).addListener(updateOrientation);
      }
      if (smallQuery.addEventListener) {
        smallQuery.addEventListener('change', updateOrientation);
      } else if ((smallQuery as any).addListener) {
        (smallQuery as any).addListener(updateOrientation);
      }
    } catch (e) {}

    const handleFullscreenChange = () => {
      const inFullscreen = Boolean(document.fullscreenElement);
      setIsFullscreen(inFullscreen);
      if (!inFullscreen) {
        try {
          if (screen.orientation && typeof (screen.orientation as any).unlock === 'function') {
            (screen.orientation as any).unlock();
          }
        } catch (err) {}
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      window.removeEventListener('resize', updateOrientation);
      window.removeEventListener('orientationchange', updateOrientation);
      try {
        if (portraitQuery.removeEventListener) {
          portraitQuery.removeEventListener('change', updateOrientation);
        } else if ((portraitQuery as any).removeListener) {
          (portraitQuery as any).removeListener(updateOrientation);
        }
        if (smallQuery.removeEventListener) {
          smallQuery.removeEventListener('change', updateOrientation);
        } else if ((smallQuery as any).removeListener) {
          (smallQuery as any).removeListener(updateOrientation);
        }
      } catch (e) {}
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const dismissLandscapeBanner = () => {
    setIsLandscapeDismissed(true);
    try {
      localStorage.setItem('kassh_dismiss_landscape_banner', Date.now().toString());
    } catch (err) {}
  };

  const handleToggleFullscreen = async () => {
    setFullscreenError(null);
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
        if (screen.orientation && typeof (screen.orientation as any).lock === 'function') {
          try {
            await (screen.orientation as any).lock('landscape');
          } catch (err) {
            setFullscreenError('Perangkat ini belum mendukung kunci landscape, putar HP secara manual.');
          }
        }
      } else {
        if (screen.orientation && typeof (screen.orientation as any).unlock === 'function') {
          try {
            (screen.orientation as any).unlock();
          } catch (err) {}
        }
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch (err) {
      setFullscreenError('Gagal masuk/keluar layar penuh.');
    }
  };

  const canFullscreenAndLock = Boolean(
    typeof document.documentElement.requestFullscreen === 'function' && 
    screen.orientation && 
    typeof (screen.orientation as any).lock === 'function'
  );

  // A2. Refs untuk pending writes, isFetching, dan active toggles
  const pendingWrites = useRef<number>(0);
  const isFetching = useRef<boolean>(false);
  const activeToggles = useRef<Set<string>>(new Set());

  // A2. fetchDataFromGas dengan parameter silent (refresh diam-diam)
  const fetchDataFromGas = useCallback(async (url: string, silent = false) => {
    if (isFetching.current) return;
    isFetching.current = true;
    try {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      const data = await fetchWithRetry(`${url}?action=getData`);
      
      if (data.error) throw new Error(data.error);

      if (silent && pendingWrites.current > 0) return;

       setAnggota(data.anggota || []);
       setPertemuan(normalizePertemuan(data.pertemuan || []));
       setPembayaran(normalizePembayaran(data.pembayaran || []));
      setPengeluaran(normalizePengeluaran(data.pengeluaran || []));
      if (data.pengaturan) {
        setPengaturan({
          periode: data.pengaturan.periode || 'Oktober 2026',
          nominal: Number(data.pengaturan.nominal || 10000)
        });
        if (!silent) {
          setEditPeriode(data.pengaturan.periode || 'Oktober 2026');
          setEditNominal(Number(data.pengaturan.nominal || 10000));
        }
      }
    } catch (err: any) {
      if (!silent) {
        setError('Koneksi lagi kurang stabil, silakan coba lagi.');
      } else {
        console.warn('Silent fetch warning:', err);
      }
    } finally {
      isFetching.current = false;
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    setInputGasUrl(gasUrl);
    if (gasUrl) {
      fetchDataFromGas(gasUrl, false);
    }
  }, [gasUrl, fetchDataFromGas]);

  // A2. useEffect auto-refresh setiap 30 detik dengan visibilitychange
  useEffect(() => {
    if (!gasUrl) return;

    const interval = setInterval(() => {
      if (pendingWrites.current > 0 || isFetching.current || document.visibilityState !== 'visible') {
        return;
      }
      fetchDataFromGas(gasUrl, true);
    }, 30000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && gasUrl && pendingWrites.current === 0 && !isFetching.current) {
        fetchDataFromGas(gasUrl, true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [gasUrl, fetchDataFromGas]);

  const callGasApi = async (action: string, payload: any = {}) => {
    if (!gasUrl) {
      alert('Mohon masukkan URL Google Apps Script Web App di tab Pengaturan terlebih dahulu.');
      setActiveTab('pengaturan');
      return null;
    }

    try {
      const result = await fetchWithRetry(gasUrl, {
        method: 'POST',
        body: JSON.stringify({ action, ...payload }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      });
      if (result.error) throw new Error(result.error);
      return result;
    } catch (err: any) {
      console.error('GAS API Error:', err);
      throw new Error('Koneksi lagi kurang stabil, silakan coba lagi.');
    }
  };

  // A3. Toggle Pembayaran aman dengan anti double-click & optimistic update
  const handleTogglePembayaran = async (anggotaId: string | number, pertemuanId: string | number) => {
    const key = `${anggotaId}-${pertemuanId}`;
    if (activeToggles.current.has(key)) return;
    activeToggles.current.add(key);
    setTogglingKeys(prev => new Set(prev).add(key));

    const current = pembayaran.find(
      (p) => String(p.anggotaId) === String(anggotaId) && String(p.pertemuanId) === String(pertemuanId)
    );
    const currentStatus = current ? Boolean(current.status) : false;
    const newStatus = !currentStatus;

    // Optimistic update
    setPembayaran((prev) => {
      const exists = prev.some((p) => String(p.anggotaId) === String(anggotaId) && String(p.pertemuanId) === String(pertemuanId));
      if (exists) {
        return prev.map((p) =>
          String(p.anggotaId) === String(anggotaId) && String(p.pertemuanId) === String(pertemuanId) ? { ...p, status: newStatus } : p
        );
      } else {
        return [...prev, { anggotaId, pertemuanId, status: newStatus }];
      }
    });

    if (!gasUrl) {
      activeToggles.current.delete(key);
      setTogglingKeys(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      return;
    }

    pendingWrites.current++;
    try {
      await callGasApi('toggleBayar', { anggotaId, pertemuanId, status: newStatus });
    } catch (err: any) {
      alert('Gagal memperbarui pembayaran: ' + (err.message || 'Error'));
    } finally {
      pendingWrites.current--;
      if (pendingWrites.current === 0 && gasUrl) {
        await fetchDataFromGas(gasUrl, true);
      }
      activeToggles.current.delete(key);
      setTogglingKeys(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  // A4. Add Anggota
  const handleAddAnggota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAnggotaNama.trim()) return;

    if (!gasUrl) {
      const newId = 'a' + Date.now();
      setAnggota(prev => [...prev, { id: newId, nama: newAnggotaNama.trim() }]);
      setNewAnggotaNama('');
      setShowAddAnggotaModal(false);
      return;
    }

    pendingWrites.current++;
    try {
      setLoading(true);
      await callGasApi('tambahAnggota', { nama: newAnggotaNama.trim() });
      if (gasUrl) await fetchDataFromGas(gasUrl, true);
      setNewAnggotaNama('');
      setShowAddAnggotaModal(false);
    } catch (err: any) {
      alert('Gagal menambah anggota: ' + err.message);
    } finally {
      pendingWrites.current--;
      setLoading(false);
    }
  };

  // A4. Delete Anggota
  const handleDeleteAnggota = async (id: string | number, nama: string) => {
    if (!confirm(`Hapus anggota ${nama}?`)) return;

    if (!gasUrl) {
      setAnggota(prev => prev.filter(a => a.id !== id));
      return;
    }

    pendingWrites.current++;
    try {
      setLoading(true);
      await callGasApi('hapusAnggota', { id });
      if (gasUrl) await fetchDataFromGas(gasUrl, true);
    } catch (err: any) {
      alert('Gagal menghapus anggota: ' + err.message);
    } finally {
      pendingWrites.current--;
      setLoading(false);
    }
  };

  // A4. Add Pertemuan
  const handleAddPertemuan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHari.trim() || !newTanggal.trim()) return;

    if (!gasUrl) {
      const newId = 'p' + Date.now();
      setPertemuan(prev => [...prev, { id: newId, hari: kapitalisasiHari(newHari), tanggal: formatTanggalPertemuan(newTanggal.trim()) }]);
      setNewTanggal('');
      setShowAddPertemuanModal(false);
      return;
    }

    pendingWrites.current++;
    try {
      setLoading(true);
      await callGasApi('tambahPertemuan', { hari: kapitalisasiHari(newHari), tanggal: formatTanggalPertemuan(newTanggal.trim()) });
      if (gasUrl) await fetchDataFromGas(gasUrl, true);
      setNewTanggal('');
      setShowAddPertemuanModal(false);
    } catch (err: any) {
      alert('Gagal menambah pertemuan: ' + err.message);
    } finally {
      pendingWrites.current--;
      setLoading(false);
    }
  };

  // A4. Delete Pertemuan
  const handleDeletePertemuan = async (id: string | number, tanggal: string, hari: string) => {
    if (!confirm(`Hapus pertemuan hari ${hari} tanggal ${tanggal}?`)) return;

    if (!gasUrl) {
      setPertemuan(prev => prev.filter(p => p.id !== id));
      return;
    }

    pendingWrites.current++;
    try {
      setLoading(true);
      await callGasApi('hapusPertemuan', { id });
      if (gasUrl) await fetchDataFromGas(gasUrl, true);
    } catch (err: any) {
      alert('Gagal menghapus pertemuan: ' + err.message);
    } finally {
      pendingWrites.current--;
      setLoading(false);
    }
  };

  // Add Pengeluaran
  const handleAddPengeluaran = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPengeluaranKeterangan.trim()) {
      alert('Keterangan pengeluaran wajib diisi.');
      return;
    }
    const nom = Number(newPengeluaranNominal);
    if (isNaN(nom) || nom <= 0) {
      alert('Nominal pengeluaran harus lebih besar dari 0.');
      return;
    }

    if (!gasUrl) {
      const newId = 'x' + Date.now();
      setPengeluaran(prev => [{ id: newId, tanggal: newPengeluaranTanggal, keterangan: newPengeluaranKeterangan.trim(), nominal: nom }, ...prev]);
      setNewPengeluaranTanggal('');
      setNewPengeluaranKeterangan('');
      setNewPengeluaranNominal('');
      setShowAddPengeluaranModal(false);
      return;
    }

    pendingWrites.current++;
    try {
      setLoading(true);
      await callGasApi('tambahPengeluaran', { tanggal: newPengeluaranTanggal, keterangan: newPengeluaranKeterangan.trim(), nominal: nom });
      if (gasUrl) await fetchDataFromGas(gasUrl, true);
      setNewPengeluaranTanggal('');
      setNewPengeluaranKeterangan('');
      setNewPengeluaranNominal('');
      setShowAddPengeluaranModal(false);
    } catch (err: any) {
      alert('Gagal menambah pengeluaran: ' + err.message);
    } finally {
      pendingWrites.current--;
      setLoading(false);
    }
  };

  // Delete Pengeluaran
  const handleDeletePengeluaran = async (id: string | number, keterangan: string) => {
    if (!confirm(`Hapus pengeluaran "${keterangan}"?`)) return;

    if (!gasUrl) {
      setPengeluaran(prev => prev.filter(p => p.id !== id));
      return;
    }

    pendingWrites.current++;
    try {
      setLoading(true);
      await callGasApi('hapusPengeluaran', { id });
      if (gasUrl) await fetchDataFromGas(gasUrl, true);
    } catch (err: any) {
      alert('Gagal menghapus pengeluaran: ' + err.message);
    } finally {
      pendingWrites.current--;
      setLoading(false);
    }
  };

  // A4. Save Pengaturan
  const handleSavePengaturan = async (e: React.FormEvent) => {
    e.preventDefault();
    const newConfig = { periode: editPeriode, nominal: Number(editNominal) };
    setPengaturan(newConfig);
    localStorage.setItem('gas_web_app_url', inputGasUrl.trim());
    setGasUrl(inputGasUrl.trim());

    if (inputGasUrl.trim()) {
      pendingWrites.current++;
      try {
        setLoading(true);
        await callGasApi('updatePengaturan', { key: 'periode', value: editPeriode });
        await callGasApi('updatePengaturan', { key: 'nominal', value: editNominal });
        alert('Pengaturan berhasil disimpan ke Google Sheets!');
        await fetchDataFromGas(inputGasUrl.trim(), true);
      } catch (err: any) {
        alert('Gagal menyimpan ke Google Sheets: ' + err.message);
      } finally {
        pendingWrites.current--;
        setLoading(false);
      }
    } else {
      alert('Pengaturan lokal disimpan.');
    }
  };

  // A1. Calculations (mengabaikan baris yatim / orphan rows)
  const validAnggotaIds = new Set(anggota.map(a => String(a.id)));
  const validPertemuanIds = new Set(pertemuan.map(pt => String(pt.id)));

  const validPembayaran = pembayaran.filter(p => 
    validAnggotaIds.has(String(p.anggotaId)) && validPertemuanIds.has(String(p.pertemuanId))
  );

  const totalLunasCount = validPembayaran.filter((p) => p.status === true).length;
  const totalKasTerkumpul = totalLunasCount * pengaturan.nominal;
  const totalPengeluaran = pengeluaran.reduce((acc, curr) => acc + (Number(curr.nominal) || 0), 0);
  const saldoKas = totalKasTerkumpul - totalPengeluaran;

  const tunggakanList = anggota.map((a) => {
    const belumBayar = pertemuan.filter((pt) => {
      const p = validPembayaran.find((pay) => String(pay.anggotaId) === String(a.id) && String(pay.pertemuanId) === String(pt.id));
      return !p || !p.status;
    });
    return {
      ...a,
      jumlahBelumBayar: belumBayar.length,
      totalTunggakanRupiah: belumBayar.length * pengaturan.nominal,
    };
  }).filter((a) => a.jumlahBelumBayar > 0);

  const riwayatPemasukanList = validPembayaran
    .filter(p => p.status === true)
    .map(p => {
      const ang = anggota.find(a => String(a.id) === String(p.anggotaId));
      const pt = pertemuan.find(t => String(t.id) === String(p.pertemuanId));
      return {
        id: `${p.anggotaId}-${p.pertemuanId}`,
        nama: ang ? ang.nama : '',
        hari: pt ? kapitalisasiHari(pt.hari) : '',
        tanggal: pt ? formatTanggalPertemuan(pt.tanggal) : '',
        tanggalNum: pt ? Number(formatTanggalPertemuan(pt.tanggal)) || 0 : 0,
        nominal: pengaturan.nominal,
      };
    })
    .filter(item => item.nama && item.tanggal);

  riwayatPemasukanList.sort((a, b) => {
    if (b.tanggalNum !== a.tanggalNum) {
      return b.tanggalNum - a.tanggalNum;
    }
    return a.nama.localeCompare(b.nama, 'id');
  });

  const handleExportPdf = async () => {
    if (exportingPdf) return;
    setExportingPdf(true);
    try {
      await exportLaporanPdf({
        periode: pengaturan.periode,
        nominalPerSesi: pengaturan.nominal,
        kolomPertemuan: pertemuan.map((pt) => ({
          hari: kapitalisasiHari(pt.hari),
          tanggal: formatTanggalPertemuan(pt.tanggal),
        })),
        grid: anggota.map((a) => {
          const statuses = pertemuan.map((pt) => {
            const p = validPembayaran.find(
              (pay) =>
                String(pay.anggotaId) === String(a.id) &&
                String(pay.pertemuanId) === String(pt.id)
            );
            return Boolean(p && p.status);
          });
          const paidCount = statuses.filter(Boolean).length;
          return {
            nama: a.nama,
            statuses,
            totalBayar: `${paidCount}/${pertemuan.length}`,
          };
        }),
        rekap: {
          totalPemasukan: totalKasTerkumpul,
          totalLunasCount,
          totalPengeluaran,
          jumlahPengeluaran: pengeluaran.length,
          saldoKas,
        },
        tunggakan: tunggakanList.map((t) => ({
          nama: t.nama,
          jumlahBelumBayar: t.jumlahBelumBayar,
          totalTunggakanRupiah: t.totalTunggakanRupiah,
        })),
        riwayatPemasukan: riwayatPemasukanList.map((p) => ({
          nama: p.nama,
          hari: p.hari,
          tanggal: p.tanggal,
          nominal: p.nominal,
        })),
        pengeluaran: pengeluaran.map((p) => ({
          tanggal: formatTanggalPengeluaran(p.tanggal),
          keterangan: p.keterangan,
          nominal: Number(p.nominal) || 0,
        })),
      });
    } catch (err: any) {
      alert('Gagal mengekspor PDF: ' + (err?.message || 'Error tidak diketahui'));
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#E0E7FF] to-[#F8FAFC] text-[#1E293B] flex flex-col font-sans">
      {isFullscreen && (
        <div className="fixed top-2 right-2 z-50 flex flex-col items-end gap-1">
          <button
            onClick={handleToggleFullscreen}
            className="bg-[#4F46E5] hover:bg-[#4338CA] text-white px-2.5 py-1 rounded text-xs font-medium shadow transition"
            title="Keluar layar penuh"
          >
            Keluar layar penuh
          </button>
          {fullscreenError && (
            <div className="bg-[#FFFBEB] border border-[#FDE68A] text-[#B45309] px-2 py-1 rounded text-[10px] shadow max-w-[220px] text-right">
              {fullscreenError}
            </div>
          )}
        </div>
      )}

      {isPortrait && isSmallScreen && !isLandscapeDismissed && (
        <div 
          role="status" 
          className="bg-white border-b border-[#E2E8F0] text-[#1E293B] px-3 py-1.5 shadow-sm flex items-center justify-between gap-2 text-[11px] md:text-xs"
        >
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className="text-[#4338CA] shrink-0">📱</span>
            <span className="truncate">
              Putar HP ke landscape agar tabel lebih lega.
              {fullscreenError && <span className="block text-[#B45309] text-[10px] mt-0.5">{fullscreenError}</span>}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {canFullscreenAndLock && (
              <button
                onClick={handleToggleFullscreen}
                className="bg-[#4F46E5] hover:bg-[#4338CA] text-white px-2 py-1 rounded font-medium transition text-[11px]"
              >
                Putar & Layar Penuh
              </button>
            )}
            <button
              onClick={dismissLandscapeBanner}
              className="text-[#64748B] hover:text-[#1E293B] px-1.5 py-1 transition text-[11px]"
              title="Tutup saran"
            >
              Tutup ✕
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-[#E2E8F0] px-4 py-5 md:px-8 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center justify-between w-full md:w-auto">
            <div className="flex items-center gap-4">
              <img src={`${import.meta.env.BASE_URL}logo-psht.png`} alt="Logo PSHT" className="h-12 w-12 md:h-16 md:w-16 object-contain drop-shadow-[0_0_10px_rgba(99,102,241,0.25)]" />
              <div>
                <h1 className="text-3xl md:text-4xl font-serif-title font-bold tracking-widest text-[#1E293B]">
                  UANG KAS
                </h1>
                <div className="flex items-center gap-3 mt-2">
                  <span className="bg-[#4F46E5] text-white px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wide shadow">
                    {pengaturan.periode}
                  </span>
                  <span className="text-xs text-[#64748B] uppercase tracking-wide font-medium">Selasa / Kamis / Sabtu</span>
                </div>
              </div>
            </div>

            {canFullscreenAndLock && (
              <button
                onClick={handleToggleFullscreen}
                className="md:hidden bg-white hover:bg-[#EFF6FF] text-[#4338CA] p-2.5 rounded-lg flex items-center justify-center transition border border-[#6B7280] shrink-0"
                title="Layar Penuh & Landscape"
                aria-label="Layar Penuh & Landscape"
              >
                <Maximize2 className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden lg:block text-center italic text-xs text-[#64748B] max-w-[200px]">
            </div>
            <div className="flex gap-4">
              <div className="bg-[#EFF6FF] border border-[#E2E8F0] px-4 py-2 rounded-xl text-center shadow-sm">
                <p className="text-xl md:text-2xl font-bold text-[#4338CA]">{anggota.length.toString().padStart(2, '0')}</p>
                <p className="text-[10px] text-[#475569] uppercase tracking-wide font-medium">Siswa</p>
              </div>
              <div className="bg-[#EFF6FF] border border-[#E2E8F0] px-4 py-2 rounded-xl text-center shadow-sm">
                <p className="text-xl md:text-2xl font-bold text-[#4338CA]">{pertemuan.length.toString().padStart(2, '0')}</p>
                <p className="text-[10px] text-[#475569] uppercase tracking-wide font-medium">Pertemuan</p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto flex gap-2 mt-5 pt-4 border-t border-[#E2E8F0] overflow-x-auto">
          <button
            onClick={() => setActiveTab('grid')}
            className={`whitespace-nowrap px-4 py-2 rounded-lg font-medium text-sm transition flex items-center gap-2 ${
              activeTab === 'grid' ? 'bg-[#4F46E5] text-white font-bold shadow-md' : 'bg-white text-[#475569] border border-[#6B7280] hover:bg-[#EFF6FF]'
            }`}
          >
            <Users className="w-4 h-4" /> Tabel Kas ({anggota.length} Anggota)
          </button>
          <button
            onClick={() => setActiveTab('rekap')}
            className={`whitespace-nowrap px-4 py-2 rounded-lg font-medium text-sm transition flex items-center gap-2 ${
              activeTab === 'rekap' ? 'bg-[#4F46E5] text-white font-bold shadow-md' : 'bg-white text-[#475569] border border-[#6B7280] hover:bg-[#EFF6FF]'
            }`}
          >
            <TrendingUp className="w-4 h-4" /> Panel Rekap & Tunggakan ({tunggakanList.length} Nunggak)
          </button>
          <button
            onClick={() => setActiveTab('riwayat')}
            className={`whitespace-nowrap px-4 py-2 rounded-lg font-medium text-sm transition flex items-center gap-2 ${
              activeTab === 'riwayat' ? 'bg-[#4F46E5] text-white font-bold shadow-md' : 'bg-white text-[#475569] border border-[#6B7280] hover:bg-[#EFF6FF]'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" /> Pemasukan ({riwayatPemasukanList.length})
          </button>
          <button
            onClick={() => setActiveTab('pengeluaran')}
            className={`whitespace-nowrap px-4 py-2 rounded-lg font-medium text-sm transition flex items-center gap-2 ${
              activeTab === 'pengeluaran' ? 'bg-[#4F46E5] text-white font-bold shadow-md' : 'bg-white text-[#475569] border border-[#6B7280] hover:bg-[#EFF6FF]'
            }`}
          >
            <Receipt className="w-4 h-4" /> Pengeluaran ({pengeluaran.length})
          </button>
          <button
            onClick={() => setActiveTab('pengaturan')}
            className={`whitespace-nowrap px-4 py-2 rounded-lg font-medium text-sm transition flex items-center gap-2 ${
              activeTab === 'pengaturan' ? 'bg-[#4F46E5] text-white font-bold shadow-md' : 'bg-white text-[#475569] border border-[#6B7280] hover:bg-[#EFF6FF]'
            }`}
          >
            <Settings className="w-4 h-4" /> Pengaturan {gasUrl ? '🟢' : '🔴'}
          </button>
          <button
            onClick={handleExportPdf}
            disabled={exportingPdf}
            className={`whitespace-nowrap px-4 py-2 rounded-lg font-medium text-sm transition flex items-center gap-2 ml-auto border ${
              exportingPdf
                ? 'bg-[#E2E8F0] text-[#64748B] border-[#E2E8F0] opacity-70 cursor-wait'
                : 'bg-[#4F46E5] text-white border-[#4F46E5] hover:bg-[#4338CA] shadow'
            }`}
            title="Unduh laporan lengkap (Tabel Kas, Rekap, Pemasukan, Pengeluaran) sebagai PDF"
          >
            <FileDown className={`w-4 h-4 ${exportingPdf ? 'animate-pulse' : ''}`} />
            {exportingPdf ? 'Mengekspor...' : 'Export PDF'}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8">
        {!gasUrl && activeTab !== 'pengaturan' && (
          <div className="mb-6 bg-[#FFFBEB] border border-[#FDE68A] p-4 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-[#B45309] shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-bold text-[#B45309] mb-1">URL Google Apps Script Belum Dimasukkan!</p>
              <p className="text-[#92400E] mb-2">
                Aplikasi belum terhubung ke Google Sheets Anda. Silakan masukkan URL Web App Apps Script di tab Pengaturan.
              </p>
              <button
                onClick={() => setActiveTab('pengaturan')}
                className="bg-[#B45309] hover:bg-[#92400E] text-white px-3 py-1.5 rounded font-medium text-xs transition"
              >
                Buka Pengaturan Sekarang
              </button>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-6 text-[#64748B] gap-2 mb-4">
            <RefreshCw className="w-5 h-5 animate-spin text-[#4338CA]" /> Sinkronisasi dengan Google Sheets...
          </div>
        )}

        {error && (
          <div className="mb-4 bg-[#FEF2F2] border border-[#FECACA] p-4 rounded text-sm text-[#B91C1C]">
            <strong>Error:</strong> {error}
          </div>
        )}

        {activeTab === 'grid' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-lg border border-[#E2E8F0]">
              <div>
                <h3 className="text-lg font-serif-title font-semibold">Tabel Pembayaran Kas</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowAddAnggotaModal(true)}
                  className="bg-[#4F46E5] hover:bg-[#4338CA] text-white px-3 py-2 rounded text-sm font-medium transition flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Tambah Anggota
                </button>
                <button
                  onClick={() => setShowAddPertemuanModal(true)}
                  className="bg-white hover:bg-[#EFF6FF] text-[#1E293B] px-3 py-2 rounded text-sm font-medium transition flex items-center gap-1.5 border border-[#6B7280]"
                >
                  <Plus className="w-4 h-4" /> Tambah Pertemuan
                </button>
                <button
                  onClick={() => gasUrl && fetchDataFromGas(gasUrl, false)}
                  disabled={loading}
                  className="bg-white hover:bg-[#EFF6FF] text-[#1E293B] px-3 py-2 rounded text-sm font-medium transition flex items-center gap-1.5 border border-[#6B7280] disabled:opacity-50"
                  title="Refresh data dari Google Sheets"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </button>
              </div>
            </div>

            {/* Grid Table */}
            <div className="bg-white border border-[#E2E8F0] rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto max-h-[70vh]">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="sticky top-0 z-20 bg-[#EFF6FF] text-[#1E293B] border-b border-[#E2E8F0]">
                    <tr>
                      <th className="sticky left-0 z-30 bg-[#EFF6FF] px-4 py-3 font-serif-title border-r border-[#E2E8F0] min-w-[180px]">
                        Nama Anggota
                      </th>
                      {pertemuan.map((pt) => {
                        const warnaHari =
                          pt.hari?.toLowerCase() === 'selasa' ? 'text-[#047857]' :
                          pt.hari?.toLowerCase() === 'kamis' ? 'text-[#4338CA]' :
                          pt.hari?.toLowerCase() === 'sabtu' ? 'text-[#1D4ED8]' :
                          'text-[#475569]';
                        return (
                          <th key={pt.id} className="px-3 py-3 text-center border-r border-[#E2E8F0]/50 min-w-[70px]">
                            <div className={`text-xs font-bold uppercase ${warnaHari}`}>{kapitalisasiHari(pt.hari)}</div>
                            <div className="text-sm font-semibold">{formatTanggalPertemuan(pt.tanggal)}</div>
                            <button
                              onClick={() => handleDeletePertemuan(pt.id, pt.tanggal, pt.hari)}
                              className="mt-1 text-[#64748B] hover:text-[#DC2626] transition block mx-auto"
                              title="Hapus pertemuan"
                            >
                              <Trash2 className="w-3 h-3 inline" />
                            </button>
                          </th>
                        );
                      })}
                      <th className="px-4 py-3 text-center font-serif-title min-w-[100px]">Total Bayar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]/60">
                    {anggota.length === 0 ? (
                      <tr>
                        <td colSpan={pertemuan.length + 2} className="text-center py-8 text-[#64748B]">
                          Belum ada data anggota.
                        </td>
                      </tr>
                    ) : (
                      anggota.map((a, idx) => {
                        const paidCount = pertemuan.filter((pt) => {
                          const p = validPembayaran.find((pay) => String(pay.anggotaId) === String(a.id) && String(pay.pertemuanId) === String(pt.id));
                          return p && p.status;
                        }).length;

                        const bgBaris = idx % 2 === 0 ? 'bg-white' : 'bg-[#EFF6FF]';

                        return (
                          <tr key={a.id} className={`${bgBaris} hover:bg-[#E0E7FF]/60 transition`}>
                            <td className={`sticky left-0 z-10 ${bgBaris} px-4 py-3 font-medium border-r border-[#E2E8F0] flex items-center justify-between gap-2`}>
                              <span className="truncate">{a.nama}</span>
                              <button
                                onClick={() => handleDeleteAnggota(a.id, a.nama)}
                                className="text-[#64748B] hover:text-[#DC2626] p-1 rounded transition"
                                title="Hapus anggota"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                            {pertemuan.map((pt) => {
                              const pay = validPembayaran.find(
                                (p) => String(p.anggotaId) === String(a.id) && String(p.pertemuanId) === String(pt.id)
                              );
                              const isLunas = pay ? Boolean(pay.status) : false;
                              const isToggling = togglingKeys.has(`${a.id}-${pt.id}`);

                              return (
                                <td
                                  key={pt.id}
                                  onClick={() => handleTogglePembayaran(a.id, pt.id)}
                                  className={`text-center p-2 border-r border-[#E2E8F0]/40 cursor-pointer select-none transition ${
                                    isToggling ? 'opacity-60 cursor-wait' : ''
                                  } ${
                                    isLunas
                                      ? 'bg-[#047857]/10 hover:bg-[#047857]/15 text-[#047857] font-bold'
                                      : 'bg-transparent hover:bg-[#EFF6FF] text-[#475569]'
                                  }`}
                                  title="Klik untuk ubah status"
                                >
                                  {isLunas ? (
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-[#047857]/20 text-[#047857] mx-auto">
                                      ✓
                                    </span>
                                  ) : (
                                    <span className="text-[#64748B] text-xs">-</span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="text-center font-bold px-4 py-3 text-[#047857]">
                              {paidCount}/{pertemuan.length}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'rekap' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-lg border border-[#E2E8F0]">
              <div>
                <h3 className="text-lg font-serif-title font-semibold">Panel Rekap & Tunggakan</h3>
                <p className="text-xs text-[#64748B]">Ringkasan keuangan kas dan daftar anggota yang belum lunas.</p>
              </div>
              <button
                onClick={() => gasUrl && fetchDataFromGas(gasUrl, false)}
                disabled={loading}
                className="bg-white hover:bg-[#EFF6FF] text-[#1E293B] px-3 py-2 rounded text-sm font-medium transition flex items-center gap-1.5 border border-[#6B7280] disabled:opacity-50"
                title="Refresh data dari Google Sheets"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border border-[#E2E8F0] p-5 rounded-lg shadow">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-[#64748B]">Total Pemasukan Kas</p>
                  <Wallet className="w-4 h-4 text-[#047857]" />
                </div>
                <p className="text-3xl font-serif-title font-bold text-[#047857] mt-2">
                  Rp {totalKasTerkumpul.toLocaleString('id-ID')}
                </p>
                <p className="text-xs text-[#64748B] mt-1">
                  Dari {totalLunasCount} pembayaran lunas (Rp {pengaturan.nominal.toLocaleString('id-ID')}/sesi)
                </p>
              </div>

              <div className="bg-white border border-[#E2E8F0] p-5 rounded-lg shadow">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-[#64748B]">Total Pengeluaran Kas</p>
                  <Receipt className="w-4 h-4 text-[#B45309]" />
                </div>
                <p className="text-3xl font-serif-title font-bold text-[#B45309] mt-2">
                  Rp {totalPengeluaran.toLocaleString('id-ID')}
                </p>
                <p className="text-xs text-[#64748B] mt-1">
                  Dari {pengeluaran.length} catatan pengeluaran
                </p>
              </div>

              <div className="bg-white border border-[#E2E8F0] p-5 rounded-lg shadow">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-[#64748B]">Saldo Kas Bersih</p>
                  <Scale className={`w-4 h-4 ${saldoKas < 0 ? 'text-[#DC2626]' : 'text-[#047857]'}`} />
                </div>
                <p className={`text-3xl font-serif-title font-bold mt-2 ${saldoKas < 0 ? 'text-[#DC2626]' : 'text-[#047857]'}`}>
                  Rp {saldoKas.toLocaleString('id-ID')}
                </p>
                <p className="text-xs text-[#64748B] mt-1">
                  {saldoKas < 0 ? '⚠️ Saldo kas minus / defisit' : 'Pemasukan - Pengeluaran'}
                </p>
              </div>
            </div>

            <div className="bg-white border border-[#E2E8F0] rounded-lg p-5 shadow">
              <h3 className="text-lg font-serif-title font-semibold mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-[#DC2626]" /> Daftar Anggota dengan Tunggakan
              </h3>
              {tunggakanList.length === 0 ? (
                <div className="text-center py-8 text-[#047857] bg-[#ECFDF5] rounded-lg border border-[#A7F3D0] flex items-center justify-center gap-2 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-[#047857] shrink-0" />
                  <span>Semua anggota sudah lunas. Tidak ada tunggakan untuk periode ini.</span>
                </div>
              ) : (
                <>
                  <div className="mb-4 bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 text-sm">
                    <span className="text-[#1E293B] font-medium">
                      Total Potensi Piutang:
                    </span>
                    <span className="font-bold text-[#DC2626]">
                      Rp {tunggakanList.reduce((acc, curr) => acc + curr.totalTunggakanRupiah, 0).toLocaleString('id-ID')} dari {tunggakanList.length} anggota
                    </span>
                  </div>
                  {/* Mobile: Stacked Card Layout (< md) */}
                  <div className="md:hidden space-y-3">
                    {tunggakanList.map((item) => (
                      <div key={item.id} className="bg-white border border-[#E2E8F0] rounded-lg p-3.5 shadow-sm space-y-2">
                        <div className="flex justify-between items-start gap-2">
                          <span className="font-medium text-[#1E293B] text-sm">{item.nama}</span>
                          <span className="font-bold text-[#DC2626] text-sm whitespace-nowrap">
                            Rp {item.totalTunggakanRupiah.toLocaleString('id-ID')}
                          </span>
                        </div>
                        <div>
                          <span className="inline-block bg-[#FECACA] text-[#7F1D1D] border border-[#FCA5A5] px-2 py-0.5 rounded text-[11px] font-medium whitespace-nowrap">
                            {item.jumlahBelumBayar} pertemuan belum bayar
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop: 3-column Table (md and above) */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-[#E2E8F0] text-[#64748B]">
                          <th className="py-3 px-4">Nama Anggota</th>
                          <th className="py-3 px-4 text-center">Jumlah Belum Bayar</th>
                          <th className="py-3 px-4 text-right">Total Tunggakan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0]/50">
                        {tunggakanList.map((item) => (
                          <tr key={item.id} className="hover:bg-[#E0E7FF]/60">
                            <td className="py-3 px-4 font-medium text-[#1E293B]">{item.nama}</td>
                            <td className="py-3 px-4 text-center">
                              <span className="bg-[#FECACA] text-[#7F1D1D] border border-[#FCA5A5] px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap">
                                {item.jumlahBelumBayar} pertemuan
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-[#DC2626] whitespace-nowrap">
                              Rp {item.totalTunggakanRupiah.toLocaleString('id-ID')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {activeTab === 'riwayat' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-lg border border-[#E2E8F0]">
              <div>
                <h3 className="text-lg font-serif-title font-semibold">Riwayat Pemasukan</h3>
                <p className="text-xs text-[#64748B]">Daftar lengkap seluruh pembayaran kas secara kronologis.</p>
              </div>
              <button
                onClick={() => gasUrl && fetchDataFromGas(gasUrl, false)}
                disabled={loading}
                className="bg-white hover:bg-[#EFF6FF] text-[#1E293B] px-3 py-2 rounded text-sm font-medium transition flex items-center gap-1.5 border border-[#6B7280] disabled:opacity-50"
                title="Refresh data dari Google Sheets"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>
            <div className="bg-white border border-[#E2E8F0] p-5 rounded-lg shadow">
              <p className="text-sm text-[#64748B]">Total Pemasukan Kas</p>
              <p className="text-3xl font-serif-title font-bold text-[#047857] mt-2">
                Rp {totalKasTerkumpul.toLocaleString('id-ID')}
              </p>
              <p className="text-xs text-[#64748B] mt-1">
                Dari {riwayatPemasukanList.length} pembayaran lunas tercatat
              </p>
            </div>

            <div className="bg-white border border-[#E2E8F0] rounded-lg p-5 shadow space-y-4">
              <div>
                <h3 className="text-lg font-serif-title font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[#047857]" /> Riwayat Pemasukan
                </h3>
                <p className="text-xs text-[#64748B] mt-0.5">Daftar lengkap seluruh pembayaran kas secara kronologis.</p>
              </div>

              {riwayatPemasukanList.length === 0 ? (
                <div className="text-center py-8 text-[#64748B] bg-[#F8FAFC] rounded border border-[#E2E8F0]">
                  Belum ada pemasukan tercatat.
                </div>
              ) : (
                <div className="space-y-3">
                  {riwayatPemasukanList.map((item) => (
                    <div 
                      key={item.id} 
                      className="bg-white border border-[#E2E8F0] rounded-lg p-3.5 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2"
                    >
                      <div className="text-[#1E293B] text-sm">
                        <span className="font-bold text-[#4338CA]">{item.nama}</span> bayar pada {item.hari}, {item.tanggal} {pengaturan.periode}
                      </div>
                      <div className="font-bold text-[#047857] text-sm whitespace-nowrap">
                        — Rp {item.nominal.toLocaleString('id-ID')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'pengeluaran' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-lg border border-[#E2E8F0]">
              <div>
                <h3 className="text-lg font-serif-title font-semibold">Daftar Pengeluaran Kas</h3>
                <p className="text-xs text-[#64748B]">Catat dan kelola pengeluaran kas organisasi. Data otomatis tersimpan ke Google Sheets.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowAddPengeluaranModal(true)}
                  className="bg-[#4F46E5] hover:bg-[#4338CA] text-white px-3 py-2 rounded text-sm font-medium transition flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Tambah Pengeluaran
                </button>
                <button
                  onClick={() => gasUrl && fetchDataFromGas(gasUrl, false)}
                  disabled={loading}
                  className="bg-white hover:bg-[#EFF6FF] text-[#1E293B] px-3 py-2 rounded text-sm font-medium transition flex items-center gap-1.5 border border-[#6B7280] disabled:opacity-50"
                  title="Refresh data dari Google Sheets"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </button>
              </div>
            </div>

            <div className="bg-white border border-[#E2E8F0] rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto max-h-[70vh]">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="sticky top-0 z-20 bg-[#EFF6FF] text-[#1E293B] border-b border-[#E2E8F0]">
                    <tr>
                      <th className="px-4 py-3 font-serif-title min-w-[120px]">Tanggal</th>
                      <th className="px-4 py-3 font-serif-title min-w-[250px]">Keterangan</th>
                      <th className="px-4 py-3 font-serif-title text-right min-w-[150px]">Nominal (Rp)</th>
                      <th className="px-4 py-3 font-serif-title text-center min-w-[80px]">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0]/60">
                    {pengeluaran.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-8 text-[#64748B]">
                          Belum ada data pengeluaran kas.
                        </td>
                      </tr>
                    ) : (
                      pengeluaran.map((item, idx) => {
                        const bgBaris = idx % 2 === 0 ? 'bg-white' : 'bg-[#EFF6FF]';
                        return (
                          <tr key={item.id} className={`${bgBaris} hover:bg-[#E0E7FF]/60 transition`}>
                            <td className="px-4 py-3 font-medium text-[#1E293B]">{formatTanggalPengeluaran(item.tanggal)}</td>
                            <td className="px-4 py-3 text-[#1E293B]">{item.keterangan}</td>
                            <td className="px-4 py-3 text-right font-bold text-[#B45309]">
                              Rp {Number(item.nominal || 0).toLocaleString('id-ID')}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => handleDeletePengeluaran(item.id, item.keterangan)}
                                className="text-[#64748B] hover:text-[#DC2626] p-1.5 rounded transition"
                                title="Hapus pengeluaran"
                              >
                                <Trash2 className="w-4 h-4 inline" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'pengaturan' && (
          <div className="max-w-xl mx-auto bg-white border border-[#E2E8F0] rounded-lg p-6 shadow space-y-6">
            <div>
              <h3 className="text-xl font-serif-title font-semibold mb-2 flex items-center gap-2">
                <Settings className="w-5 h-5 text-[#4338CA]" /> Pengaturan Google Apps Script URL
              </h3>
              <p className="text-xs text-[#64748B] mb-4">
                Masukkan URL Web App dari Google Apps Script Anda agar website ini terhubung langsung ke Google Sheets.
              </p>

              <form onSubmit={handleSavePengaturan} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#64748B] mb-1">URL Web App Google Apps Script</label>
                  <input
                    type="url"
                    value={inputGasUrl}
                    onChange={(e) => setInputGasUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="w-full bg-white border border-[#6B7280] rounded px-3 py-2 text-[#1E293B] focus:border-[#4338CA] focus:ring-2 focus:ring-[#4338CA]/30 focus:outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#64748B] mb-1">Nama Periode (Bulan / Tahun)</label>
                  <input
                    type="text"
                    value={editPeriode}
                    onChange={(e) => setEditPeriode(e.target.value)}
                    className="w-full bg-white border border-[#6B7280] rounded px-3 py-2 text-[#1E293B] focus:border-[#4338CA] focus:ring-2 focus:ring-[#4338CA]/30 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#64748B] mb-1">Nominal Kas per Pertemuan (Rp)</label>
                  <input
                    type="number"
                    value={editNominal}
                    onChange={(e) => setEditNominal(Number(e.target.value))}
                    className="w-full bg-white border border-[#6B7280] rounded px-3 py-2 text-[#1E293B] focus:border-[#4338CA] focus:ring-2 focus:ring-[#4338CA]/30 focus:outline-none"
                    min="0"
                    step="1000"
                    required
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full bg-[#4F46E5] hover:bg-[#4338CA] text-white font-medium py-2 px-4 rounded transition shadow flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" /> Simpan & Hubungkan
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Modal Tambah Anggota */}
      {showAddAnggotaModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-lg max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-serif-title font-semibold mb-4">Tambah Anggota Baru</h3>
            <form onSubmit={handleAddAnggota} className="space-y-4">
              <div>
                <label className="block text-sm text-[#64748B] mb-1">Nama Anggota</label>
                <input
                  type="text"
                  value={newAnggotaNama}
                  onChange={(e) => setNewAnggotaNama(e.target.value)}
                  placeholder="contoh: Budi"
                  className="w-full bg-white border border-[#6B7280] rounded px-3 py-2 text-[#1E293B] focus:border-[#4338CA] focus:ring-2 focus:ring-[#4338CA]/30 focus:outline-none"
                  autoFocus
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddAnggotaModal(false)}
                  className="px-4 py-2 bg-white border border-[#6B7280] text-[#475569] rounded hover:bg-[#F8FAFC]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded font-medium"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tambah Pertemuan */}
      {showAddPertemuanModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-lg max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-serif-title font-semibold mb-4">Tambah Pertemuan Baru</h3>
            <form onSubmit={handleAddPertemuan} className="space-y-4">
              <div>
                <label className="block text-sm text-[#64748B] mb-1">Hari</label>
                <select
                  value={newHari}
                  onChange={(e) => setNewHari(e.target.value)}
                  className="w-full bg-white border border-[#6B7280] rounded px-3 py-2 text-[#1E293B] focus:border-[#4338CA] focus:ring-2 focus:ring-[#4338CA]/30 focus:outline-none"
                >
                  <option value="Senin">Senin</option>
                  <option value="Selasa">Selasa</option>
                  <option value="Rabu">Rabu</option>
                  <option value="Kamis">Kamis</option>
                  <option value="Jumat">Jumat</option>
                  <option value="Sabtu">Sabtu</option>
                  <option value="Minggu">Minggu</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-[#64748B] mb-1">Tanggal</label>
                <input
                  type="text"
                  value={newTanggal}
                  onChange={(e) => setNewTanggal(e.target.value)}
                  placeholder="contoh: 3"
                  className="w-full bg-white border border-[#6B7280] rounded px-3 py-2 text-[#1E293B] focus:border-[#4338CA] focus:ring-2 focus:ring-[#4338CA]/30 focus:outline-none"
                  autoFocus
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddPertemuanModal(false)}
                  className="px-4 py-2 bg-white border border-[#6B7280] text-[#475569] rounded hover:bg-[#F8FAFC]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded font-medium"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tambah Pengeluaran */}
      {showAddPengeluaranModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E2E8F0] rounded-lg max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-serif-title font-semibold mb-4">Tambah Pengeluaran Kas</h3>
            <form onSubmit={handleAddPengeluaran} className="space-y-4">
              <div>
                <label className="block text-sm text-[#64748B] mb-1">Tanggal (opsional)</label>
                <input
                  type="text"
                  value={newPengeluaranTanggal}
                  onChange={(e) => setNewPengeluaranTanggal(e.target.value)}
                  placeholder="contoh: 10 Oktober 2026"
                  className="w-full bg-white border border-[#6B7280] rounded px-3 py-2 text-[#1E293B] focus:border-[#4338CA] focus:ring-2 focus:ring-[#4338CA]/30 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm text-[#64748B] mb-1">Keterangan Pengeluaran *</label>
                <input
                  type="text"
                  value={newPengeluaranKeterangan}
                  onChange={(e) => setNewPengeluaranKeterangan(e.target.value)}
                  placeholder="contoh: Konsumsi rapat / Beli ATK"
                  className="w-full bg-white border border-[#6B7280] rounded px-3 py-2 text-[#1E293B] focus:border-[#4338CA] focus:ring-2 focus:ring-[#4338CA]/30 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-[#64748B] mb-1">Nominal (Rp) *</label>
                <input
                  type="number"
                  value={newPengeluaranNominal}
                  onChange={(e) => setNewPengeluaranNominal(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="contoh: 50000"
                  className="w-full bg-white border border-[#6B7280] rounded px-3 py-2 text-[#1E293B] focus:border-[#4338CA] focus:ring-2 focus:ring-[#4338CA]/30 focus:outline-none"
                  min="1"
                  step="1"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddPengeluaranModal(false)}
                  className="px-4 py-2 bg-white border border-[#6B7280] text-[#475569] rounded hover:bg-[#F8FAFC]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#4F46E5] hover:bg-[#4338CA] text-white rounded font-medium"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-[#E2E8F0] py-6 px-4 text-center text-xs text-[#64748B] mt-auto flex flex-col sm:flex-row items-center justify-between max-w-7xl mx-auto w-full gap-2">
        <span>Uang Kas Google Sheets — Dibuat untuk Bendahara & Wakil Bendahara (Internal)</span>
        <span className="flex items-center gap-1.5">
          <Heart className="w-3 h-3 text-[#DC2626]" fill="currentColor" />
          Bersama, lebih mudah
        </span>
      </footer>
    </div>
  );
}
