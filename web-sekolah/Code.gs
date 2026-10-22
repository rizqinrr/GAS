/**
 * =====================================================================
 * WEBSITE SEKOLAH - SD NEGERI SEMANU III
 * Google Apps Script (Web App) + Google Sheets sebagai database
 * ---------------------------------------------------------------------
 * Dibuat untuk keperluan tugas "Analisis Kebutuhan Website".
 * Seluruh data awal di file ini adalah DATA CONTOH (dummy), bukan data
 * resmi sekolah. Silakan ganti isi spreadsheet setelah dijalankan.
 *
 * Langkah pakai singkat:
 *   1. Tempel file ini ke Code.gs di editor Apps Script.
 *   2. Tambahkan file HTML: Index, Styles, JavaScript.
 *   3. Jalankan setupDatabase() satu kali, izinkan akses.
 *   4. Deploy > New deployment > Web app.
 *
 * Versi: 1.2.0
 * =====================================================================
 */

var APP = {
  nama: 'SD Negeri Semanu III',
  versi: '1.2.0',
  timezone: 'Asia/Jakarta',
  dbName: 'DB - Website SD Negeri Semanu III',
  dbFolderId: '',
  cacheKey: 'BOOTSTRAP_V1',
  cacheSeconds: 120,
  maxPesanPerJam: 3
};

var SCHEMA = {
  Profil: ['kunci', 'nilai'],
  Pengumuman: ['id', 'tanggal', 'judul', 'kategori', 'ringkasan', 'isi', 'penting'],
  Agenda: ['id', 'tanggal_mulai', 'tanggal_selesai', 'judul', 'kategori', 'lokasi', 'deskripsi'],
  Kalender: ['id', 'tanggal', 'judul', 'jenis', 'keterangan'],
  Prestasi: ['id', 'tanggal', 'nama', 'kelas', 'lomba', 'tingkat', 'juara', 'deskripsi'],
  Galeri: ['id', 'tanggal', 'judul', 'kategori', 'tipe', 'media_url', 'deskripsi'],
  Guru: ['id', 'nama', 'nip', 'jabatan', 'mapel'],
  Fasilitas: ['id', 'nama', 'deskripsi'],
  Program: ['id', 'nama', 'deskripsi'],
  PPDB: ['kunci', 'nilai'],
  Pesan: ['timestamp', 'nama', 'email', 'telepon', 'subjek', 'pesan', 'status'],
  Log: ['timestamp', 'aksi', 'entitas', 'id', 'detail']
};

var ADMIN = {
  sessionSeconds: 21600,
  maxLoginFails: 5,
  loginFailSeconds: 900,
  tokenPrefix: 'ADMIN_TOKEN_',
  logSheet: 'Log'
};

/* =====================================================================
 * WEB APP
 * ===================================================================== */

function doGet(e) {
  var params = (e && e.parameter) || {};

  try {
    ensureDatabase_();
  } catch (err) {
    console.error('ensureDatabase_ gagal: ' + err.message + '\n' + (err.stack || ''));
  }

  if (params.page === 'admin') {
    return HtmlService.createTemplateFromFile('Admin')
      .evaluate()
      .setTitle('Admin - ' + APP.nama)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  var template = HtmlService.createTemplateFromFile('Index');
  template.tahun = new Date().getFullYear();

  return template
    .evaluate()
    .setTitle(APP.nama + ' - Website Resmi')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/* =====================================================================
 * DATABASE: pembuatan otomatis + pembacaan data
 * ===================================================================== */

function ensureDatabase_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('DB_ID');

  if (id) {
    try {
      return SpreadsheetApp.openById(id);
    } catch (err) {
      props.deleteProperty('DB_ID');
    }
  }

  return SpreadsheetApp.openById(setupDatabase().id);
}

/**
 * Membuat spreadsheet database beserta seluruh sheet dan data contoh.
 * Aman dijalankan berulang: kalau database sudah ada, tidak dibuat ulang.
 */
function setupDatabase() {
  var props = PropertiesService.getScriptProperties();
  var existingId = props.getProperty('DB_ID');

  if (existingId) {
    try {
      var existing = SpreadsheetApp.openById(existingId);
      ensureSheets_(existing);
      moveDbToFolder_(existing);
      Logger.log('Database sudah tersedia: ' + existing.getUrl());
      return { created: false, id: existing.getId(), url: existing.getUrl() };
    } catch (err) {
      props.deleteProperty('DB_ID');
    }
  }

  var ss = SpreadsheetApp.create(APP.dbName);

  Object.keys(SCHEMA).forEach(function (name) {
    buildSheet_(ss, name);
  });
  seedData_(ss);
  removeExtraSheets_(ss);
  moveDbToFolder_(ss);

  props.setProperty('DB_ID', ss.getId());
  invalidateCache_();

  Logger.log('Database baru dibuat: ' + ss.getUrl());
  return { created: true, id: ss.getId(), url: ss.getUrl() };
}

function showDatabaseUrl() {
  var ss = ensureDatabase_();
  Logger.log(ss.getUrl());
  return ss.getUrl();
}

/**
 * Menghapus cache data agar perubahan spreadsheet langsung tampil.
 * Jalankan fungsi ini dari editor setelah mengedit sheet.
 */
function refreshCache() {
  invalidateCache_();
  Logger.log('Cache dibersihkan. Muat ulang halaman web app.');
}

/**
 * Menampilkan informasi database di Execution log: akun, URL spreadsheet,
 * folder penyimpanan, dan daftar sheet. Berguna saat database "tidak ketemu".
 */
function cekDatabase() {
  var ss = ensureDatabase_();
  var sheets = ss.getSheets().map(function (sheet) {
    return sheet.getName();
  });
  var folder = dbFolder_();

  Logger.log('Akun: ' + Session.getEffectiveUser().getEmail());
  Logger.log('Spreadsheet: ' + ss.getUrl());
  Logger.log('Folder: ' + (folder ? folder.getName() + ' - ' + folder.getUrl() : '(My Drive / root)'));
  Logger.log('Jumlah sheet: ' + sheets.length + ' -> ' + sheets.join(', '));
  return ss.getUrl();
}

/**
 * Menentukan folder database. Prioritas:
 *   1. Script Property DB_FOLDER_ID
 *   2. Konstanta APP.dbFolderId
 *   3. Folder tempat project Apps Script berada
 *   4. null (My Drive)
 */
function dbFolder_() {
  var props = PropertiesService.getScriptProperties();
  var folderId = folderIdFrom_(props.getProperty('DB_FOLDER_ID') || APP.dbFolderId);

  if (folderId) {
    try {
      return DriveApp.getFolderById(folderId);
    } catch (err) {
      Logger.log('Folder database tidak ditemukan: ' + err.message);
    }
  }

  try {
    var parents = DriveApp.getFileById(ScriptApp.getScriptId()).getParents();
    if (parents.hasNext()) {
      return parents.next();
    }
  } catch (err) {
    Logger.log('Tidak bisa membaca folder project: ' + err.message);
  }

  return null;
}

function moveDbToFolder_(ss) {
  var folder;
  try {
    folder = dbFolder_();
  } catch (err) {
    Logger.log('Gagal menentukan folder database: ' + err.message);
    return false;
  }

  if (!folder) {
    Logger.log('Folder tujuan tidak ditemukan; database tetap di My Drive.');
    return false;
  }

  try {
    var file = DriveApp.getFileById(ss.getId());
    var parents = file.getParents();

    while (parents.hasNext()) {
      if (parents.next().getId() === folder.getId()) {
        return true;
      }
    }

    file.moveTo(folder);
    Logger.log('Database dipindahkan ke folder: ' + folder.getName());
    return true;
  } catch (err) {
    Logger.log('Gagal memindahkan database: ' + err.message);
    return false;
  }
}

/**
 * Memindahkan database ke folder tertentu.
 * Jalankan dari editor: aturFolderDatabase('ID_FOLDER')
 * atau tempel URL folder: aturFolderDatabase('https://drive.google.com/drive/folders/...').
 * Jalankan aturFolderDatabase('') untuk kembali ke default.
 */
function aturFolderDatabase(folderId) {
  var id = folderIdFrom_(folderId);
  var props = PropertiesService.getScriptProperties();

  if (!id) {
    props.deleteProperty('DB_FOLDER_ID');
    var current = ensureDatabase_();
    moveDbToFolder_(current);
    Logger.log('Pengaturan folder dihapus. Database mengikuti folder project (atau My Drive).');
    Logger.log('Spreadsheet: ' + current.getUrl());
    return current.getUrl();
  }

  var folder = DriveApp.getFolderById(id);
  props.setProperty('DB_FOLDER_ID', id);

  var ss = ensureDatabase_();
  moveDbToFolder_(ss);

  Logger.log('Folder database: ' + folder.getName() + ' - ' + folder.getUrl());
  Logger.log('Spreadsheet: ' + ss.getUrl());
  return ss.getUrl();
}

function folderIdFrom_(value) {
  var str = String(value == null ? '' : value).trim();
  var match = str.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : str;
}

function ensureSheets_(ss) {
  Object.keys(SCHEMA).forEach(function (name) {
    if (!ss.getSheetByName(name)) {
      buildSheet_(ss, name);
    }
  });
}

function buildSheet_(ss, name) {
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  var headers = SCHEMA[name];

  sheet.clear();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setFontColor('#ffffff')
    .setBackground('#11543f')
    .setVerticalAlignment('middle');
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 32);
  sheet.setColumnWidths(1, headers.length, 170);

  return sheet;
}

function removeExtraSheets_(ss) {
  var allowed = Object.keys(SCHEMA);
  ss.getSheets().forEach(function (sheet) {
    if (allowed.indexOf(sheet.getName()) === -1) {
      ss.deleteSheet(sheet);
    }
  });
}

function invalidateCache_() {
  try {
    CacheService.getScriptCache().remove(APP.cacheKey);
  } catch (err) {
    // diamkan saja
  }
}

function readSheet_(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = buildSheet_(ss, name);
  }

  var values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return [];
  }

  var headers = values.shift().map(function (h) {
    return String(h).trim();
  });

  return values
    .filter(function (row) {
      return row.some(function (cell) {
        return cell !== '';
      });
    })
    .map(function (row) {
      var obj = {};
      headers.forEach(function (header, index) {
        var cell = row[index];
        if (cell instanceof Date) {
          obj[header] = Utilities.formatDate(cell, APP.timezone, 'yyyy-MM-dd');
        } else {
          obj[header] = cell == null ? '' : String(cell).trim();
        }
      });
      return obj;
    });
}

function keyValue_(rows) {
  var map = {};
  rows.forEach(function (row) {
    if (row.kunci) {
      map[row.kunci] = row.nilai;
    }
  });
  return map;
}

function sortDateDesc_(rows, key) {
  return rows.sort(function (a, b) {
    return String(b[key] || '').localeCompare(String(a[key] || ''));
  });
}

function sortDateAsc_(rows, key) {
  return rows.sort(function (a, b) {
    return String(a[key] || '').localeCompare(String(b[key] || ''));
  });
}

/* =====================================================================
 * API untuk client (dipanggil lewat google.script.run)
 * ===================================================================== */

function getBootstrapData() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get(APP.cacheKey);

  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (err) {
      // cache rusak, lanjut baca ulang
    }
  }

  var ss = ensureDatabase_();

  var data = {
    profil: keyValue_(readSheet_(ss, 'Profil')),
    ppdb: keyValue_(readSheet_(ss, 'PPDB')),
    pengumuman: readSheet_(ss, 'Pengumuman'),
    agenda: readSheet_(ss, 'Agenda'),
    kalender: readSheet_(ss, 'Kalender'),
    prestasi: readSheet_(ss, 'Prestasi'),
    galeri: readSheet_(ss, 'Galeri'),
    guru: readSheet_(ss, 'Guru'),
    fasilitas: readSheet_(ss, 'Fasilitas'),
    program: readSheet_(ss, 'Program'),
    meta: {
      versi: APP.versi,
      generatedAt: Utilities.formatDate(new Date(), APP.timezone, 'yyyy-MM-dd HH:mm:ss'),
      jumlahGuru: 0
    }
  };

  data.meta.jumlahGuru = data.guru.length;

  data.pengumuman.sort(function (a, b) {
    var pinnedA = a.penting === 'Ya' ? 1 : 0;
    var pinnedB = b.penting === 'Ya' ? 1 : 0;
    if (pinnedA !== pinnedB) return pinnedB - pinnedA;
    return String(b.tanggal).localeCompare(String(a.tanggal));
  });

  sortDateAsc_(data.agenda, 'tanggal_mulai');
  sortDateAsc_(data.kalender, 'tanggal');
  sortDateDesc_(data.prestasi, 'tanggal');
  sortDateDesc_(data.galeri, 'tanggal');

  try {
    cache.put(APP.cacheKey, JSON.stringify(data), APP.cacheSeconds);
  } catch (err) {
    // ukuran cache melebihi batas: abaikan
  }

  return data;
}

function submitPesan(payload) {
  try {
    var data = payload || {};
    var nama = text_(data.nama, 80);
    var email = text_(data.email, 120);
    var telepon = text_(data.telepon, 30);
    var subjek = text_(data.subjek, 120);
    var pesan = text_(data.pesan, 1500);

    if (nama.length < 3) {
      return { ok: false, message: 'Nama minimal 3 karakter.' };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return { ok: false, message: 'Format email belum benar.' };
    }
    if (pesan.length < 10) {
      return { ok: false, message: 'Isi pesan minimal 10 karakter.' };
    }

    var cache = CacheService.getScriptCache();
    var limitKey = 'PESAN_' + email.toLowerCase();
    var jumlah = Number(cache.get(limitKey) || 0);

    if (jumlah >= APP.maxPesanPerJam) {
      return {
        ok: false,
        message: 'Terlalu banyak pesan dari email ini. Silakan coba lagi satu jam kemudian.'
      };
    }
    cache.put(limitKey, String(jumlah + 1), 3600);

    var ss = ensureDatabase_();
    var sheet = ss.getSheetByName('Pesan') || buildSheet_(ss, 'Pesan');

    sheet.appendRow([
      Utilities.formatDate(new Date(), APP.timezone, 'yyyy-MM-dd HH:mm:ss'),
      cell_(nama),
      cell_(email),
      cell_(telepon),
      cell_(subjek),
      cell_(pesan),
      'Baru'
    ]);
    SpreadsheetApp.flush();
    invalidateCache_();

    return {
      ok: true,
      message: 'Terima kasih, pesan Anda sudah terkirim. Petugas akan membalas melalui email.'
    };
  } catch (err) {
    return { ok: false, message: 'Pesan gagal dikirim: ' + err.message };
  }
}

function text_(value, max) {
  var str = String(value == null ? '' : value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim();

  if (max && str.length > max) {
    str = str.slice(0, max);
  }
  return str;
}

function cell_(value) {
  var str = text_(value, 2000).replace(/\r\n/g, '\n');
  return /^[=+\-@]/.test(str) ? "'" + str : str;
}

/* =====================================================================
 * ADMIN: auth + CRUD
 * ===================================================================== */

var ADMIN_ENTITIES = {
  Pengumuman: { idPrefix: 'P-', required: ['tanggal', 'judul'], dateFields: ['tanggal'] },
  Agenda: { idPrefix: 'A-', required: ['tanggal_mulai', 'judul'], dateFields: ['tanggal_mulai', 'tanggal_selesai'] },
  Kalender: { idPrefix: 'K-', required: ['tanggal', 'judul'], dateFields: ['tanggal'] },
  Prestasi: { idPrefix: 'PR-', required: ['tanggal', 'nama'], dateFields: ['tanggal'] },
  Galeri: { idPrefix: 'G-', required: ['tanggal', 'judul'], dateFields: ['tanggal'] },
  Guru: { idPrefix: 'GURU-', required: ['nama'], dateFields: [] },
  Fasilitas: { idPrefix: 'F-', required: ['nama'], dateFields: [] },
  Program: { idPrefix: 'PRG-', required: ['nama'], dateFields: [] }
};

/**
 * Dipanggil sekali dari editor Apps Script untuk mengatur password admin.
 * Password disimpan sebagai SHA-256 hash + salt, bukan teks asli.
 */
function setAdminPassword(password) {
  var str = String(password == null ? '' : password);
  if (str.length < 6) {
    throw new Error('Password minimal 6 karakter.');
  }
  var props = PropertiesService.getScriptProperties();
  var salt = Utilities.getUuid();
  props.setProperty('ADMIN_SALT', salt);
  props.setProperty('ADMIN_HASH', hashAdminPassword_(salt, str));
  logAdmin_('set_password', 'Admin', '', 'Password admin diperbarui.');
  Logger.log('Password admin tersimpan. Login di /exec?page=admin');
  return 'Password admin tersimpan.';
}

function adminLogin(password) {
  var props = PropertiesService.getScriptProperties();
  var storedHash = props.getProperty('ADMIN_HASH');
  var storedSalt = props.getProperty('ADMIN_SALT');
  var cache = CacheService.getScriptCache();
  var failKey = 'ADMIN_LOGIN_FAILS';

  var fails = Number(cache.get(failKey) || 0);
  if (fails >= ADMIN.maxLoginFails) {
    logAdmin_('login_diblokir', 'Admin', '', 'Terlalu banyak percobaan gagal.');
    return {
      ok: false,
      message: 'Terlalu banyak percobaan gagal. Coba lagi sekitar ' +
        Math.ceil(ADMIN.loginFailSeconds / 60) + ' menit.'
    };
  }

  if (!storedHash || !storedSalt) {
    return { ok: false, message: 'Password admin belum diatur. Jalankan setAdminPassword dari editor.' };
  }

  var attempt = hashAdminPassword_(storedSalt, String(password == null ? '' : password));
  if (!safeEqual_(attempt, storedHash)) {
    cache.put(failKey, String(fails + 1), ADMIN.loginFailSeconds);
    logAdmin_('login_gagal', 'Admin', '', 'Password salah.');
    return { ok: false, message: 'Password salah (percobaan ' + (fails + 1) + '/' + ADMIN.maxLoginFails + ').' };
  }

  cache.remove(failKey);
  var token = Utilities.getUuid();
  cache.put(ADMIN.tokenPrefix + token, '1', ADMIN.sessionSeconds);
  logAdmin_('login', 'Admin', '', 'Login berhasil.');
  return { ok: true, token: token, expiresInHours: ADMIN.sessionSeconds / 3600 };
}

function adminLogout(token) {
  CacheService.getScriptCache().remove(ADMIN.tokenPrefix + String(token || ''));
  return { ok: true };
}

function adminSession(token) {
  try {
    adminGuard_(token);
    return { ok: true };
  } catch (err) {
    return { ok: false };
  }
}

function adminGuard_(token) {
  var value = CacheService.getScriptCache().get(ADMIN.tokenPrefix + String(token || ''));
  if (!value) {
    throw new Error('Sesi admin berakhir. Silakan login ulang.');
  }
}

function hashAdminPassword_(salt, password) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salt + ':' + password,
    Utilities.Charset.UTF_8
  );
  return bytes.map(function (b) {
    var hex = (b & 0xff).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

function safeEqual_(a, b) {
  if (String(a).length !== String(b).length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function logAdmin_(aksi, entitas, id, detail) {
  try {
    var ss = ensureDatabase_();
    var sheet = ss.getSheetByName(ADMIN.logSheet) || buildSheet_(ss, ADMIN.logSheet);
    sheet.appendRow([
      Utilities.formatDate(new Date(), APP.timezone, 'yyyy-MM-dd HH:mm:ss'),
      text_(aksi, 60),
      text_(entitas, 60),
      text_(id, 80),
      text_(detail, 900)
    ]);
  } catch (err) {
    // logging tidak boleh mengganggu operasi utama
  }
}

/** Mengembalikan daftar data satu entitas (termasuk Profil, PPDB, Pesan). */
function adminList(entity, token) {
  adminGuard_(token);

  var name = String(entity || '');
  if (!SCHEMA[name]) {
    throw new Error('Entitas tidak dikenal: ' + name);
  }

  var ss = ensureDatabase_();
  var table = readTable_(ss, name);
  return { entity: name, headers: table.headers, rows: rowsToObjects_(name, table.headers, table.entries) };
}

/** Create bila record.id kosong, Update bila record.id terisi. */
function adminSave(entity, record, token) {
  adminGuard_(token);

  var name = String(entity || '');
  var spec = ADMIN_ENTITIES[name];
  if (!spec) {
    throw new Error('Entitas ini tidak bisa disimpan lewat admin: ' + name);
  }

  var data = record && typeof record === 'object' ? record : {};
  var errors = validateEntity_(spec, data);
  if (errors.length) {
    throw new Error(errors.join(' '));
  }

  var ss = ensureDatabase_();
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var sheet = ss.getSheetByName(name) || buildSheet_(ss, name);
    var headers = SCHEMA[name];
    var values = sheet.getDataRange().getValues();
    var rowValues = headers.map(function (header) {
      return cell_(text_(data[header], 3000));
    });
    var idValue = text_(data.id, 60);

    var rowIndex = idValue ? findRowByIndex_(values, idValue) : -1;
    if (idValue && rowIndex === -1) {
      throw new Error('ID "' + idValue + '" tidak ditemukan di sheet ' + name + '.');
    }

    var created = rowIndex === -1;
    var savedId;

    if (created) {
      savedId = nextId_(values, spec.idPrefix);
      rowValues[0] = savedId;
      sheet.appendRow(rowValues);
    } else {
      savedId = idValue;
      sheet.getRange(rowIndex, 1, 1, headers.length).setValues([rowValues]);
    }

    invalidateCache_();
    logAdmin_(created ? 'tambah' : 'ubah', name, savedId, text_(data.judul || data.nama, 200));

    return { ok: true, created: created, id: savedId };
  } finally {
    lock.releaseLock();
  }
}

/** Delete permanen; salinan baris disimpan di sheet Log. */
function adminDelete(entity, id, token) {
  adminGuard_(token);

  var name = String(entity || '');
  if (!ADMIN_ENTITIES[name]) {
    throw new Error('Entitas ini tidak bisa dihapus lewat admin: ' + name);
  }

  var idValue = text_(id, 60);
  if (!idValue) {
    throw new Error('ID tidak boleh kosong.');
  }

  var ss = ensureDatabase_();
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      throw new Error('Sheet tidak ditemukan: ' + name);
    }

    var values = sheet.getDataRange().getValues();
    var rowIndex = findRowByIndex_(values, idValue);
    if (rowIndex === -1) {
      throw new Error('ID "' + idValue + '" tidak ditemukan.');
    }

    var backup = values[rowIndex - 1].join(' | ');
    logAdmin_('hapus', name, idValue, backup);
    sheet.deleteRow(rowIndex);
    invalidateCache_();

    return { ok: true, id: idValue };
  } finally {
    lock.releaseLock();
  }
}

/** Simpan banyak kunci/nilai sekaligus untuk sheet Profil dan PPDB. */
function adminSaveKV(entity, rows, token) {
  adminGuard_(token);

  var name = String(entity || '');
  if (name !== 'Profil' && name !== 'PPDB') {
    throw new Error('Entitas key-value tidak dikenal: ' + name);
  }
  if (!rows || !Array.isArray(rows)) {
    throw new Error('Data harus berupa daftar kunci/nilai.');
  }

  var ss = ensureDatabase_();
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var sheet = ss.getSheetByName(name) || buildSheet_(ss, name);
    var values = sheet.getDataRange().getValues();
    var keyRow = {};

    for (var i = 1; i < values.length; i++) {
      var key = String(values[i][0]).trim().toLowerCase();
      if (key) {
        keyRow[key] = i + 1;
      }
    }

    var updates = 0;
    rows.forEach(function (row) {
      var kunci = text_(row && row.kunci, 120);
      if (!kunci) return;

      var target = keyRow[kunci.toLowerCase()];
      if (target) {
        sheet.getRange(target, 2).setValue(cell_(text_(row.nilai, 5000)));
        updates++;
      }
    });

    invalidateCache_();
    logAdmin_('simpan_kv', name, '', updates + ' kunci diperbarui.');

    return { ok: true, updated: updates };
  } finally {
    lock.releaseLock();
  }
}

function adminSetPesanStatus(rowNumber, status, token) {
  adminGuard_(token);

  var allowed = ['Baru', 'Sudah dibalas'];
  if (allowed.indexOf(status) === -1) {
    throw new Error('Status tidak valid.');
  }

  var row = Number(rowNumber);
  if (!row || row < 2) {
    throw new Error('Nomor baris tidak valid.');
  }

  var ss = ensureDatabase_();
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var sheet = ss.getSheetByName('Pesan');
    if (!sheet) {
      throw new Error('Sheet Pesan tidak ditemukan.');
    }
    if (row > sheet.getLastRow()) {
      throw new Error('Baris tidak ditemukan.');
    }
    if (!String(sheet.getRange(row, 1).getValue()).trim()) {
      throw new Error('Baris tidak berisi data.');
    }

    sheet.getRange(row, 7).setValue(status);
    SpreadsheetApp.flush();
    logAdmin_('status_pesan', 'Pesan', 'baris ' + row, status);

    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function adminDeletePesan(rowNumber, token) {
  adminGuard_(token);

  var row = Number(rowNumber);
  if (!row || row < 2) {
    throw new Error('Nomor baris tidak valid.');
  }

  var ss = ensureDatabase_();
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var sheet = ss.getSheetByName('Pesan');
    if (!sheet || row > sheet.getLastRow()) {
      throw new Error('Baris tidak ditemukan.');
    }

    var backup = sheet.getRange(row, 1, 1, 7).getValues()[0].join(' | ');
    logAdmin_('hapus', 'Pesan', 'baris ' + row, backup);
    sheet.deleteRow(row);
    invalidateCache_();

    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

/** Jumlah baris data per sheet untuk dashboard admin. */
function adminStats(token) {
  adminGuard_(token);

  var ss = ensureDatabase_();
  var stats = {};

  Object.keys(SCHEMA).forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    stats[name] = sheet ? Math.max(0, sheet.getLastRow() - 1) : 0;
  });

  return stats;
}

/* ------------------------------ helpers ------------------------------ */

function readTable_(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    return { headers: SCHEMA[name] || [], entries: [] };
  }

  var values = sheet.getDataRange().getValues();
  if (!values.length) {
    return { headers: SCHEMA[name] || [], entries: [] };
  }

  var headers = values.shift().map(function (h) {
    return String(h).trim();
  });

  var entries = values.map(function (row, index) {
    return { row: index + 2, cells: row || [] };
  }).filter(function (entry) {
    return entry.cells.some(function (cell) {
      return cell !== '' && cell != null;
    });
  });

  return { headers: headers, entries: entries };
}

function rowsToObjects_(name, headers, entries) {
  var fields = SCHEMA[name] || [];

  return entries.map(function (entry) {
    var obj = { _row: entry.row };

    headers.forEach(function (header, index) {
      var cell = entry.cells[index];
      if (cell instanceof Date) {
        obj[header] = Utilities.formatDate(cell, APP.timezone, 'yyyy-MM-dd');
      } else {
        obj[header] = cell == null ? '' : String(cell).trim();
      }
    });

    fields.forEach(function (field) {
      if (typeof obj[field] === 'undefined') {
        obj[field] = '';
      }
    });

    return obj;
  });
}

function validateEntity_(spec, data) {
  var errors = [];

  spec.required.forEach(function (field) {
    if (!text_(data[field], 0)) {
      errors.push('Kolom "' + field + '" wajib diisi.');
    }
  });

  spec.dateFields.forEach(function (field) {
    var value = text_(data[field], 0);
    if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      errors.push('Format "' + field + '" harus YYYY-MM-DD.');
    }
  });

  return errors;
}

function findRowByIndex_(values, idValue) {
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === idValue) {
      return i + 1;
    }
  }
  return -1;
}

function escapeRegExp_(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function nextId_(values, prefix) {
  var pattern = new RegExp('^' + escapeRegExp_(prefix) + '(\\d+)$');
  var max = 0;

  for (var i = 1; i < values.length; i++) {
    var match = String(values[i][0] || '').trim().match(pattern);
    if (match) {
      max = Math.max(max, parseInt(match[1], 10));
    }
  }

  return prefix + String(max + 1).padStart(3, '0');
}

/* =====================================================================
 * DATA CONTOH (silakan diganti lewat spreadsheet)
 * ===================================================================== */

function seedData_(ss) {
  var seed = {
    Profil: [
      ['nama_sekolah', 'SD Negeri Semanu III'],
      ['npsn', '2040xxxx (data contoh)'],
      ['jenjang', 'Sekolah Dasar'],
      ['status', 'Negeri'],
      ['akreditasi', 'B (data contoh)'],
      ['alamat', 'Munggi Pasar, Semanu, Kecamatan Semanu, Kabupaten Gunungkidul, D.I. Yogyakarta 55893'],
      ['telepon', '(0274) 000000 (data contoh)'],
      ['whatsapp', '6280000000000'],
      ['email', 'info@sdn-semanu3.sch.id (data contoh)'],
      ['jam_layanan', 'Senin - Jumat, 07.00 - 14.00 WIB'],
      ['kepala_sekolah', 'Nama Kepala Sekolah (data contoh)'],
      ['tahun_ajaran', '2026/2027'],
      ['jumlah_siswa', '186'],
      ['maps_url', 'https://www.google.com/maps/search/?api=1&query=SD+Negeri+Semanu+III'],
      ['tagline', 'Belajar dengan gembira, tumbuh dengan karakter.'],
      ['sambutan', 'Assalamualaikum warahmatullahi wabarakatuh.\n\nSelamat datang di website resmi SD Negeri Semanu III. Website ini kami hadirkan sebagai sarana informasi bagi orang tua/wali, siswa, calon siswa, dan masyarakat sekitar sekolah.\n\nMelalui website ini kami berharap komunikasi antara sekolah dan keluarga dapat berjalan lebih mudah. Informasi kegiatan, agenda, prestasi, dan penerimaan siswa baru akan diperbarui secara berkala.\n\nKami menyadari website ini masih memiliki banyak kekurangan. Saran dan masukan dari Bapak/Ibu sangat kami harapkan. Terima kasih.\n\nWassalamualaikum warahmatullahi wabarakatuh.'],
      ['visi', 'Terwujudnya peserta didik yang beriman, berkarakter, cerdas, dan peduli terhadap lingkungan.'],
      ['misi', '1. Menyelenggarakan pembelajaran yang aktif, kreatif, dan menyenangkan.\n2. Menanamkan nilai keimanan, ketakwaan, dan akhlak mulia.\n3. Mengembangkan potensi akademik dan nonakademik sesuai minat siswa.\n4. Mewujudkan sekolah yang bersih, sehat, dan peduli lingkungan.\n5. Melibatkan orang tua dan masyarakat dalam mendukung pendidikan.']
    ],
    Pengumuman: [
      ['P-001', '2026-10-12', 'Pembagian Rapor Tengah Semester Gasal', 'Akademik', 'Pembagian rapor PTS gasal dilaksanakan Sabtu, 24 Oktober 2026 pukul 08.00 WIB di ruang kelas masing-masing.', 'Pembagian rapor Penilaian Tengah Semester (PTS) gasal tahun ajaran 2026/2027 dilaksanakan pada Sabtu, 24 Oktober 2026 pukul 08.00 WIB di ruang kelas masing-masing. Orang tua/wali dimohon hadir tepat waktu dan membawa buku penghubung. Bagi orang tua/wali yang berhalangan hadir, mohon menghubungi wali kelas sebelumnya.', 'Ya'],
      ['P-002', '2026-10-05', 'Peringatan Maulid Nabi Muhammad SAW', 'Kegiatan', 'Kegiatan keagamaan dan lomba islami akan dilaksanakan pada Jumat, 9 Oktober 2026 di aula sekolah.', 'Dalam rangka memperingati Maulid Nabi Muhammad SAW, sekolah akan mengadakan kegiatan keagamaan dan lomba islami pada Jumat, 9 Oktober 2026 di aula sekolah. Siswa diharapkan mengenakan pakaian muslim/muslimah yang rapi dan membawa perlengkapan ibadah.', 'Tidak'],
      ['P-003', '2026-09-28', 'Pendaftaran Ekstrakurikuler Semester Gasal', 'Kesiswaan', 'Pendaftaran ekstrakurikuler dibuka sampai 10 Oktober 2026 melalui wali kelas.', 'Pendaftaran ekstrakurikuler tahun ajaran 2026/2027 dibuka sampai 10 Oktober 2026. Pilihan ekstrakurikuler antara lain Pramuka, seni tari, futsal, dan BTQ. Pendaftaran dilakukan melalui wali kelas masing-masing tanpa dipungut biaya.', 'Tidak'],
      ['P-004', '2026-09-15', 'Sosialisasi PPDB Tahun Ajaran 2027/2028', 'PPDB', 'Informasi awal penerimaan siswa baru tahun ajaran 2027/2028 dapat dilihat pada halaman PPDB.', 'Sekolah telah membuka kanal informasi awal Penerimaan Peserta Didik Baru (PPDB) tahun ajaran 2027/2028. Persyaratan, alur pendaftaran, dan perkiraan jadwal dapat dilihat pada halaman PPDB di website ini. Informasi resmi lebih lanjut akan diumumkan melalui website dan papan pengumuman sekolah.', 'Ya'],
      ['P-005', '2026-09-01', 'Gerakan Literasi 15 Menit Setiap Hari', 'Akademik', 'Kegiatan membaca bersama dilaksanakan setiap hari Senin sampai Kamis sebelum pembelajaran dimulai.', 'Mulai September 2026, sekolah menerapkan gerakan literasi 15 menit setiap hari Senin sampai Kamis sebelum pembelajaran dimulai. Siswa dapat membawa buku bacaan sendiri atau meminjam dari perpustakaan sekolah. Orang tua diharapkan mendukung kebiasaan membaca di rumah.', 'Tidak']
    ],
    Agenda: [
      ['A-001', '2026-10-12', '2026-10-17', 'Penilaian Tengah Semester Gasal', 'Akademik', 'Ruang kelas', 'Penilaian tengah semester dilaksanakan selama satu pekan sesuai jadwal yang dibagikan wali kelas.'],
      ['A-002', '2026-10-24', '2026-10-24', 'Pembagian Rapor Tengah Semester', 'Akademik', 'Ruang kelas masing-masing', 'Orang tua/wali mengambil rapor dan berkonsultasi dengan wali kelas pukul 08.00 WIB.'],
      ['A-003', '2026-11-02', '2026-11-06', 'Pekan Bulan Bahasa dan Sastra', 'Kegiatan', 'Aula dan ruang kelas', 'Lomba membaca puisi, menulis cerita pendek, dan mendongeng antar kelas.'],
      ['A-004', '2026-11-21', '2026-11-21', 'Class Meeting Semester Gasal', 'Kesiswaan', 'Lapangan sekolah', 'Pertandingan persahabatan antar kelas dan penampilan ekstrakurikuler.'],
      ['A-005', '2026-12-12', '2026-12-12', 'Gelar Karya dan Pentas Seni', 'Kegiatan', 'Aula sekolah', 'Pameran hasil karya siswa dan pentas seni sebagai penutup semester gasal.'],
      ['A-006', '2027-01-05', '2027-01-05', 'Awal Pembelajaran Semester Genap', 'Akademik', 'Ruang kelas', 'Kegiatan belajar semester genap dimulai pukul 07.00 WIB.']
    ],
    Kalender: [
      ['K-001', '2026-10-12', 'Penilaian Tengah Semester', 'Kegiatan', '12 - 17 Oktober 2026'],
      ['K-002', '2026-10-24', 'Pembagian Rapor Tengah Semester', 'Kegiatan', 'Orang tua/wali diundang hadir pukul 08.00 WIB'],
      ['K-003', '2026-12-21', 'Libur Akhir Semester Gasal', 'Libur', '21 Desember 2026 - 2 Januari 2027'],
      ['K-004', '2026-12-25', 'Hari Raya Natal', 'Libur', 'Libur nasional'],
      ['K-005', '2027-01-01', 'Tahun Baru 2027', 'Libur', 'Libur nasional'],
      ['K-006', '2027-01-05', 'Masuk Semester Genap', 'Kegiatan', 'Kegiatan belajar dimulai pukul 07.00 WIB'],
      ['K-007', '2027-02-06', 'Perkiraan Libur Tahun Baru Imlek', 'Libur', 'Menyesuaikan SKB hari libur nasional']
    ],
    Prestasi: [
      ['PR-001', '2026-09-20', 'Aisyah Nur Fadilah', 'VI', 'Lomba Pidato Bahasa Jawa', 'Kecamatan', 'Juara 1', 'Meraih juara pertama pada lomba pidato bahasa Jawa tingkat kecamatan.'],
      ['PR-002', '2026-09-27', 'Bagas Prakoso', 'V', 'Olimpiade Sains Nasional (IPA)', 'Kabupaten', 'Juara 2', 'Meraih juara kedua bidang IPA pada seleksi OSN tingkat kabupaten.'],
      ['PR-003', '2026-10-04', 'Kelompok Tari Sekar Arum', 'IV - VI', 'Festival Tari Tradisional', 'Kecamatan', 'Juara 1', 'Penampilan tari tradisional Yogyakarta meraih juara pertama tingkat kecamatan.'],
      ['PR-004', '2026-10-11', 'Tim Cerdas Cermat PAI', 'V', 'Lomba Cerdas Cermat PAI', 'Kecamatan', 'Juara 3', 'Tim cerdas cermat pendidikan agama Islam meraih juara ketiga tingkat kecamatan.']
    ],
    Galeri: [
      ['G-001', '2026-10-12', 'Pembukaan Pekan PTS', 'Kegiatan Belajar', 'Foto', '', 'Suasana persiapan penilaian tengah semester.'],
      ['G-002', '2026-09-20', 'Lomba Pidato Bahasa Jawa', 'Prestasi', 'Foto', '', 'Dokumentasi siswa saat mengikuti lomba pidato.'],
      ['G-003', '2026-09-05', 'Latihan Pramuka Penggalang', 'Ekstrakurikuler', 'Foto', '', 'Kegiatan latihan rutin Pramuka setiap Jumat.'],
      ['G-004', '2026-08-17', 'Upacara HUT Kemerdekaan RI', 'Kegiatan Sekolah', 'Foto', '', 'Upacara bendera di lapangan sekolah.'],
      ['G-005', '2026-08-10', 'Perpustakaan Sekolah', 'Fasilitas', 'Foto', '', 'Ruang perpustakaan yang digunakan untuk gerakan literasi.'],
      ['G-006', '2026-10-01', 'Dokumentasi Kegiatan Sekolah', 'Kegiatan Sekolah', 'Video', '', 'Tautan video belum diisi. Isi kolom media_url dengan tautan Google Drive atau YouTube.']
    ],
    Guru: [
      ['GURU-001', 'Nama Kepala Sekolah (contoh)', '19xxxxxx (contoh)', 'Kepala Sekolah', '-'],
      ['GURU-002', 'Sri Wahyuni, S.Pd.', '19xxxxxx (contoh)', 'Guru Kelas VI', 'Guru Kelas'],
      ['GURU-003', 'Dwi Prasetyo, S.Pd.', '19xxxxxx (contoh)', 'Guru Kelas V', 'Guru Kelas'],
      ['GURU-004', 'Rina Kusumawati, S.Pd.', '19xxxxxx (contoh)', 'Guru Kelas IV', 'Guru Kelas'],
      ['GURU-005', 'Ahmad Fauzi, S.Pd.I.', '19xxxxxx (contoh)', 'Guru Pendidikan Agama Islam', 'PAI'],
      ['GURU-006', 'Yuliana Sari, S.Pd.', '19xxxxxx (contoh)', 'Guru Kelas III', 'Guru Kelas']
    ],
    Fasilitas: [
      ['F-001', 'Ruang Kelas', 'Enam ruang kelas dengan pencahayaan dan ventilasi yang memadai.'],
      ['F-002', 'Perpustakaan', 'Koleksi buku pelajaran dan buku cerita untuk mendukung gerakan literasi.'],
      ['F-003', 'Ruang Multimedia', 'Digunakan untuk pembelajaran berbasis komputer dan kegiatan presentasi.'],
      ['F-004', 'Mushola', 'Tempat ibadah dan kegiatan keagamaan siswa.'],
      ['F-005', 'Unit Kesehatan Sekolah', 'Ruang pertolongan pertama dengan perlengkapan dasar.'],
      ['F-006', 'Lapangan dan Taman', 'Lapangan upacara, olahraga, serta taman hijau untuk kegiatan luar kelas.']
    ],
    Program: [
      ['PRG-001', 'Gerakan Literasi Sekolah', 'Membaca bersama 15 menit setiap hari sebelum pembelajaran dimulai.'],
      ['PRG-002', 'Pramuka Penggalang', 'Pembinaan karakter, kedisiplinan, dan kemandirian melalui kepramukaan.'],
      ['PRG-003', 'Seni Tari Tradisional', 'Melestarikan seni dan budaya daerah melalui latihan rutin dan pentas.'],
      ['PRG-004', 'BTQ (Baca Tulis Al-Quran)', 'Pendampingan membaca dan menulis Al-Quran sesuai jenjang siswa.'],
      ['PRG-005', 'Sekolah Adiwiyata', 'Kegiatan kebersihan, penghijauan, dan pengelolaan sampah sederhana.'],
      ['PRG-006', 'Olahraga dan Kesehatan', 'Kegiatan senam bersama, futsal, dan pemeriksaan kesehatan berkala.']
    ],
    PPDB: [
      ['tahun_ajaran', '2027/2028 (data contoh)'],
      ['status', 'Dibuka'],
      ['periode', '1 - 30 April 2027 (data contoh)'],
      ['kuota', '28 siswa (data contoh)'],
      ['persyaratan', '1. Fotokopi akta kelahiran\n2. Fotokopi Kartu Keluarga\n3. Fotokopi KIP/PKH bila ada\n4. Pasfoto ukuran 3x4 sebanyak 2 lembar\n5. Formulir pendaftaran yang sudah diisi'],
      ['alur', '1. Ambil formulir di sekolah atau unduh dari website\n2. Lengkapi seluruh berkas persyaratan\n3. Serahkan berkas ke panitia PPDB\n4. Verifikasi dan pencatatan data\n5. Pengumuman hasil seleksi\n6. Daftar ulang bagi siswa yang diterima'],
      ['biaya', 'Tidak dipungut biaya (data contoh)'],
      ['kontak', 'Panitia PPDB - (0274) 000000 (data contoh)'],
      ['catatan', 'Jadwal dan ketentuan pada halaman ini masih berupa contoh untuk keperluan tugas. Informasi resmi mengikuti pengumuman sekolah.']
    ]
  };

  Object.keys(seed).forEach(function (name) {
    var rows = seed[name];
    if (!rows.length) return;

    var sheet = ss.getSheetByName(name);
    var lebar = SCHEMA[name].length;
    var normalized = rows.map(function (row) {
      var copy = row.slice(0, lebar);
      while (copy.length < lebar) copy.push('');
      return copy;
    });

    sheet.getRange(2, 1, normalized.length, lebar).setValues(normalized);
    sheet.getRange(2, 1, normalized.length, lebar).setVerticalAlignment('top');
    sheet.getRange(2, 1, normalized.length, lebar).setWrap(true);
  });
}
