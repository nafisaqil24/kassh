import html2pdf from 'html2pdf.js';
import { PDFDocument } from 'pdf-lib';

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

/** A4 portrait @96dpi ≈ 210mm; padanan konsisten dengan setup sebelumnya (794px). */
const PORTRAIT_WIDTH = 794;
/** A4 landscape @96dpi ≈ 297mm — target render section Tabel Kas. */
const LANDSCAPE_WIDTH = 1123;

function buildHeaderHtml(data: LaporanPayload, tanggalCetak: string): string {
  return `<header style="text-align:center;margin-bottom:20px;border-bottom:3px solid #141b26;padding-bottom:14px;">
      <div style="font-size:11px;letter-spacing:0.25em;text-transform:uppercase;color:#666;">Laporan Kas</div>
      <h1 style="font-size:26px;font-weight:800;color:#141b26;margin:6px 0 4px;letter-spacing:0.08em;">UANG KAS</h1>
      <div style="display:inline-block;background:#ece6d6;border:1px solid #c9c2b0;padding:4px 14px;border-radius:999px;font-size:12px;font-weight:700;color:#141b26;">${escapeHtml(data.periode)}</div>
      <div style="font-size:11px;color:#666;margin-top:8px;">Nominal kas per pertemuan: <strong>${rupiah(data.nominalPerSesi)}</strong> · Dicetak: ${escapeHtml(tanggalCetak)}</div>
    </header>`;
}

function buildFooterHtml(tanggalCetak: string): string {
  return `<footer style="margin-top:24px;border-top:1px solid #c9c2b0;padding-top:8px;font-size:9px;color:#888;text-align:center;">
      Dokumen dihasilkan otomatis oleh aplikasi Uang Kas · ${escapeHtml(tanggalCetak)}
    </footer>`;
}

function sectionHtml(title: string, bodyHtml: string): string {
  return `<section style="margin:0 0 18px 0;">
      <div style="border-bottom:2px solid #141b26;margin-bottom:8px;padding-bottom:4px;">
        <h2 style="${SECTION_TITLE}">${escapeHtml(title)}</h2>
      </div>
      ${bodyHtml}
    </section>`;
}

function shellOpenHtml(widthPx: number): string {
  return `<div id="kassh-laporan-pdf" style="
    font-family: Georgia, 'Times New Roman', serif;
    background:#ffffff;
    color:#1E2125;
    width:${widthPx}px;
    padding:36px 40px;
    box-sizing:border-box;
    line-height:1.45;
    overflow:visible;
  ">`;
}

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

/** Render 1 (landscape): header + Tabel Kas — konten paling lebar. */
function buildLandscapeReportHtml(data: LaporanPayload, tanggalCetak: string): string {
  return `${shellOpenHtml(LANDSCAPE_WIDTH)}
    ${buildHeaderHtml(data, tanggalCetak)}
    ${sectionHtml('1. Tabel Kas', buildGridHtml(data))}
  </div>`;
}

/** Render 2 (portrait): Rekap & Tunggakan, Riwayat Pemasukan, Pengeluaran + footer. */
function buildPortraitReportHtml(data: LaporanPayload, tanggalCetak: string): string {
  return `${shellOpenHtml(PORTRAIT_WIDTH)}
    ${sectionHtml('2. Rekap & Tunggakan', buildRekapHtml(data))}
    ${sectionHtml('3. Riwayat Pemasukan', buildPemasukanHtml(data))}
    ${sectionHtml('4. Pengeluaran', buildPengeluaranHtml(data))}
    ${buildFooterHtml(tanggalCetak)}
  </div>`;
}

/**
 * Auto-scale: bila lebar konten asli > targetWidth, terapkan
 * CSS transform: scale(rasio) + transform-origin: top left, dan sesuaikan
 * tinggi wrapper supaya area yang ditangkap html2canvas pas (tanpa
 * ruang kosong / bagian bawah kepotong).
 *
 * Catatan: html2canvas.scale = 2 adalah pixel-density (ketajaman gambar),
 * TERPISAH dari CSS transform scale di bawah ini — tidak dikalikan dua kali.
 */
function fitToWidth(el: HTMLElement, wrapper: HTMLElement, targetWidth: number): number {
  el.style.transform = 'none';
  el.style.transformOrigin = 'top left';
  el.style.width = 'auto';
  wrapper.style.width = `${targetWidth}px`;
  wrapper.style.height = 'auto';

  const naturalWidth = Math.max(el.scrollWidth, el.getBoundingClientRect().width);
  const naturalHeight = el.scrollHeight;

  let scale = 1;
  if (naturalWidth > targetWidth) {
    scale = targetWidth / naturalWidth;
    if (scale < 0.5) {
      console.warn(
        `[exportPdf] Rasio auto-scale ${scale.toFixed(2)} < 0.5 — ` +
          `konten jauh lebih lebar dari target ${targetWidth}px (mungkin sulit dibaca di PDF).`
      );
    }
  }

  if (scale < 1) {
    // Kunci lebar layout ke lebar asli sebelum transform agar pengukuran stabil.
    el.style.width = `${naturalWidth}px`;
    el.style.transform = `scale(${scale})`;
    el.style.transformOrigin = 'top left';
    // Tinggi/lebar wrapper = ukuran visual setelah scale → canvas capture pas.
    wrapper.style.width = `${naturalWidth * scale}px`;
    wrapper.style.height = `${naturalHeight * scale}px`;
  } else {
    wrapper.style.width = `${naturalWidth}px`;
    wrapper.style.height = `${naturalHeight}px`;
  }

  return scale;
}

/**
 * Mount HTML ke DOM tersembunyi, auto-scale ke targetWidth, render via
 * html2pdf → ArrayBuffer (tanpa langsung save — hasil digabung pdf-lib).
 */
async function renderToPdfBuffer(
  innerHtml: string,
  targetWidth: number,
  orientation: 'portrait' | 'landscape'
): Promise<ArrayBuffer> {
  const wrapper = document.createElement('div');
  wrapper.style.cssText =
    `position:fixed;left:-10000px;top:0;width:${targetWidth}px;background:#fff;z-index:-1;`;
  wrapper.innerHTML = innerHtml;
  document.body.appendChild(wrapper);

  try {
    const el = wrapper.querySelector<HTMLElement>('#kassh-laporan-pdf');
    if (!el) {
      throw new Error('Gagal merender konten laporan PDF');
    }

    fitToWidth(el, wrapper, targetWidth);

    const buffer = await html2pdf()
      .set({
        margin: [8, 8, 8, 8],
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation },
      })
      .from(el)
      .to('pdf')
      .output('arraybuffer');

    return buffer as ArrayBuffer;
  } finally {
    document.body.removeChild(wrapper);
  }
}

/** Gabung beberapa PDF (arraybuffer) menjadi satu dokumen via pdf-lib. */
async function mergePdfBuffers(buffers: ArrayBuffer[]): Promise<Uint8Array> {
  const merged = await PDFDocument.create();
  for (const buf of buffers) {
    const src = await PDFDocument.load(buf);
    const pages = await merged.copyPages(src, src.getPageIndices());
    for (const page of pages) {
      merged.addPage(page);
    }
  }
  return merged.save();
}

/**
 * Trigger download dengan nama file eksplisit
 * (bukan nama default blob): URL.createObjectURL + <a download="...">.
 */
function downloadPdfBlob(bytes: Uint8Array, filename: string): void {
  // pdf-lib returns Uint8Array; copy into a fresh ArrayBuffer for Blob typing.
  const ab = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
  const blob = new Blob([ab], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Bebutuh waktu agar browser mulai unduhan; revoke setelah jeda pendek.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportLaporanPdf(data: LaporanPayload): Promise<void> {
  const tanggalCetak = formatTanggalCetak(new Date());
  const filename = `Laporan-Kas-${data.periode.replace(/\s+/g, '-')}.pdf`;

  // Render 1: Tabel Kas (landscape, target 1123px)
  const landscapeBuf = await renderToPdfBuffer(
    buildLandscapeReportHtml(data, tanggalCetak),
    LANDSCAPE_WIDTH,
    'landscape'
  );

  // Render 2: Rekap + Pemasukan + Pengeluaran (portrait, target 794px)
  const portraitBuf = await renderToPdfBuffer(
    buildPortraitReportHtml(data, tanggalCetak),
    PORTRAIT_WIDTH,
    'portrait'
  );

  // Gabung → 1 file PDF
  const mergedBytes = await mergePdfBuffers([landscapeBuf, portraitBuf]);

  // Download dengan nama Laporan-Kas-{periode}.pdf
  downloadPdfBlob(mergedBytes, filename);
}
