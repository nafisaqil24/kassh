// ===== KONFIGURASI =====
var SHEET_ANGGOTA = 'Anggota';
var SHEET_PERTEMUAN = 'Pertemuan';
var SHEET_PEMBAYARAN = 'Pembayaran';
var SHEET_PENGATURAN = 'Pengaturan';
var SHEET_PENGELUARAN = 'Pengeluaran';

/**
 * Helper: Membaca 1 sheet menjadi array of object berdasarkan header baris pertama.
 */
function sheetToObjects(sheetName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length === 0) return [];
  var headers = data[0];
  var rows = data.slice(1);
  return rows
    .filter(function(row) { return row[0] !== ''; }) // Skip baris kosong
    .map(function(row) {
      var obj = {};
      headers.forEach(function(h, i) { 
        if (h) obj[String(h).trim()] = row[i]; 
      });
      return obj;
    });
}

/**
 * Helper: Mencari indeks kolom berdasarkan nama header (case-insensitive & mengabaikan spasi).
 * Fallback ke defaultIndex jika tidak ditemukan.
 */
function getColumnIndex(sheet, headerName, defaultIndex) {
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) return defaultIndex;
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var target = String(headerName).toLowerCase().replace(/\s+/g, '');
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i]).toLowerCase().replace(/\s+/g, '');
    if (h === target) {
      return i + 1; // 1-based index
    }
  }
  return defaultIndex;
}

/**
 * GET: Mengambil seluruh data kas (Anggota, Pertemuan, Pembayaran, Pengaturan).
 */
function doGet(e) {
  try {
    var anggota = sheetToObjects(SHEET_ANGGOTA);
    var pertemuan = sheetToObjects(SHEET_PERTEMUAN);
    var pembayaran = sheetToObjects(SHEET_PEMBAYARAN);
    var pengeluaran = sheetToObjects(SHEET_PENGELUARAN);
    var pengaturanRaw = sheetToObjects(SHEET_PENGATURAN);

    var pengaturan = {};
    pengaturanRaw.forEach(function(row) { 
      var k = row.key || row.Key || row.KEY;
      var v = row.value || row.Value || row.VALUE;
      if (k) pengaturan[k] = v; 
    });

    var result = {
      anggota: anggota,
      pertemuan: pertemuan,
      pembayaran: pembayaran,
      pengeluaran: pengeluaran,
      pengaturan: pengaturan
    };

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * POST: Menangani semua aksi tulis data dengan LockService dan Try/Catch.
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000); // Tunggu lock hingga 20 detik
    
    var body = JSON.parse(e.postData.contents);
    var action = body.action;
    var result = { success: true };

    if (action === 'toggleBayar') {
      toggleBayar(body.anggotaId, body.pertemuanId, body.status);
    } else if (action === 'tambahAnggota') {
      tambahAnggota(body.nama);
    } else if (action === 'hapusAnggota') {
      hapusAnggota(body.id);
    } else if (action === 'tambahPertemuan') {
      tambahPertemuan(body.hari, body.tanggal);
    } else if (action === 'hapusPertemuan') {
      hapusPertemuan(body.id);
    } else if (action === 'updatePengaturan') {
      updatePengaturan(body.key, body.value);
    } else if (action === 'tambahPengeluaran') {
      tambahPengeluaran(body.tanggal, body.keterangan, body.nominal);
    } else if (action === 'hapusPengeluaran') {
      hapusPengeluaran(body.id);
    } else {
      result = { success: false, error: 'Aksi tidak dikenali' };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    try {
      lock.releaseLock();
    } catch (lockErr) {
      // Abaikan error release lock
    }
  }
}

/**
 * Aksi: Toggle status pembayaran dengan deduplikasi baris duplikat.
 */
function toggleBayar(anggotaId, pertemuanId, statusParam) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PEMBAYARAN);
  if (!sheet) throw new Error('Sheet Pembayaran tidak ditemukan');
  
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    // Belum ada data, append baru
    var targetVal = (typeof statusParam === 'boolean') ? statusParam : true;
    var newId = 'pay' + new Date().getTime();
    sheet.appendRow([newId, String(anggotaId), String(pertemuanId), targetVal]);
    return;
  }

  var colAnggota = getColumnIndex(sheet, 'anggotaId', 2);
  var colPertemuan = getColumnIndex(sheet, 'pertemuanId', 3);
  var colStatus = getColumnIndex(sheet, 'status', 4);

  var matchingRows = [];
  for (var i = 1; i < data.length; i++) {
    var rowAnggota = String(data[i][colAnggota - 1]);
    var rowPertemuan = String(data[i][colPertemuan - 1]);
    if (rowAnggota === String(anggotaId) && rowPertemuan === String(pertemuanId)) {
      matchingRows.push(i + 1); // 1-based row index
    }
  }

  var targetStatus;
  if (typeof statusParam === 'boolean') {
    targetStatus = statusParam;
  } else if (matchingRows.length > 0) {
    var firstCurrentStatus = Boolean(sheet.getRange(matchingRows[0], colStatus).getValue());
    targetStatus = !firstCurrentStatus;
  } else {
    targetStatus = true;
  }

  if (matchingRows.length > 0) {
    // Set status baris pertama yang cocok
    sheet.getRange(matchingRows[0], colStatus).setValue(targetStatus);
    
    // Hapus duplikat lainnya dari bawah ke atas agar indeks tidak bergeser
    for (var j = matchingRows.length - 1; j >= 1; j--) {
      sheet.deleteRow(matchingRows[j]);
    }
  } else {
    // Belum ada, buat baru
    var newId = 'pay' + new Date().getTime();
    var newRow = [];
    newRow[0] = newId;
    newRow[colAnggota - 1] = String(anggotaId);
    newRow[colPertemuan - 1] = String(pertemuanId);
    newRow[colStatus - 1] = targetStatus;
    sheet.appendRow(newRow);
  }
}

/**
 * Aksi: Menambah anggota baru.
 */
function tambahAnggota(nama) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ANGGOTA);
  if (!sheet) throw new Error('Sheet Anggota tidak ditemukan');
  var newId = 'a' + new Date().getTime();
  sheet.appendRow([newId, String(nama)]);
}

/**
 * Aksi: Menghapus anggota beserta seluruh riwayat pembayarannya.
 */
function hapusAnggota(id) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetAnggota = ss.getSheetByName(SHEET_ANGGOTA);
  if (!sheetAnggota) throw new Error('Sheet Anggota tidak ditemukan');
  
  var dataAnggota = sheetAnggota.getDataRange().getValues();
  for (var i = 1; i < dataAnggota.length; i++) {
    if (String(dataAnggota[i][0]) === String(id)) {
      sheetAnggota.deleteRow(i + 1);
      break;
    }
  }

  // Hapus juga pembayaran terkait
  var sheetBayar = ss.getSheetByName(SHEET_PEMBAYARAN);
  if (sheetBayar) {
    var dataBayar = sheetBayar.getDataRange().getValues();
    var colAnggota = getColumnIndex(sheetBayar, 'anggotaId', 2);
    for (var j = dataBayar.length; j >= 2; j--) {
      if (String(dataBayar[j - 1][colAnggota - 1]) === String(id)) {
        sheetBayar.deleteRow(j);
      }
    }
  }
}

/**
 * Aksi: Menambah jadwal pertemuan baru.
 */
function tambahPertemuan(hari, tanggal) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PERTEMUAN);
  if (!sheet) throw new Error('Sheet Pertemuan tidak ditemukan');
  var newId = 'p' + new Date().getTime();
  sheet.appendRow([newId, String(hari), String(tanggal)]);
}

/**
 * Aksi: Menghapus pertemuan beserta seluruh riwayat pembayarannya.
 */
function hapusPertemuan(id) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetPertemuan = ss.getSheetByName(SHEET_PERTEMUAN);
  if (!sheetPertemuan) throw new Error('Sheet Pertemuan tidak ditemukan');
  
  var dataPertemuan = sheetPertemuan.getDataRange().getValues();
  for (var i = 1; i < dataPertemuan.length; i++) {
    if (String(dataPertemuan[i][0]) === String(id)) {
      sheetPertemuan.deleteRow(i + 1);
      break;
    }
  }

  // Hapus juga pembayaran terkait
  var sheetBayar = ss.getSheetByName(SHEET_PEMBAYARAN);
  if (sheetBayar) {
    var dataBayar = sheetBayar.getDataRange().getValues();
    var colPertemuan = getColumnIndex(sheetBayar, 'pertemuanId', 3);
    for (var j = dataBayar.length; j >= 2; j--) {
      if (String(dataBayar[j - 1][colPertemuan - 1]) === String(id)) {
        sheetBayar.deleteRow(j);
      }
    }
  }
}

/**
 * Aksi: Memperbarui atau menambahkan konfigurasi (periode, nominal).
 */
function updatePengaturan(key, value) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PENGATURAN);
  if (!sheet) throw new Error('Sheet Pengaturan tidak ditemukan');
  
  var data = sheet.getDataRange().getValues();
  var found = false;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(key)) {
      sheet.getRange(i + 1, 2).setValue(value);
      found = true;
      break;
    }
  }
  
  if (!found) {
    sheet.appendRow([String(key), value]);
  }
}

/**
 * Utilitas Manual: Membersihkan duplikat pembayaran dan baris yatim.
 */
function bersihkanDuplikatPembayaran() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheetAnggota = ss.getSheetByName(SHEET_ANGGOTA);
    var sheetPertemuan = ss.getSheetByName(SHEET_PERTEMUAN);
    var sheetBayar = ss.getSheetByName(SHEET_PEMBAYARAN);

    if (!sheetBayar) {
      Logger.log('Sheet Pembayaran tidak ditemukan.');
      return;
    }

    var validAnggotaIds = {};
    if (sheetAnggota) {
      var dataA = sheetAnggota.getDataRange().getValues();
      for (var a = 1; a < dataA.length; a++) {
        validAnggotaIds[String(dataA[a][0])] = true;
      }
    }

    var validPertemuanIds = {};
    if (sheetPertemuan) {
      var dataP = sheetPertemuan.getDataRange().getValues();
      for (var p = 1; p < dataP.length; p++) {
        validPertemuanIds[String(dataP[p][0])] = true;
      }
    }

    var dataBayar = sheetBayar.getDataRange().getValues();
    if (dataBayar.length <= 1) {
      Logger.log('Tidak ada data pembayaran untuk dibersihkan.');
      return;
    }

    var colAnggota = getColumnIndex(sheetBayar, 'anggotaId', 2);
    var colPertemuan = getColumnIndex(sheetBayar, 'pertemuanId', 3);
    var colStatus = getColumnIndex(sheetBayar, 'status', 4);

    var map = {}; // key: "anggotaId-pertemuanId", value: { rowIndex, status }
    var rowsToDelete = [];

    // Iterasi dari bawah ke atas atau dari atas untuk analisis
    for (var i = 1; i < dataBayar.length; i++) {
      var rowIndex = i + 1;
      var angId = String(dataBayar[i][colAnggota - 1]);
      var pertId = String(dataBayar[i][colPertemuan - 1]);
      var st = Boolean(dataBayar[i][colStatus - 1]);

      // Cek baris yatim
      if (!validAnggotaIds[angId] || !validPertemuanIds[pertId]) {
        rowsToDelete.push(rowIndex);
        continue;
      }

      var key = angId + '-' + pertId;
      if (map[key]) {
        // Duplikat ditemukan
        if (st && !map[key].status) {
          // Status true menang, tandai baris lama untuk dihapus dan update map ke baris ini
          rowsToDelete.push(map[key].rowIndex);
          map[key] = { rowIndex: rowIndex, status: st };
        } else {
          // Baris ini yang dihapus
          rowsToDelete.push(rowIndex);
        }
      } else {
        map[key] = { rowIndex: rowIndex, status: st };
      }
    }

    // Urutkan baris yang akan dihapus dari besar ke kecil agar indeks tidak bergeser
    rowsToDelete.sort(function(a, b) { return b - a; });

    // Hapus baris duplikat/yatim
    for (var d = 0; d < rowsToDelete.length; d++) {
      sheetBayar.deleteRow(rowsToDelete[d]);
    }

    Logger.log('Pembersihan selesai. Total baris duplikat/yatim yang dihapus: ' + rowsToDelete.length);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Aksi: Menambah pengeluaran kas.
 */
function tambahPengeluaran(tanggal, keterangan, nominal) {
  if (!keterangan || String(keterangan).trim() === '') {
    throw new Error('Keterangan pengeluaran wajib diisi');
  }
  var nom = Number(nominal);
  if (isNaN(nom) || nom <= 0) {
    throw new Error('Nominal pengeluaran harus lebih besar dari 0');
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_PENGELUARAN);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_PENGELUARAN);
    sheet.appendRow(['id', 'tanggal', 'keterangan', 'nominal']);
    // Pastikan formatting/background hanya diterapkan pada baris header (row 1), TIDAK pada baris data/kosong di bawahnya
    sheet.getRange(1, 1, 1, 4).setBackground('#ece6d6').setFontWeight('bold');
  }
  var newId = 'x' + new Date().getTime();
  
  var lastRow = sheet.getLastRow();
  if (lastRow > 0) {
    var colTanggal = getColumnIndex(sheet, 'tanggal', 2);
    sheet.getRange(lastRow + 1, colTanggal).setNumberFormat('@');
  }
  
  sheet.appendRow([newId, String(tanggal || ''), String(keterangan).trim(), nom]);
}

/**
 * Aksi: Menghapus pengeluaran berdasarkan ID.
 */
function hapusPengeluaran(id) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_PENGELUARAN);
  if (!sheet) throw new Error('Sheet Pengeluaran tidak ditemukan');
  
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) {
      sheet.deleteRow(i + 1);
      return;
    }
  }
  throw new Error('Data pengeluaran dengan ID tersebut tidak ditemukan');
}
