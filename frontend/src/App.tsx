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

  // Toggle Pembayaran (aksi: toggleBayar)
  const handleTogglePembayaran = async (anggotaId: string | number, pertemuanId: string | number) => {
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
    <div className="min-h-screen bg-[#141b26] text-[#ece6d6] flex flex-col">
      {/* Header */}
      <header className="bg-[#1b2433] border-b border-[#2b3748] px-4 py-4 md:px-8 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-[#9c1f1f] text-white px-2 py-0.5 text-xs font-bold rounded">GOOGLE SHEETS DB</span>
              <span className="text-xs text-gray-400">Periode: <strong className="text-[#ece6d6]">{pengaturan.periode}</strong></span>
            </div>
            <h1 className="text-2xl md:text-3xl font-serif-title font-bold tracking-wide mt-1 text-[#ece6d6]">
              Pencatatan Uang Kas
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-[#141b26] border border-[#2b3748] px-4 py-2 rounded-lg text-left">
              <p className="text-xs text-gray-400">Total Terkumpul</p>
              <p className="text-lg font-bold text-emerald-400">
                Rp {totalKasTerkumpul.toLocaleString('id-ID')}
              </p>
            </div>
            <div className="bg-[#141b26] border border-[#2b3748] px-4 py-2 rounded-lg text-left">
              <p className="text-xs text-gray-400">Nominal / Pertemuan</p>
              <p className="text-lg font-bold text-[#ece6d6]">
                Rp {pengaturan.nominal.toLocaleString('id-ID')}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto flex gap-2 mt-4 pt-3 border-t border-[#2b3748]/60 overflow-x-auto">
          <button
            onClick={() => setActiveTab('grid')}
            className={`px-4 py-2 rounded font-medium text-sm transition flex items-center gap-2 ${
              activeTab === 'grid' ? 'bg-[#9c1f1f] text-white shadow' : 'bg-[#141b26] text-gray-300 hover:bg-[#2b3748]'
            }`}
          >
            <Users className="w-4 h-4" /> Tabel Kas ({anggota.length} Anggota)
          </button>
          <button
            onClick={() => setActiveTab('rekap')}
            className={`px-4 py-2 rounded font-medium text-sm transition flex items-center gap-2 ${
              activeTab === 'rekap' ? 'bg-[#9c1f1f] text-white shadow' : 'bg-[#141b26] text-gray-300 hover:bg-[#2b3748]'
            }`}
          >
            <TrendingUp className="w-4 h-4" /> Panel Rekap & Tunggakan ({tunggakanList.length} Nunggak)
          </button>
          <button
            onClick={() => setActiveTab('pengaturan')}
            className={`px-4 py-2 rounded font-medium text-sm transition flex items-center gap-2 ${
              activeTab === 'pengaturan' ? 'bg-[#9c1f1f] text-white shadow' : 'bg-[#141b26] text-gray-300 hover:bg-[#2b3748]'
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
            <RefreshCw className="w-5 h-5 animate-spin text-[#9c1f1f]" /> Sinkronisasi dengan Google Sheets...
          </div>
        )}

        {error && (
          <div className="mb-4 bg-red-950/80 border border-red-800 p-4 rounded text-sm text-red-300">
            <strong>Error:</strong> {error}
          </div>
        )}

        {activeTab === 'grid' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#1b2433] p-4 rounded-lg border border-[#2b3748]">
              <div>
                <h3 className="text-lg font-serif-title font-semibold">Tabel Pembayaran Kas</h3>
                <p className="text-xs text-gray-400">Klik pada kotak sel untuk mengubah status pembayaran. Data otomatis tersimpan ke Google Sheets.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowAddAnggotaModal(true)}
                  className="bg-[#9c1f1f] hover:bg-red-700 text-white px-3 py-2 rounded text-sm font-medium transition flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Tambah Anggota
                </button>
                <button
                  onClick={() => setShowAddPertemuanModal(true)}
                  className="bg-[#2b3748] hover:bg-slate-700 text-[#ece6d6] px-3 py-2 rounded text-sm font-medium transition flex items-center gap-1.5 border border-gray-600"
                >
                  <Plus className="w-4 h-4" /> Tambah Pertemuan
                </button>
              </div>
            </div>

            {/* Grid Table */}
            <div className="bg-[#1b2433] rounded-lg border border-[#2b3748] shadow overflow-hidden">
              <div className="overflow-x-auto max-h-[70vh]">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="sticky top-0 z-20 bg-[#141b26] text-[#ece6d6] border-b border-[#2b3748]">
                    <tr>
                      <th className="sticky left-0 z-30 bg-[#141b26] px-4 py-3 font-serif-title border-r border-[#2b3748] min-w-[180px]">
                        Nama Anggota
                      </th>
                      {pertemuan.map((pt) => (
                        <th key={pt.id} className="px-3 py-3 text-center border-r border-[#2b3748]/50 min-w-[70px]">
                          <div className="text-xs font-bold text-[#9c1f1f]">{pt.hari}</div>
                          <div className="text-sm font-semibold">{pt.tanggal}</div>
                          <button
                            onClick={() => handleDeletePertemuan(pt.id, pt.tanggal, pt.hari)}
                            className="mt-1 text-gray-500 hover:text-red-400 transition block mx-auto"
                            title="Hapus pertemuan"
                          >
                            <Trash2 className="w-3 h-3 inline" />
                          </button>
                        </th>
                      ))}
                      <th className="px-4 py-3 text-center font-serif-title min-w-[100px]">Total Bayar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2b3748]/60">
                    {anggota.length === 0 ? (
                      <tr>
                        <td colSpan={pertemuan.length + 2} className="text-center py-8 text-gray-400">
                          Belum ada data anggota.
                        </td>
                      </tr>
                    ) : (
                      anggota.map((a) => {
                        const paidCount = pertemuan.filter((pt) => {
                          const p = pembayaran.find((pay) => String(pay.anggotaId) === String(a.id) && String(pay.pertemuanId) === String(pt.id));
                          return p && (p.status === true || p.status === 'TRUE' || p.status === 'true');
                        }).length;

                        return (
                          <tr key={a.id} className="hover:bg-[#1e293b]/50 transition">
                            <td className="sticky left-0 z-10 bg-[#1b2433] hover:bg-[#1e293b] px-4 py-3 font-medium border-r border-[#2b3748] flex items-center justify-between gap-2">
                              <span className="truncate">{a.nama}</span>
                              <button
                                onClick={() => handleDeleteAnggota(a.id, a.nama)}
                                className="text-gray-500 hover:text-red-400 p-1 rounded transition"
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
                                  className={`text-center p-2 border-r border-[#2b3748]/40 cursor-pointer select-none transition ${
                                    isLunas
                                      ? 'bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-400 font-bold'
                                      : 'bg-transparent hover:bg-[#2b3748]/30 text-gray-600'
                                  }`}
                                  title="Klik untuk ubah status"
                                >
                                  {isLunas ? (
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-emerald-900/60 text-emerald-300 mx-auto">
                                      ✓
                                    </span>
                                  ) : (
                                    <span className="text-gray-600 text-xs">-</span>
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
              <div className="bg-[#1b2433] border border-[#2b3748] p-5 rounded-lg shadow">
                <p className="text-sm text-gray-400">Total Kas Terkumpul</p>
                <p className="text-3xl font-serif-title font-bold text-emerald-400 mt-2">
                  Rp {totalKasTerkumpul.toLocaleString('id-ID')}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Dari {totalLunasCount} pembayaran lunas (Rp {pengaturan.nominal.toLocaleString('id-ID')}/sesi)
                </p>
              </div>

              <div className="bg-[#1b2433] border border-[#2b3748] p-5 rounded-lg shadow">
                <p className="text-sm text-gray-400">Total Pertemuan</p>
                <p className="text-3xl font-serif-title font-bold text-[#ece6d6] mt-2">
                  {pertemuan.length} Sesi
                </p>
                <p className="text-xs text-gray-500 mt-1">Periode {pengaturan.periode}</p>
              </div>

              <div className="bg-[#1b2433] border border-[#2b3748] p-5 rounded-lg shadow">
                <p className="text-sm text-gray-400">Anggota Belum Lunas Total</p>
                <p className="text-3xl font-serif-title font-bold text-red-400 mt-2">
                  {tunggakanList.length} Orang
                </p>
                <p className="text-xs text-gray-500 mt-1">Memiliki tunggakan kas</p>
              </div>
            </div>

            <div className="bg-[#1b2433] border border-[#2b3748] rounded-lg p-5 shadow">
              <h3 className="text-lg font-serif-title font-semibold mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" /> Daftar Anggota dengan Tunggakan
              </h3>
              {tunggakanList.length === 0 ? (
                <div className="text-center py-8 text-emerald-400 bg-[#141b26]/50 rounded border border-[#2b3748]">
                  🎉 Luar biasa! Semua anggota sudah melunasi seluruh kas pertemuan.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-[#2b3748] text-gray-400">
                        <th className="py-3 px-4">Nama Anggota</th>
                        <th className="py-3 px-4 text-center">Jumlah Belum Bayar</th>
                        <th className="py-3 px-4 text-right">Total Tunggakan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2b3748]/50">
                      {tunggakanList.map((item) => (
                        <tr key={item.id} className="hover:bg-[#1e293b]/50">
                          <td className="py-3 px-4 font-medium text-[#ece6d6]">{item.nama}</td>
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
          <div className="max-w-xl mx-auto bg-[#1b2433] border border-[#2b3748] rounded-lg p-6 shadow space-y-6">
            <div>
              <h3 className="text-xl font-serif-title font-semibold mb-2 flex items-center gap-2">
                <Settings className="w-5 h-5 text-[#9c1f1f]" /> Pengaturan Google Apps Script URL
              </h3>
              <p className="text-xs text-gray-400 mb-4">
                Masukkan URL Web App dari Google Apps Script Anda agar website ini terhubung langsung ke Google Sheets.
              </p>

              <form onSubmit={handleSavePengaturan} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">URL Web App Google Apps Script</label>
                  <input
                    type="url"
                    value={inputGasUrl}
                    onChange={(e) => setInputGasUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="w-full bg-[#141b26] border border-[#2b3748] rounded px-3 py-2 text-[#ece6d6] focus:outline-none focus:border-[#9c1f1f] text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Nama Periode (Bulan / Tahun)</label>
                  <input
                    type="text"
                    value={editPeriode}
                    onChange={(e) => setEditPeriode(e.target.value)}
                    className="w-full bg-[#141b26] border border-[#2b3748] rounded px-3 py-2 text-[#ece6d6] focus:outline-none focus:border-[#9c1f1f]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Nominal Kas per Pertemuan (Rp)</label>
                  <input
                    type="number"
                    value={editNominal}
                    onChange={(e) => setEditNominal(Number(e.target.value))}
                    className="w-full bg-[#141b26] border border-[#2b3748] rounded px-3 py-2 text-[#ece6d6] focus:outline-none focus:border-[#9c1f1f]"
                    min="0"
                    step="1000"
                    required
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full bg-[#9c1f1f] hover:bg-red-700 text-white font-medium py-2 px-4 rounded transition shadow flex items-center justify-center gap-2"
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
          <div className="bg-[#1b2433] border border-[#2b3748] rounded-lg max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-serif-title font-semibold mb-4">Tambah Anggota Baru</h3>
            <form onSubmit={handleAddAnggota} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Nama Anggota</label>
                <input
                  type="text"
                  value={newAnggotaNama}
                  onChange={(e) => setNewAnggotaNama(e.target.value)}
                  placeholder="contoh: Budi"
                  className="w-full bg-[#141b26] border border-[#2b3748] rounded px-3 py-2 text-[#ece6d6] focus:outline-none focus:border-[#9c1f1f]"
                  autoFocus
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddAnggotaModal(false)}
                  className="px-4 py-2 bg-[#141b26] border border-[#2b3748] text-gray-300 rounded hover:bg-[#2b3748]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#9c1f1f] hover:bg-red-700 text-white rounded font-medium"
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
          <div className="bg-[#1b2433] border border-[#2b3748] rounded-lg max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-serif-title font-semibold mb-4">Tambah Pertemuan Baru</h3>
            <form onSubmit={handleAddPertemuan} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Hari</label>
                <select
                  value={newHari}
                  onChange={(e) => setNewHari(e.target.value)}
                  className="w-full bg-[#141b26] border border-[#2b3748] rounded px-3 py-2 text-[#ece6d6] focus:outline-none focus:border-[#9c1f1f]"
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
                <label className="block text-sm text-gray-300 mb-1">Tanggal</label>
                <input
                  type="text"
                  value={newTanggal}
                  onChange={(e) => setNewTanggal(e.target.value)}
                  placeholder="contoh: 3"
                  className="w-full bg-[#141b26] border border-[#2b3748] rounded px-3 py-2 text-[#ece6d6] focus:outline-none focus:border-[#9c1f1f]"
                  autoFocus
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddPertemuanModal(false)}
                  className="px-4 py-2 bg-[#141b26] border border-[#2b3748] text-gray-300 rounded hover:bg-[#2b3748]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#9c1f1f] hover:bg-red-700 text-white rounded font-medium"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-[#1b2433] border-t border-[#2b3748] py-4 text-center text-xs text-gray-400 mt-auto">
        Uang Kas Google Sheets — Dibuat untuk Bendahara & Wakil Bendahara (Internal)
      </footer>
    </div>
  );
}
