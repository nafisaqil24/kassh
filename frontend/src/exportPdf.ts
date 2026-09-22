import html2pdf from 'html2pdf.js';

export interface LaporanGridRow {
  nama: string;
  statuses: boolean[];
  totalBayar: string;
}

export interface LaporanKolom {
  hari: string;
  tanggal: string;
}

export interface LaporanTunggakan {
  nama: string;
  jumlahBelumBayar: number;
  totalTunggakanRupiah: number;
}

export interface LaporanPemasukan {
  nama: string;
  hari: string;
  tanggal: string;
  nominal: number;
}

export interface LaporanPengeluaran {
  tanggal: string;
  keterangan: string;
  nominal: number;
}

export interface LaporanPayload {
  periode: string;
  nominalPerSesi: number;
  kolomPertemuan: LaporanKolom[];
  grid: LaporanGridRow[];
  rekap: {
    totalPemasukan: number;
    totalLunasCount: number;
    totalPengeluaran: number;
    jumlahPengeluaran: number;
    saldoKas: number;
  };
  tunggakan: LaporanTunggakan[];
  riwayatPemasukan: LaporanPemasukan[];
  pengeluaran: LaporanPengeluaran[];
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function rupiah(n: number): string {
  return `Rp ${Number(n || 0).toLocaleString('id-ID')}`;
}

function formatTanggalCetak(d: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
}

const SECTION_TITLE =
  'font-size:14px;font-weight:700;color:#141b26;margin:0 0 8px 0;letter-spacing:0.03em;';

const TABLE_STYLE =
  'width:100%;border-collapse:collapse;font-size:11px;color:#1E2125;';

const TH_STYLE =
  'border:1px solid #c9c2b0;background:#ece6d6;padding:6px 8px;text-align:left;font-weight:700;';

const TD_STYLE = 'border:1px solid #d9d3c4;padding:5px 8px;vertical-align:top;';

function buildGridHtml(data: LaporanPayload): string {
  if (data.kolomPertemuan.length === 0) {
    return '<p style="color:#666;font-size:11px;">Belum ada data pertemuan.</p>';
  }

  const headerCells = data.kolomPertemuan
    .map(
      (k) =>
        `<th style="${TH_STYLE};text-align:center;min-width:36px;">${escapeHtml(k.hari)}<br/><span style="font-weight:400;">${escapeHtml(k.tanggal)}</span></th>`
    )
    .join('');

  const rows = data.grid
    .map((row) => {
      const cells = row.statuses
        .map(
          (st) =>
            `<td style="${TD_STYLE};text-align:center;color:${st ? '#0a7a3d' : '#999'};font-weight:700;">${st ? '✓' : '-'}</td>`
        )
        .join('');
      return `<tr><td style="${TD_STYLE};font-weight:600;">${escapeHtml(row.nama)}</td>${cells}<td style="${TD_STYLE};text-align:center;font-weight:700;">${escapeHtml(row.totalBayar)}</td></tr>`;
    })
    .join('');

  return `<table style="${TABLE_STYLE}">
    <thead><tr><th style="${TH_STYLE};min-width:140px;">Nama Anggota</th>${headerCells}<th style="${TH_STYLE};text-align:center;">Total</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function buildRekapHtml(data: LaporanPayload): string {
  const card = (label: string, value: string, color: string, note: string) =>
    `<div style="flex:1;min-width:150px;border:1px solid #d9d3c4;background:#f7f4ec;padding:10px 12px;border-radius:4px;">
      <div style="font-size:10px;color:#666;text-transform:uppercase;letter-spacing:0.05em;">${escapeHtml(label)}</div>
      <div style="font-size:16px;font-weight:700;color:${color};margin-top:4px;">${escapeHtml(value)}</div>
      <div style="font-size:9px;color:#777;margin-top:4px;">${escapeHtml(note)}</div>
    </div>`;

  const cards = `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
    ${card('Total Pemasukan', rupiah(data.rekap.totalPemasukan), '#0a7a3d', `Dari ${data.rekap.totalLunasCount} pembayaran lunas`)}
    ${card('Total Pengeluaran', rupiah(data.rekap.totalPengeluaran), '#a16207', `Dari ${data.rekap.jumlahPengeluaran} catatan`)}
    ${card('Saldo Kas Bersih', rupiah(data.rekap.saldoKas), data.rekap.saldoKas < 0 ? '#b91c1c' : '#0a7a3d', 'Pemasukan − Pengeluaran')}
  </div>`;

  let tunggakanHtml: string;
  if (data.tunggakan.length === 0) {
    tunggakanHtml =
      '<p style="font-size:11px;color:#0a7a3d;background:#ecfdf3;border:1px solid #bbf7d0;padding:8px 10px;border-radius:4px;margin:0;">Semua anggota sudah melunasi seluruh kas pertemuan.</p>';
  } else {
    const rows = data.tunggakan
      .map(
        (t) =>
          `<tr><td style="${TD_STYLE};">${escapeHtml(t.nama)}</td><td style="${TD_STYLE};text-align:center;">${t.jumlahBelumBayar} pertemuan</td><td style="${TD_STYLE};text-align:right;font-weight:700;color:#b91c1c;">${rupiah(t.totalTunggakanRupiah)}</td></tr>`
      )
      .join('');
    tunggakanHtml = `<table style="${TABLE_STYLE}">
      <thead><tr><th style="${TH_STYLE};">Nama Anggota</th><th style="${TH_STYLE};text-align:center;">Belum Bayar</th><th style="${TH_STYLE};text-align:right;">Total Tunggakan</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  return `${cards}<div style="font-size:12px;font-weight:700;color:#141b26;margin:8px 0 6px;">Daftar Tunggakan</div>${tunggakanHtml}`;
}

function buildPemasukanHtml(data: LaporanPayload): string {
  if (data.riwayatPemasukan.length === 0) {
    return '<p style="color:#666;font-size:11px;">Belum ada pemasukan tercatat.</p>';
  }
  const rows = data.riwayatPemasukan
    .map(
      (p) =>
        `<tr><td style="${TD_STYLE};font-weight:600;">${escapeHtml(p.nama)}</td><td style="${TD_STYLE};">${escapeHtml(p.hari)}, ${escapeHtml(p.tanggal)} ${escapeHtml(data.periode)}</td><td style="${TD_STYLE};text-align:right;font-weight:700;color:#0a7a3d;">${rupiah(p.nominal)}</td></tr>`
    )
    .join('');
  return `<table style="${TABLE_STYLE}">
    <thead><tr><th style="${TH_STYLE};">Nama</th><th style="${TH_STYLE};">Waktu Bayar</th><th style="${TH_STYLE};text-align:right;">Nominal</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function buildPengeluaranHtml(data: LaporanPayload): string {
  if (data.pengeluaran.length === 0) {
    return '<p style="color:#666;font-size:11px;">Belum ada data pengeluaran kas.</p>';
  }
  const rows = data.pengeluaran
    .map(
      (p) =>
        `<tr><td style="${TD_STYLE};">${escapeHtml(p.tanggal)}</td><td style="${TD_STYLE};">${escapeHtml(p.keterangan)}</td><td style="${TD_STYLE};text-align:right;font-weight:700;color:#a16207;">${rupiah(p.nominal)}</td></tr>`
    )
    .join('');
  return `<table style="${TABLE_STYLE}">
    <thead><tr><th style="${TH_STYLE};">Tanggal</th><th style="${TH_STYLE};">Keterangan</th><th style="${TH_STYLE};text-align:right;">Nominal</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function buildReportHtml(data: LaporanPayload): string {
  const tanggalCetak = formatTanggalCetak(new Date());
  const section = (title: string, bodyHtml: string, pageBreak = false) =>
    `<section style="margin:0 0 18px 0;${pageBreak ? 'page-break-before:always;' : ''}">
      <div style="border-bottom:2px solid #141b26;margin-bottom:8px;padding-bottom:4px;">
        <h2 style="${SECTION_TITLE}">${escapeHtml(title)}</h2>
      </div>
      ${bodyHtml}
    </section>`;

  return `
  <div id="kassh-laporan-pdf" style="
    font-family: Georgia, 'Times New Roman', serif;
    background:#ffffff;
    color:#1E2125;
    width:794px;
    padding:36px 40px;
    box-sizing:border-box;
    line-height:1.45;
  ">
    <header style="text-align:center;margin-bottom:20px;border-bottom:3px solid #141b26;padding-bottom:14px;">
      <div style="font-size:11px;letter-spacing:0.25em;text-transform:uppercase;color:#666;">Laporan Kas</div>
      <h1 style="font-size:26px;font-weight:800;color:#141b26;margin:6px 0 4px;letter-spacing:0.08em;">UANG KAS</h1>
      <div style="display:inline-block;background:#ece6d6;border:1px solid #c9c2b0;padding:4px 14px;border-radius:999px;font-size:12px;font-weight:700;color:#141b26;">${escapeHtml(data.periode)}</div>
      <div style="font-size:11px;color:#666;margin-top:8px;">Nominal kas per pertemuan: <strong>${rupiah(data.nominalPerSesi)}</strong> · Dicetak: ${escapeHtml(tanggalCetak)}</div>
    </header>

    ${section('1. Tabel Kas', buildGridHtml(data))}
    ${section('2. Rekap & Tunggakan', buildRekapHtml(data), true)}
    ${section('3. Riwayat Pemasukan', buildPemasukanHtml(data), true)}
    ${section('4. Pengeluaran', buildPengeluaranHtml(data))}

    <footer style="margin-top:24px;border-top:1px solid #c9c2b0;padding-top:8px;font-size:9px;color:#888;text-align:center;">
      Dokumen dihasilkan otomatis oleh aplikasi Uang Kas · ${escapeHtml(tanggalCetak)}
    </footer>
  </div>`;
}

export async function exportLaporanPdf(data: LaporanPayload): Promise<void> {
  const wrapper = document.createElement('div');
  wrapper.style.cssText =
    'position:fixed;left:-10000px;top:0;width:794px;background:#fff;z-index:-1;';
  wrapper.innerHTML = buildReportHtml(data);
  document.body.appendChild(wrapper);

  const el = wrapper.querySelector<HTMLElement>('#kassh-laporan-pdf');
  if (!el) {
    document.body.removeChild(wrapper);
    throw new Error('Gagal merender konten laporan PDF');
  }

  const filename = `Laporan-Kas-${data.periode.replace(/\s+/g, '-')}.pdf`;

  try {
    await html2pdf()
      .set({
        margin: [8, 8, 8, 8],
        filename,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      })
      .from(el)
      .save();
  } finally {
    document.body.removeChild(wrapper);
  }
}
