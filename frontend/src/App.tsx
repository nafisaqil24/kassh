import React, { useState, useEffect } from 'react';
import { 
  Users, Settings, Plus, Trash2, AlertCircle, 
  TrendingUp, RefreshCw, CheckCircle2
} from 'lucide-react';

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
  status: boolean | string;
}

interface Pengaturan {
  periode: string;
  nominal: number;
}

export default function App() {
  const APP_PASSWORD = 'PSHTJAYA';

  const [gasUrl, setGasUrl] = useState<string>(() => {
    return localStorage.getItem('gas_web_app_url') || '';
  });

  const [anggota, setAnggota] = useState<Anggota[]>([]);
  const [pertemuan, setPertemuan] = useState<Pertemuan[]>([]);
  const [pembayaran, setPembayaran] = useState<Pembayaran[]>([]);
  const [pengaturan, setPengaturan] = useState<Pengaturan>({ periode: 'Oktober 2026', nominal: 10000 });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'grid' | 'rekap' | 'pengaturan'>('grid');
  const [showAddAnggotaModal, setShowAddAnggotaModal] = useState(false);
  const [showAddPertemuanModal, setShowAddPertemuanModal] = useState(false);
  
  const [newAnggotaNama, setNewAnggotaNama] = useState('');
  const [newHari, setNewHari] = useState('Kamis');
  const [newTanggal, setNewTanggal] = useState('');

  const [editPeriode, setEditPeriode] = useState('Oktober 2026');
  const [editNominal, setEditNominal] = useState(10000);
  const [inputGasUrl, setInputGasUrl] = useState('');

  useEffect(() => {
    setInputGasUrl(gasUrl);
    if (gasUrl) {
      fetchDataFromGas(gasUrl);
    }
  }, [gasUrl]);

  // Auto-refresh data setiap 30 detik selama URL Apps Script sudah terhubung
  useEffect(() => {
    if (!gasUrl) return;

    const interval = setInterval(() => {
      fetchDataFromGas(gasUrl);
    }, 30000); // 30000 ms = 30 detik

    return () => clearInterval(interval);
  }, [gasUrl]);

  const fetchDataFromGas = async (url: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${url}?action=getData`);
      if (!res.ok) throw new Error('Gagal terhubung ke Google Apps Script');
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);

      setAnggota(data.anggota || []);
      setPertemuan(data.pertemuan || []);
      setPembayaran(data.pembayaran || []);
      if (data.pengaturan) {
        setPengaturan({
          periode: data.pengaturan.periode || 'Oktober 2026',
          nominal: Number(data.pengaturan.nominal || 10000)
        });
        setEditPeriode(data.pengaturan.periode || 'Oktober 2026');
        setEditNominal(Number(data.pengaturan.nominal || 10000));
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat memuat data dari Google Sheets.');
    } finally {
      setLoading(false);
    }
  };

  const callGasApi = async (action: string, payload: any = {}) => {
    if (!gasUrl) {
      alert('Mohon masukkan URL Google Apps Script Web App di tab Pengaturan terlebih dahulu.');
      setActiveTab('pengaturan');
      return null;
    }

    try {
      const res = await fetch(gasUrl, {
        method: 'POST',
        body: JSON.stringify({ action, ...payload }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      });
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      return result;
    } catch (err: any) {
      console.error('GAS API Error:', err);
      throw err;
    }
  };

  // Minta password sebelum melakukan perubahan data
  const mintaPassword = (): boolean => {
    const input = prompt('Masukkan password untuk melakukan perubahan:');
    if (input === null) return false; // user klik Cancel
    if (input !== APP_PASSWORD) {
      alert('Password salah!');
      return false;
    }
    return true;
  };

  // Toggle Pembayaran (aksi: toggleBayar)
  const handleTogglePembayaran = async (anggotaId: string | number, pertemuanId: string | number) => {
    if (!mintaPassword()) return;
    const current = pembayaran.find(
      (p) => String(p.anggotaId) === String(anggotaId) && String(p.pertemuanId) === String(pertemuanId)
    );
    const currentStatus = current ? (current.status === true || current.status === 'TRUE' || current.status === 'true') : false;
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

    if (!gasUrl) return;

    try {
      await callGasApi('toggleBayar', { anggotaId, pertemuanId });
    } catch (err) {
      fetchDataFromGas(gasUrl); // rollback
    }
  };

  // Add Anggota (aksi: tambahAnggota)
  const handleAddAnggota = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mintaPassword()) return;
    if (!newAnggotaNama.trim()) return;

    if (!gasUrl) {
      const newId = 'a' + Date.now();
      setAnggota(prev => [...prev, { id: newId, nama: newAnggotaNama.trim() }]);
      setNewAnggotaNama('');
      setShowAddAnggotaModal(false);
      return;
    }

    try {
      setLoading(true);
      await callGasApi('tambahAnggota', { nama: newAnggotaNama.trim() });
      await fetchDataFromGas(gasUrl);
      setNewAnggotaNama('');
      setShowAddAnggotaModal(false);
    } catch (err: any) {
      alert('Gagal menambah anggota: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete Anggota (aksi: hapusAnggota)
  const handleDeleteAnggota = async (id: string | number, nama: string) => {
    if (!mintaPassword()) return;
    if (!confirm(`Hapus anggota ${nama}?`)) return;

    if (!gasUrl) {
      setAnggota(prev => prev.filter(a => a.id !== id));
      return;
    }

    try {
      setLoading(true);
      await callGasApi('hapusAnggota', { id });
      await fetchDataFromGas(gasUrl);
    } catch (err: any) {
      alert('Gagal menghapus anggota: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Add Pertemuan (aksi: tambahPertemuan)
  const handleAddPertemuan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mintaPassword()) return;
    if (!newHari.trim() || !newTanggal.trim()) return;

    if (!gasUrl) {
      const newId = 'p' + Date.now();
      setPertemuan(prev => [...prev, { id: newId, hari: newHari, tanggal: newTanggal.trim() }]);
      setNewTanggal('');
      setShowAddPertemuanModal(false);
      return;
    }

    try {
      setLoading(true);
      await callGasApi('tambahPertemuan', { hari: newHari, tanggal: newTanggal.trim() });
      await fetchDataFromGas(gasUrl);
      setNewTanggal('');
      setShowAddPertemuanModal(false);
    } catch (err: any) {
      alert('Gagal menambah pertemuan: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete Pertemuan (aksi: hapusPertemuan)
  const handleDeletePertemuan = async (id: string | number, tanggal: string, hari: string) => {
    if (!mintaPassword()) return;
    if (!confirm(`Hapus pertemuan hari ${hari} tanggal ${tanggal}?`)) return;

    if (!gasUrl) {
      setPertemuan(prev => prev.filter(p => p.id !== id));
      return;
    }

    try {
      setLoading(true);
      await callGasApi('hapusPertemuan', { id });
      await fetchDataFromGas(gasUrl);
    } catch (err: any) {
      alert('Gagal menghapus pertemuan: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Save Pengaturan (aksi: updatePengaturan)
  const handleSavePengaturan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mintaPassword()) return;
    const newConfig = { periode: editPeriode, nominal: Number(editNominal) };
    setPengaturan(newConfig);
    localStorage.setItem('gas_web_app_url', inputGasUrl.trim());
    setGasUrl(inputGasUrl.trim());

    if (inputGasUrl.trim()) {
      try {
        setLoading(true);
        await callGasApi('updatePengaturan', { key: 'periode', value: editPeriode });
        await callGasApi('updatePengaturan', { key: 'nominal', value: editNominal });
        alert('Pengaturan berhasil disimpan ke Google Sheets!');
        await fetchDataFromGas(inputGasUrl.trim());
      } catch (err: any) {
        alert('Gagal menyimpan ke Google Sheets: ' + err.message);
      } finally {
        setLoading(false);
      }
    } else {
      alert('Pengaturan lokal disimpan.');
    }
  };

  // Calculations
  const totalLunasCount = pembayaran.filter((p) => p.status === true || p.status === 'TRUE' || p.status === 'true').length;
  const totalKasTerkumpul = totalLunasCount * pengaturan.nominal;

  const tunggakanList = anggota.map((a) => {
    const belumBayar = pertemuan.filter((pt) => {
      const p = pembayaran.find((pay) => String(pay.anggotaId) === String(a.id) && String(pay.pertemuanId) === String(pt.id));
      return !p || (p.status !== true && p.status !== 'TRUE' && p.status !== 'true');
    });
    return {
      ...a,
      jumlahBelumBayar: belumBayar.length,
      totalTunggakanRupiah: belumBayar.length * pengaturan.nominal,
    };
  }).filter((a) => a.jumlahBelumBayar > 0);

  return (
    <div className="min-h-screen bg-[#1E2125] text-[#ECE6D8] flex flex-col">
      {/* Header */}
      <header className="bg-[#2F343B] border-b border-[#383D44] px-4 py-4 md:px-8 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-1.5 self-stretch bg-[#C9A882] rounded-full hidden md:block"></div>
            <div>
              <h1 className="text-3xl md:text-4xl font-serif-title font-bold tracking-widest text-[#ECE6D8]">
                UANG KAS
              </h1>
              <div className="flex items-center gap-3 mt-2">
                <span className="bg-[#C9A882] text-[#1E2125] px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wide">
                  {pengaturan.periode}
                </span>
                <span className="text-xs text-[#8C9199] uppercase tracking-wide">Selasa / Kamis / Sabtu</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <img src="logo-psht.png" alt="Logo PSHT" className="h-16 w-16 object-contain" />
            <div className="flex gap-6">
              <div className="text-center">
                <p className="text-2xl md:text-3xl font-bold text-[#ECE6D8]">{anggota.length.toString().padStart(2, '0')}</p>
                <p className="text-xs text-[#8C9199] uppercase tracking-wide">Siswa</p>
              </div>
              <div className="text-center">
                <p className="text-2xl md:text-3xl font-bold text-[#ECE6D8]">{pertemuan.length.toString().padStart(2, '0')}</p>
                <p className="text-xs text-[#8C9199] uppercase tracking-wide">Pertemuan</p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto flex gap-2 mt-4 pt-3 border-t border-[#383D44] overflow-x-auto">
          <button
            onClick={() => setActiveTab('grid')}
            className={`px-4 py-2 rounded font-medium text-sm transition flex items-center gap-2 ${
              activeTab === 'grid' ? 'bg-[#C9A882] text-[#1E2125] shadow' : 'bg-[#1E2125] text-[#8C9199] hover:bg-[#383D44]'
            }`}
          >
            <Users className="w-4 h-4" /> Tabel Kas ({anggota.length} Anggota)
          </button>
          <button
            onClick={() => setActiveTab('rekap')}
            className={`px-4 py-2 rounded font-medium text-sm transition flex items-center gap-2 ${
              activeTab === 'rekap' ? 'bg-[#C9A882] text-[#1E2125] shadow' : 'bg-[#1E2125] text-[#8C9199] hover:bg-[#383D44]'
            }`}
          >
            <TrendingUp className="w-4 h-4" /> Panel Rekap & Tunggakan ({tunggakanList.length} Nunggak)
          </button>
          <button
            onClick={() => setActiveTab('pengaturan')}
            className={`px-4 py-2 rounded font-medium text-sm transition flex items-center gap-2 ${
              activeTab === 'pengaturan' ? 'bg-[#C9A882] text-[#1E2125] shadow' : 'bg-[#1E2125] text-[#8C9199] hover:bg-[#383D44]'
            }`}
          >
            <Settings className="w-4 h-4" /> Pengaturan & URL Sheets {gasUrl ? '🟢' : '🔴'}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8">
        {!gasUrl && activeTab !== 'pengaturan' && (
          <div className="mb-6 bg-amber-950/60 border border-amber-800/80 p-4 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-bold text-amber-300 mb-1">URL Google Apps Script Belum Dimasukkan!</p>
              <p className="text-amber-200/80 mb-2">
                Aplikasi belum terhubung ke Google Sheets Anda. Silakan masukkan URL Web App Apps Script di tab Pengaturan.
              </p>
              <button
                onClick={() => setActiveTab('pengaturan')}
                className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded font-medium text-xs transition"
              >
                Buka Pengaturan Sekarang
              </button>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-6 text-gray-400 gap-2 mb-4">
            <RefreshCw className="w-5 h-5 animate-spin text-[#C9A882]" /> Sinkronisasi dengan Google Sheets...
          </div>
        )}

        {error && (
          <div className="mb-4 bg-red-950/80 border border-red-800 p-4 rounded text-sm text-red-300">
            <strong>Error:</strong> {error}
          </div>
        )}

        {activeTab === 'grid' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#2B3036] p-4 rounded-lg border border-[#383D44]">
              <div>
                <h3 className="text-lg font-serif-title font-semibold">Tabel Pembayaran Kas</h3>
                <p className="text-xs text-[#8C9199]">Klik pada kotak sel untuk mengubah status pembayaran. Data otomatis tersimpan ke Google Sheets.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowAddAnggotaModal(true)}
                  className="bg-[#C9A882] hover:bg-[#b8996f] text-[#1E2125] px-3 py-2 rounded text-sm font-medium transition flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Tambah Anggota
                </button>
                <button
                  onClick={() => setShowAddPertemuanModal(true)}
                  className="bg-[#383D44] hover:bg-[#4A5058] text-[#ECE6D8] px-3 py-2 rounded text-sm font-medium transition flex items-center gap-1.5 border border-[#4A5058]"
                >
                  <Plus className="w-4 h-4" /> Tambah Pertemuan
                </button>
              </div>
            </div>

            {/* Grid Table */}
            <div className="bg-[#2B3036] rounded-lg border border-[#383D44] shadow overflow-hidden">
              <div className="overflow-x-auto max-h-[70vh]">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="sticky top-0 z-20 bg-[#2F343B] text-[#ECE6D8] border-b border-[#383D44]">
                    <tr>
                      <th className="sticky left-0 z-30 bg-[#2F343B] px-4 py-3 font-serif-title border-r border-[#383D44] min-w-[180px]">
                        Nama Anggota
                      </th>
                      {pertemuan.map((pt) => {
                        const warnaHari =
                          pt.hari?.toLowerCase() === 'selasa' ? 'text-[#93A98F]' :
                          pt.hari?.toLowerCase() === 'kamis' ? 'text-[#C9A882]' :
                          pt.hari?.toLowerCase() === 'sabtu' ? 'text-[#8DA6B8]' :
                          'text-[#8C9199]';
                        return (
                          <th key={pt.id} className="px-3 py-3 text-center border-r border-[#383D44]/50 min-w-[70px]">
                            <div className={`text-xs font-bold uppercase ${warnaHari}`}>{pt.hari}</div>
                            <div className="text-sm font-semibold">{pt.tanggal}</div>
                            <button
                              onClick={() => handleDeletePertemuan(pt.id, pt.tanggal, pt.hari)}
                              className="mt-1 text-[#8C9199] hover:text-red-400 transition block mx-auto"
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
                  <tbody className="divide-y divide-[#383D44]/60">
                    {anggota.length === 0 ? (
                      <tr>
                        <td colSpan={pertemuan.length + 2} className="text-center py-8 text-[#8C9199]">
                          Belum ada data anggota.
                        </td>
                      </tr>
                    ) : (
                      anggota.map((a, idx) => {
                        const paidCount = pertemuan.filter((pt) => {
                          const p = pembayaran.find((pay) => String(pay.anggotaId) === String(a.id) && String(pay.pertemuanId) === String(pt.id));
                          return p && (p.status === true || p.status === 'TRUE' || p.status === 'true');
                        }).length;

                        const bgBaris = idx % 2 === 0 ? 'bg-[#262A2F]' : 'bg-[#2B3036]';

                        return (
                          <tr key={a.id} className={`${bgBaris} hover:bg-[#383D44]/40 transition`}>
                            <td className={`sticky left-0 z-10 ${bgBaris} px-4 py-3 font-medium border-r border-[#383D44] flex items-center justify-between gap-2`}>
                              <span className="truncate">{a.nama}</span>
                              <button
                                onClick={() => handleDeleteAnggota(a.id, a.nama)}
                                className="text-[#8C9199] hover:text-red-400 p-1 rounded transition"
                                title="Hapus anggota"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                            {pertemuan.map((pt) => {
                              const pay = pembayaran.find(
                                (p) => String(p.anggotaId) === String(a.id) && String(p.pertemuanId) === String(pt.id)
                              );
                              const isLunas = pay ? (pay.status === true || pay.status === 'TRUE' || pay.status === 'true') : false;

                              return (
                                <td
                                  key={pt.id}
                                  onClick={() => handleTogglePembayaran(a.id, pt.id)}
                                  className={`text-center p-2 border-r border-[#383D44]/40 cursor-pointer select-none transition ${
                                    isLunas
                                      ? 'bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-400 font-bold'
                                      : 'bg-transparent hover:bg-[#383D44]/30 text-[#8C9199]'
                                  }`}
                                  title="Klik untuk ubah status"
                                >
                                  {isLunas ? (
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-emerald-900/60 text-emerald-300 mx-auto">
                                      ✓
                                    </span>
                                  ) : (
                                    <span className="text-[#8C9199] text-xs">-</span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="text-center font-bold px-4 py-3 text-emerald-400">
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#2B3036] border border-[#383D44] p-5 rounded-lg shadow">
                <p className="text-sm text-[#8C9199]">Total Kas Terkumpul</p>
                <p className="text-3xl font-serif-title font-bold text-emerald-400 mt-2">
                  Rp {totalKasTerkumpul.toLocaleString('id-ID')}
                </p>
                <p className="text-xs text-[#8C9199] mt-1">
                  Dari {totalLunasCount} pembayaran lunas (Rp {pengaturan.nominal.toLocaleString('id-ID')}/sesi)
                </p>
              </div>

              <div className="bg-[#2B3036] border border-[#383D44] p-5 rounded-lg shadow">
                <p className="text-sm text-[#8C9199]">Total Pertemuan</p>
                <p className="text-3xl font-serif-title font-bold text-[#ECE6D8] mt-2">
                  {pertemuan.length} Sesi
                </p>
                <p className="text-xs text-[#8C9199] mt-1">Periode {pengaturan.periode}</p>
              </div>

              <div className="bg-[#2B3036] border border-[#383D44] p-5 rounded-lg shadow">
                <p className="text-sm text-[#8C9199]">Anggota Belum Lunas Total</p>
                <p className="text-3xl font-serif-title font-bold text-red-400 mt-2">
                  {tunggakanList.length} Orang
                </p>
                <p className="text-xs text-[#8C9199] mt-1">Memiliki tunggakan kas</p>
              </div>
            </div>

            <div className="bg-[#2B3036] border border-[#383D44] rounded-lg p-5 shadow">
              <h3 className="text-lg font-serif-title font-semibold mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" /> Daftar Anggota dengan Tunggakan
              </h3>
              {tunggakanList.length === 0 ? (
                <div className="text-center py-8 text-emerald-400 bg-[#1E2125]/50 rounded border border-[#383D44]">
                  🎉 Luar biasa! Semua anggota sudah melunasi seluruh kas pertemuan.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-[#383D44] text-[#8C9199]">
                        <th className="py-3 px-4">Nama Anggota</th>
                        <th className="py-3 px-4 text-center">Jumlah Belum Bayar</th>
                        <th className="py-3 px-4 text-right">Total Tunggakan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#383D44]/50">
                      {tunggakanList.map((item) => (
                        <tr key={item.id} className="hover:bg-[#383D44]/40">
                          <td className="py-3 px-4 font-medium text-[#ECE6D8]">{item.nama}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="bg-red-950/60 text-red-400 border border-red-900/50 px-2.5 py-1 rounded-full text-xs font-bold">
                              {item.jumlahBelumBayar} pertemuan
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-red-400">
                            Rp {item.totalTunggakanRupiah.toLocaleString('id-ID')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'pengaturan' && (
          <div className="max-w-xl mx-auto bg-[#2B3036] border border-[#383D44] rounded-lg p-6 shadow space-y-6">
            <div>
              <h3 className="text-xl font-serif-title font-semibold mb-2 flex items-center gap-2">
                <Settings className="w-5 h-5 text-[#C9A882]" /> Pengaturan Google Apps Script URL
              </h3>
              <p className="text-xs text-[#8C9199] mb-4">
                Masukkan URL Web App dari Google Apps Script Anda agar website ini terhubung langsung ke Google Sheets.
              </p>

              <form onSubmit={handleSavePengaturan} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[#8C9199] mb-1">URL Web App Google Apps Script</label>
                  <input
                    type="url"
                    value={inputGasUrl}
                    onChange={(e) => setInputGasUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="w-full bg-[#1E2125] border border-[#383D44] rounded px-3 py-2 text-[#ECE6D8] focus:outline-none focus:border-[#C9A882] text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#8C9199] mb-1">Nama Periode (Bulan / Tahun)</label>
                  <input
                    type="text"
                    value={editPeriode}
                    onChange={(e) => setEditPeriode(e.target.value)}
                    className="w-full bg-[#1E2125] border border-[#383D44] rounded px-3 py-2 text-[#ECE6D8] focus:outline-none focus:border-[#C9A882]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[#8C9199] mb-1">Nominal Kas per Pertemuan (Rp)</label>
                  <input
                    type="number"
                    value={editNominal}
                    onChange={(e) => setEditNominal(Number(e.target.value))}
                    className="w-full bg-[#1E2125] border border-[#383D44] rounded px-3 py-2 text-[#ECE6D8] focus:outline-none focus:border-[#C9A882]"
                    min="0"
                    step="1000"
                    required
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full bg-[#C9A882] hover:bg-[#b8996f] text-[#1E2125] font-medium py-2 px-4 rounded transition shadow flex items-center justify-center gap-2"
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
          <div className="bg-[#2B3036] border border-[#383D44] rounded-lg max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-serif-title font-semibold mb-4">Tambah Anggota Baru</h3>
            <form onSubmit={handleAddAnggota} className="space-y-4">
              <div>
                <label className="block text-sm text-[#8C9199] mb-1">Nama Anggota</label>
                <input
                  type="text"
                  value={newAnggotaNama}
                  onChange={(e) => setNewAnggotaNama(e.target.value)}
                  placeholder="contoh: Budi"
                  className="w-full bg-[#1E2125] border border-[#383D44] rounded px-3 py-2 text-[#ECE6D8] focus:outline-none focus:border-[#C9A882]"
                  autoFocus
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddAnggotaModal(false)}
                  className="px-4 py-2 bg-[#1E2125] border border-[#383D44] text-[#8C9199] rounded hover:bg-[#383D44]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#C9A882] hover:bg-[#b8996f] text-[#1E2125] rounded font-medium"
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
          <div className="bg-[#2B3036] border border-[#383D44] rounded-lg max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-serif-title font-semibold mb-4">Tambah Pertemuan Baru</h3>
            <form onSubmit={handleAddPertemuan} className="space-y-4">
              <div>
                <label className="block text-sm text-[#8C9199] mb-1">Hari</label>
                <select
                  value={newHari}
                  onChange={(e) => setNewHari(e.target.value)}
                  className="w-full bg-[#1E2125] border border-[#383D44] rounded px-3 py-2 text-[#ECE6D8] focus:outline-none focus:border-[#C9A882]"
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
                <label className="block text-sm text-[#8C9199] mb-1">Tanggal</label>
                <input
                  type="text"
                  value={newTanggal}
                  onChange={(e) => setNewTanggal(e.target.value)}
                  placeholder="contoh: 3"
                  className="w-full bg-[#1E2125] border border-[#383D44] rounded px-3 py-2 text-[#ECE6D8] focus:outline-none focus:border-[#C9A882]"
                  autoFocus
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddPertemuanModal(false)}
                  className="px-4 py-2 bg-[#1E2125] border border-[#383D44] text-[#8C9199] rounded hover:bg-[#383D44]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#C9A882] hover:bg-[#b8996f] text-[#1E2125] rounded font-medium"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-[#2B3036] border-t border-[#383D44] py-4 text-center text-xs text-[#8C9199] mt-auto">
        Uang Kas Google Sheets — Dibuat untuk Bendahara & Wakil Bendahara (Internal)
      </footer>
    </div>
  );
}