/* =====================================================================
   Code.gs — Backend Google Apps Script
   Manajemen Kinerja Tim — BPS Kabupaten Puncak

   Spreadsheet tabs:
     • Users     : id | nama | role | passwordHash | salt | createdAt
     • Sessions  : token | userId | expiresAt
     • Aktivitas : id | tujuan | sasaran | iku | kegiatan | subKegiatan
                   | nama | target | satuan | periodeMulai | periodeSelesai
                   | assignedTo | createdBy | createdAt
     • Laporan   : id | aktivitasId | pegawaiId | tanggal | uraian | capaian
                   | buktiTipe | buktiUrl | buktiNama | createdAt
     • Penilaian : id | pegawaiId | penilaiId | bulan | nilaiKinerja | berorientasiPelayanan
                   | akuntabel | kompeten | harmonis | loyal | adaptif | kolaboratif
                   | catatan | createdAt

   Referensi (Tujuan/Sasaran/IKU/Kegiatan/SubKegiatan) hardcoded di bawah.
   ===================================================================== */

// ID folder Google Drive tempat menyimpan file bukti dukung (WAJIB diisi)
const DRIVE_FOLDER_ID = '1tZ5vZgXWsut0nVaNcf92_7LAdHi3WxK5';

// Masa berlaku sesi login (dalam milidetik). Default: 1 hari.
const SESSION_DURATION_MS = 1 * 24 * 60 * 60 * 1000;

const SHEETS = {
  USERS: "Users",
  SESSIONS: "Sessions",
  AKTIVITAS: "Aktivitas",
  LAPORAN: "Laporan",
  PENILAIAN: "Penilaian",
  PENGAJUAN: "Pengajuan",
};

const HEADERS = {
  Users: ["id", "username", "nama", "role", "passwordHash", "salt", "createdAt"],
  Sessions: ["token", "userId", "expiresAt"],
  Aktivitas: ["id", "tujuan", "sasaran", "iku", "kegiatan", "subKegiatan",
    "nama", "target", "satuan", "periodeMulai", "periodeSelesai",
    "assignedTo", "createdBy", "createdAt"],
  Laporan: ["id", "aktivitasId", "pegawaiId", "tanggal", "uraian", "capaian",
    "buktiTipe", "buktiUrl", "buktiNama", "createdAt"],
  Penilaian: ["id", "pegawaiId", "penilaiId", "bulan", "nilaiKinerja",
    "berorientasiPelayanan", "akuntabel", "kompeten", "harmonis",
    "loyal", "adaptif", "kolaboratif", "catatan", "createdAt"],
  Pengajuan: ["id", "pegawaiId", "bulan", "status", "createdAt"],
};

/**
 * Data referensi Tujuan > Sasaran > IKU > Kegiatan > Sub Kegiatan.
 * Hardcoded agar tidak perlu sheet tambahan.
 */
const REFERENSI = [{ "nama": "1. Mewujudkan Perumusan Kebijakan dan Pengambilan Keputusan Berbasis Data Statistik Berkualitas dan Insight yang Relevan", "sasaran": [{ "nama": "1.1 Terwujudnya Penyediaan Data Dan Insight Statistik Kependudukan Dan Ketenagakerjaan Yang Berkualitas", "iku": [{ "nama": "1.1.1 Persentase Publikasi/Laporan Statistik Kependudukan Dan Ketenagakerjaan Yang Berkualitas", "kegiatan": [{ "nama": "Sakernas Februari", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Sakernas Mei", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Sakernas Agustus", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Sakernas November", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }] }] }, { "nama": "1.2 Terwujudnya Penyediaan Data Dan Insight Statistik Kesejahteraan Rakyat Yang Berkualitas", "iku": [{ "nama": "1.2.1 Persentase Publikasi/Laporan Statistik Kesejahteraan Rakyat Yang Berkualitas", "kegiatan": [{ "nama": "Susenas Maret", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Susenas September", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Seruti Triwulan I", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Seruti Triwulan II", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Seruti Triwulan III", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Seruti Triwulan IV", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }] }] }, { "nama": "1.3 Terwujudnya Penyediaan Data Dan Insight Statistik Ketahanan Sosial Yang Berkualitas", "iku": [{ "nama": "1.3.1 Persentase Publikasi/Laporan Statistik Ketahanan Sosial Yang Berkualitas", "kegiatan": [{ "nama": "Politik dan Keamanan", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Potensi Desa", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Desa Cantik", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }] }] }, { "nama": "1.4 Terwujudnya Penyediaan Data Dan Insight Statistik Sumber Daya Mineral dan Konstruksi yang Berkualitas", "iku": [{ "nama": "1.4.1 Persentase Publikasi/Laporan Statistik Sumber Daya Mineral dan Konstruksi yang Berkualitas", "kegiatan": [{ "nama": "PE Tahunan", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Konstruksi Tahunan", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Air Bersih Tahunan", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Captive Power Tahunan", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }] }] }, { "nama": "1.5 Terwujudnya Penyediaan Data Dan Insight Statistik Sumber Daya Hayati yang Berkualitas", "iku": [{ "nama": "1.5.1 Persentase Publikasi/Laporan Statistik Sumber Daya Hayati yang Berkualitas", "kegiatan": [{ "nama": "Peternakan", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Perikanan Triwulan 1", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Perikanan Triwulan 2", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Perikanan Triwulan 3", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Kehutanan", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "KSA Januari", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "KSA Februari", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "KSA Maret", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "KSA April", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "KSA Mei", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "KSA Juni", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "KSA Juli", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "KSA Agustus", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "KSA September", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "KSA Oktober", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "KSA November", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "KSA Desember", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Ubinan SR 1", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Ubinan SR 2", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Ubinan SR 3", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Hortikultura", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Perkebunan Tahunan", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }] }] }, { "nama": "1.6 Terwujudnya Penyediaan Data Dan Insight Statistik Industri Yang Berkualitas", "iku": [{ "nama": "1.6.1 Persentase Publikasi/Laporan Statistik Industri yang Berkualitas", "kegiatan": [{ "nama": "IMK Triwulan 4", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "IMK Triwulan 1", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "IMK Triwulan 2", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "IMK Triwulan 3", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "IMK Tahunan", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "IBS Triwulan 4", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "IBS Triwulan 1", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "IBS Triwulan 2", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "IBS Triwulan 3", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "IBS Tahunan (STPIM)", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }] }] }, { "nama": "1.7 Terwujudnya Penyediaan Data Dan Insight Statistik Distribusi Yang Berkualitas", "iku": [{ "nama": "1.7.1 Persentase Publikasi/Laporan Statistik Distribusi Yang Berkualitas", "kegiatan": [{ "nama": "Survei Jasa Penunjang Angkutan", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Simoppel Januari", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Simoppel Februari", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Simoppel Maret", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Simoppel April", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Simoppel Mei", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Simoppel Juni", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Simoppel Juli", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Simoppel Agustus", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Simoppel September", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Simoppel Oktober", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Simoppel November", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Sensus Ekonomi 2026", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }] }] }, { "nama": "1.8 Terwujudnya Penyediaan Data Dan Insight Statistik Harga Yang Berkualitas", "iku": [{ "nama": "1.8.1 Persentase Publikasi/Laporan Statistik Harga Yang Berkualitas", "kegiatan": [{ "nama": "Survei Harga Kemahalan Konstruksi Triwulan I", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Survei Harga Kemahalan Konstruksi Triwulan II", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Survei Harga Kemahalan Konstruksi Triwulan III", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Survei Harga Kemahalan Konstruksi Triwulan IV", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "SHPED Januari", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "SHPED Februari", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "SHPED Maret", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "SHPED April", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "SHPED Mei", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "SHPED Juni", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "SHPED Juli", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "SHPED Agustus", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "SHPED September", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "SHPED Oktober", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "SHPED November", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "SHPED Desember", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "SHPB Januari", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "SHPB Februari", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "SHPB Maret", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "SHPB April", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "SHPB Mei", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "SHPB Juni", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "SHPB Juli", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "SHPB Agustus", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "SHPB September", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "SHPB Oktober", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "SHPB November", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "SHPB Desember", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "SHP Januari", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "SHP Februari", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "SHP Maret", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "SHP April", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "SHP Mei", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "SHP Juni", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "SHP Juli", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "SHP Agustus", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "SHP September", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "SHP Oktober", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "SHP November", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "SHP Desember", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }] }] }, { "nama": "1.9 Terwujudnya Penyediaan Data Dan Insight Statistik Jasa Yang Berkualitas", "iku": [{ "nama": "1.9.1 Persentase Publikasi/Laporan Statistik Jasa Yang Berkualitas", "kegiatan": [{ "nama": "Survei Statistik Keuangan Desa/Nagari (K3)", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Survei Lembaga Keuangan Koperasi Simpan Pinjam", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "BUMD", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "VHTS Januari", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "VHTS Februari", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "VHTS Maret", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "VHTS April", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "VHTS Mei", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "VHTS Juni", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "VHTS Juli", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "VHTS Agustus", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "VHTS September", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "VHTS Oktober", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "VHTS November", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "VHTS Desember", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "VHTL", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "VDTW", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "VREST", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }] }] }, { "nama": "1.10 Terwujudnya Penyediaan Data Dan Insight Statistik Lintas Sektor Yang Berkualitas", "iku": [{ "nama": "1.10.1 Persentase Publikasi/Laporan Neraca Produksi Yang Berkualitas", "kegiatan": [{ "nama": "SKNP", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "SKTNP Tahap 1", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "SKTNP Tahap 2", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "SKTNP Tahap 3", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "SKTNP Tahap 4", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Penyusunan Data TW 4 2025 PDRB Lapangan Usaha", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Penyusunan Data TW 1 2026 PDRB Lapangan Usaha", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Penyusunan Data TW 2 2026 PDRB Lapangan Usaha", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Penyusunan Data TW 3 2026 PDRB Lapangan Usaha", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }] }, { "nama": "1.10.2 Persentase Publikasi/Laporan Neraca Pengeluaran Yang Berkualitas", "kegiatan": [{ "nama": "SKLNP Triwulan 1", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "SKLNP Triwulan 2", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "SKLNP Triwulan 3", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "SKLNP Triwulan 4", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "SKSPPI", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Penyusunan Data TW 4 2025 PDRB Pengeluaran", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Penyusunan Data TW 1 2026 PDRB Pengeluaran", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Penyusunan Data TW 2 2026 PDRB Pengeluaran", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Penyusunan Data TW 3 2026 PDRB Pengeluaran", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }] }, { "nama": "1.10.3 Persentase publikasi/laporan Analisis dan Pengembangan Statistik yang berkualitas", "kegiatan": [{ "nama": "Pengumpulan Quality Gates TW 1", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Pengumpulan Quality Gates TW 2", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Pengumpulan Quality Gates TW 3", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Pengumpulan Quality Gates TW 4", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Publikasi Inkesra", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }, { "nama": "Publikasi Statda", "subKegiatan": ["Pelatihan", "Pendataan", "Pengolahan", "Diseminasi"] }] }] }] }, { "nama": "2. Mewujudkan Penyelenggaraan Sistem Statistik Nasional yang Andal, Efektif, dan Efisien", "sasaran": [{ "nama": "2.1 Terwujudnya Kapasitas Tata Kelola Pemerintah Desa Untuk Menghasilkan Statistik Berkualitas", "iku": [{ "nama": "2.1.1 Persentase Kumulatif Desa Yang Berpredikat Desa Cinta Statistik", "kegiatan": [{ "nama": "Pembinaan Desa Cantik", "subKegiatan": ["Pembinaan Desa Cantik Desa A", "Pembinaan Desa Cantik Desa B", "Pembinaan Desa Cantik Desa C"] }] }] }, { "nama": "2.2 Terwujudnya Penguatan Penyelenggaraan Pembinaan Statistik Sektoral Kementerian/Lembaga/Pemerintah Daerah", "iku": [{ "nama": "2.2.1 Tingkat Penyelenggaraan Pembinaan Statistik Sektoral sesuai standar", "kegiatan": [{ "nama": "Pembinaan Sektoral", "subKegiatan": ["Pembinaan Sektoral"] }] }] }, { "nama": "2.3 Terwujudnya Kemudahan Akses Data Bps", "iku": [{ "nama": "2.3.1 Indeks Pelayanan Publik - Penilaian Mandiri", "kegiatan": [{ "nama": "Pelayanan Permintaan Data", "subKegiatan": ["Pelayanan Permintaan Data"] }, { "nama": "Pelayanan Konsultasi Statistik", "subKegiatan": ["Pelayanan Konsultasi Statistik"] }, { "nama": "Penanganan Whistle Blower", "subKegiatan": ["Penanganan Whistle Blower"] }] }] }] }, { "nama": "3. Mewujudkan Tata Kelola Badan Pusat Statistik yang Berkualitas, Akuntabel, Efektif, dan Efisien dalam Menyelenggarakan Statistik", "sasaran": [{ "nama": "3.1 Terwujudnya Dukungan Manajemen Pada Bps Provinsi Dan Bps Kabupaten/Kota", "iku": [{ "nama": "3.1.1 Nilai SAKIP oleh Inspektorat", "kegiatan": [{ "nama": "Perjanjian Kinerja", "subKegiatan": ["Reviu", "Penyusunan"] }, { "nama": "Evaluasi Kinerja", "subKegiatan": ["Monitoring dan Evaluasi Capaian Kinerja TW 1", "Monitoring dan Evaluasi Capaian Kinerja TW 2", "Monitoring dan Evaluasi Capaian Kinerja TW 3", "Monitoring dan Evaluasi Capaian Kinerja TW 4"] }, { "nama": "Pelaporan Kinerja", "subKegiatan": ["Penyusunan Laporan Kinerja"] }, { "nama": "Rencana Strategis", "subKegiatan": ["Reviu"] }] }, { "nama": "3.1.2 Indeks Implementasi BerAKHLAK", "kegiatan": [{ "nama": "BMN", "subKegiatan": ["Penyusunan Pengawasan dan Pengendalian", "Penyusunan Laporan Barang", "Kegiatan Rutin", "Kegiatan Semesteran"] }, { "nama": "Keuangan", "subKegiatan": ["Kegiatan Rutin", "Kegiatan Triwulanan", "Kegiatan Semesteran"] }, { "nama": "Manajemen SDM", "subKegiatan": ["Penilaian Kinerja Pegawai", "Teguran Pegawai", "Pembuatan SK Tim"] }, { "nama": "Pengelolaan kebersihan, dan kenyamanan lingkungan", "subKegiatan": ["Pengelolaan kebersihan, dan kenyamanan lingkungan"] }, { "nama": "Persediaan", "subKegiatan": ["Transaksi Sakti", "Pembuatan Laporan Persediaan"] }, { "nama": "Surat-Menyurat", "subKegiatan": ["Pembuatan Surat Internal", "Pembuatan Surat Eksternal", "Pengandaan Dokumen dengan tujuan mendukung kegiatan lainnya"] }] }] }] }];

/* ========================= UTIL SHEET ========================= */
function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (HEADERS[name]) {
      sheet.appendRow(HEADERS[name]);
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

function sheetToObjects(sheetName) {
  const sheet = getSheet(sheetName);
  const headers = HEADERS[sheetName];
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= 1) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, Math.min(lastCol, headers.length)).getValues();
  const rows = [];
  for (let i = 0; i < values.length; i++) {
    if (!values[i][0]) continue;
    const obj = {};
    headers.forEach((h, idx) => {
      let v = values[i][idx];
      if (v instanceof Date) {
        if (h === "tanggal" || h === "periodeMulai" || h === "periodeSelesai") {
          v = Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd");
        } else if (h === "bulan") {
          v = Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM");
        }
      }
      obj[h] = v;
    });
    rows.push(obj);
  }
  return rows;
}

function findRowIndexById(sheetName, id) {
  const sheet = getSheet(sheetName);
  const values = sheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === id) return i + 1;
  }
  return -1;
}

function appendObject(sheetName, obj) {
  const sheet = getSheet(sheetName);
  const headers = HEADERS[sheetName];
  const row = headers.map(h => (obj[h] !== undefined ? obj[h] : ""));
  sheet.appendRow(row);
  SpreadsheetApp.flush();
  return obj;
}

function updateObjectById(sheetName, id, patch) {
  const rowIdx = findRowIndexById(sheetName, id);
  if (rowIdx === -1) return null;
  const sheet = getSheet(sheetName);
  const headers = HEADERS[sheetName];
  const range = sheet.getRange(rowIdx, 1, 1, headers.length);
  const values = range.getValues()[0];
  
  headers.forEach((h, i) => {
    if (patch[h] !== undefined) {
      values[i] = patch[h];
    }
  });
  
  range.setValues([values]);
  SpreadsheetApp.flush();
  
  const result = {};
  const dateCols = ["tanggal", "periodeMulai", "periodeSelesai", "createdAt"];
  headers.forEach((h, i) => {
    let v = values[i];
    if (v instanceof Date && dateCols.includes(h)) {
      v = h === "createdAt" ? v.getTime() : Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd");
    }
    result[h] = v;
  });
  return result;
}

function deleteRowById(sheetName, id) {
  const rowIdx = findRowIndexById(sheetName, id);
  if (rowIdx === -1) return false;
  getSheet(sheetName).deleteRow(rowIdx);
  SpreadsheetApp.flush();
  return true;
}

function deleteRowsByCol(sheetName, colName, value) {
  const sheet = getSheet(sheetName);
  const headers = HEADERS[sheetName];
  const colIdx = headers.indexOf(colName);
  if (colIdx < 0) return 0;
  const values = sheet.getDataRange().getValues();
  const rowsToDelete = [];
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][colIdx]) === String(value)) rowsToDelete.push(i + 1);
  }
  for (let j = rowsToDelete.length - 1; j >= 0; j--) {
    sheet.deleteRow(rowsToDelete[j]);
  }
  SpreadsheetApp.flush();
  return rowsToDelete.length;
}

function newId(prefix) {
  return prefix + "_" + Utilities.getUuid().replace(/-/g, "").slice(0, 12);
}

/* ========================= PASSWORD & SESSION ========================= */
function hashPassword(password, salt) {
  const raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password + "::" + salt, Utilities.Charset.UTF_8);
  return raw.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, "0")).join("");
}

function makeSalt() {
  return Utilities.getUuid();
}

function createSession(userId) {
  const token = Utilities.getUuid();
  appendObject(SHEETS.SESSIONS, { token, userId, expiresAt: Date.now() + SESSION_DURATION_MS });
  return token;
}

function getUserByToken(token) {
  if (!token) return null;
  const sessions = sheetToObjects(SHEETS.SESSIONS);
  const s = sessions.find(s => s.token === token);
  if (!s) return null;
  if (Number(s.expiresAt) < Date.now()) return null;
  const users = sheetToObjects(SHEETS.USERS);
  const u = users.find(u => u.id === s.userId);
  return u || null;
}

function deleteSession(token) {
  deleteRowsByCol(SHEETS.SESSIONS, "token", token);
}

function cleanupExpiredSessions() {
  const sheet = getSheet(SHEETS.SESSIONS);
  const values = sheet.getDataRange().getValues();
  const now = Date.now();
  for (let i = values.length - 1; i >= 1; i--) {
    if (Number(values[i][2]) < now) sheet.deleteRow(i + 1);
  }
}

function sanitizeUser(u) {
  if (!u) return null;
  return { id: u.id, username: u.username || u.nama, nama: u.nama, role: u.role, createdAt: u.createdAt };
}

/* ========================= RESPONSE HELPER ========================= */
function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function errorResponse(message, code) {
  return jsonResponse({ error: message, code: code || 400 });
}

/* ========================= AUTH GUARD ========================= */
function requireUser(token) {
  const u = getUserByToken(token);
  if (!u) {
    const err = new Error("Sesi tidak valid. Silakan login kembali.");
    err.isAuthError = true;
    throw err;
  }
  return u;
}

function requireRole(user, role) {
  if (user.role !== role) {
    const err = new Error("Anda tidak memiliki akses untuk aksi ini.");
    err.isAuthError = true;
    throw err;
  }
}

/* ========================= SHEET SETUP ========================= */
function setupSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(HEADERS).forEach(name => {
    if (!ss.getSheetByName(name)) {
      const sh = ss.insertSheet(name);
      sh.getRange(1, 1, 1, HEADERS[name].length).setValues([HEADERS[name]]);
      sh.setFrozenRows(1);
      sh.setRowHeight(1, 28);
      sh.getRange(1, 1, 1, HEADERS[name].length)
        .setBackground("#12335F")
        .setFontColor("#FFFFFF")
        .setFontWeight("bold")
        .setFontSize(10);
    }
  });
  SpreadsheetApp.getUi().alert(
    "Setup selesai!\n\nSheet yang dibuat:\n- Users\n- Sessions\n- Aktivitas\n- Laporan\n- Penilaian\n\n" +
    "Langkah selanjutnya:\n1. Deploy sebagai Web App\n2. Execute as: Me\n3. Who has access: Anyone"
  );
}

/* ========================= ENTRY POINTS ========================= */
function doGet(e) {
  try {
    const action = e.parameter.action;
    const token = e.parameter.token;

    if (action === "bootstrap") return jsonResponse(handleBootstrap(token));
    if (action === "refresh") {
      const activeUser = requireUser(token);
      return jsonResponse(handleRefresh(activeUser));
    }
    if (action === "referensi") return jsonResponse(REFERENSI);
    if (action === "status") {
      const users = sheetToObjects(SHEETS.USERS);
      cleanupExpiredSessions();
      return jsonResponse({ hasUsers: users.length > 0 });
    }
    if (action === "me") return jsonResponse(sanitizeUser(requireUser(token)));

    // Verifikasi Akses Pengguna untuk get data umum (kecuali login & register)
    let activeUser = null;
    if (action !== "login" && action !== "register") {
      activeUser = requireUser(token);
    }

    if (action === "users") {
      if (["admin", "ketua_tim", "penilai", "pegawai"].indexOf(activeUser.role) === -1) {
        throw new Error("Akses ditolak.");
      }
      return jsonResponse(sheetToObjects(SHEETS.USERS).map(sanitizeUser));
    }
    if (action === "aktivitas") return jsonResponse(sheetToObjects(SHEETS.AKTIVITAS).map(normalizeAktivitasOut));
    if (action === "laporan") return jsonResponse(sheetToObjects(SHEETS.LAPORAN).map(normalizeLaporanOut));
    if (action === "penilaian") return jsonResponse(sheetToObjects(SHEETS.PENILAIAN).map(normalizePenilaianOut));
    if (action === "pengajuan") return jsonResponse(sheetToObjects(SHEETS.PENGAJUAN));

    const mutationActions = ["register", "login", "logout", "updateUser", "deleteUser",
      "createAktivitas", "updateAktivitas", "deleteAktivitas",
      "createLaporan", "updateLaporan", "deleteLaporan",
      "createPenilaian", "updatePenilaian", "deletePenilaian",
      "createPengajuan", "deletePengajuan"];
    if (mutationActions.includes(action)) {
      const body = {};
      for (const key of Object.keys(e.parameter)) {
        if (key !== "action" && key !== "token") {
          let val = e.parameter[key];
          try { val = JSON.parse(val); } catch (pe) { }
          body[key] = val;
        }
      }
      body.token = token;
      return executeAction(action, body);
    }

    return errorResponse("Aksi tidak dikenal: " + action, 404);
  } catch (err) {
    return errorResponse(err.message, err.isAuthError ? 401 : 400);
  }
}

function executeAction(action, body) {
  let result;
  switch (action) {
    case "register": result = handleRegister(body); break;
    case "login": result = handleLogin(body); break;
    case "logout": result = handleLogout(body); break;
    case "updateUser": result = handleUpdateUser(body); break;
    case "deleteUser": result = handleDeleteUser(body); break;
    case "createAktivitas": result = handleCreateAktivitas(body); break;
    case "updateAktivitas": result = handleUpdateAktivitas(body); break;
    case "deleteAktivitas": result = handleDeleteAktivitas(body); break;
    case "createLaporan": result = handleCreateLaporan(body); break;
    case "updateLaporan": result = handleUpdateLaporan(body); break;
    case "deleteLaporan": result = handleDeleteLaporan(body); break;
    case "createPenilaian": result = handleCreatePenilaian(body); break;
    case "updatePenilaian": result = handleUpdatePenilaian(body); break;
    case "deletePenilaian": result = handleDeletePenilaian(body); break;
    case "createPengajuan": result = handleCreatePengajuan(body); break;
    case "deletePengajuan": result = handleDeletePengajuan(body); break;
    default: return errorResponse("Aksi tidak dikenal: " + action, 404);
  }
  return jsonResponse(result);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
  } catch (le) {
    return errorResponse("Server sedang sibuk, coba lagi sebentar.", 503);
  }
  try {
    const body = JSON.parse(e.postData.contents || "{}");
    return executeAction(body.action, body);
  } catch (err) {
    return errorResponse(err.message, err.isAuthError ? 401 : 400);
  } finally {
    lock.releaseLock();
  }
}

/* ========================= AUTH HANDLERS ========================= */
function handleRegister(body) {
  const nama = (body.nama || "").trim();
  let username = (body.username || "").trim().toLowerCase();
  if (!username && nama) {
    username = nama.replace(/\s+/g, "").toLowerCase();
  }
  const role = body.role || "tamu"; // Default pendaftaran mandiri adalah tamu
  const password = body.password || "";
  if (!nama || !username || !password) {
    throw new Error("Username, nama lengkap, dan kata sandi wajib diisi.");
  }
  const users = sheetToObjects(SHEETS.USERS);
  const isBootstrap = users.length === 0;

  if (!isBootstrap) {
    if (body.token) {
      // Ditambahkan oleh Admin
      const current = requireUser(body.token);
      requireRole(current, "admin");
    } else {
      // Pendaftaran mandiri dari luar, paksa role ke tamu
      if (role !== "tamu") {
        throw new Error("Pendaftaran mandiri hanya diperbolehkan dengan peran tamu.");
      }
    }
  } else {
    // Bootstrap user pertama wajib Admin atau Ketua Tim
    if (role !== "admin" && role !== "ketua_tim") {
      throw new Error("Pengguna pertama harus mendaftar sebagai Admin atau Ketua Tim.");
    }
  }

  const exists = users.find(u => {
    const uName = String(u.username || "").toLowerCase();
    const uReal = String(u.nama || "").toLowerCase();
    return uName === username || uReal === nama.toLowerCase();
  });
  if (exists) throw new Error("Username atau Nama Lengkap sudah digunakan.");

  const salt = makeSalt();
  const user = {
    id: newId("usr"),
    username,
    nama,
    role,
    passwordHash: hashPassword(password, salt),
    salt,
    createdAt: Date.now(),
  };
  appendObject(SHEETS.USERS, user);

  if (isBootstrap) {
    const token = createSession(user.id);
    return { user: sanitizeUser(user), token };
  }
  return {
    user: sanitizeUser(user),
    message: isBootstrap ? "Pendaftaran Admin berhasil." : "Pendaftaran berhasil. Silakan hubungi Administrator untuk persetujuan akun Anda."
  };
}

function handleLogin(body) {
  const loginId = (body.username || body.nama || "").trim().toLowerCase();
  const password = body.password || "";
  if (!loginId || !password) throw new Error("Username/Email dan kata sandi wajib diisi.");
  const users = sheetToObjects(SHEETS.USERS);
  const user = users.find(u => {
    const uName = String(u.username || "").toLowerCase();
    const uReal = String(u.nama || "").toLowerCase();
    return uName === loginId || uReal === loginId;
  });
  if (!user) throw new Error("Nama pengguna/email atau kata sandi salah.");
  const hash = hashPassword(password, user.salt);
  if (hash !== user.passwordHash) throw new Error("Nama pengguna/email atau kata sandi salah.");
  const token = createSession(user.id);
  return { user: sanitizeUser(user), token };
}

function handleLogout(body) {
  deleteSession(body.token);
  return { ok: true };
}

/* ========================= USER HANDLERS ========================= */
function handleUpdateUser(body) {
  const current = requireUser(body.token);
  if (current.role !== "admin" && current.id !== body.id) {
    throw new Error("Anda tidak memiliki akses untuk mengubah pengguna lain.");
  }
  const patch = {};
  if (body.username) patch.username = String(body.username).trim().toLowerCase();
  if (body.nama) patch.nama = String(body.nama).trim();
  if (body.role) {
    if (current.role !== "admin") {
      throw new Error("Hanya Administrator yang dapat mengubah peran pengguna.");
    }
    patch.role = body.role;
  }
  if (body.password) {
    const salt = makeSalt();
    patch.salt = salt;
    patch.passwordHash = hashPassword(body.password, salt);
  }
  const updated = updateObjectById(SHEETS.USERS, body.id, patch);
  if (!updated) throw new Error("Pengguna tidak ditemukan.");
  return sanitizeUser(updated);
}

function handleDeleteUser(body) {
  const current = requireUser(body.token);
  if (current.role !== "admin") {
    throw new Error("Hanya Administrator yang dapat menghapus pengguna.");
  }
  const id = body.id;
  if (current.id === id) throw new Error("Tidak dapat menghapus akun sendiri.");

  // Cascade delete penugasan dari aktivitas
  const aktivitasList = sheetToObjects(SHEETS.AKTIVITAS);
  aktivitasList.forEach(a => {
    const assigned = (a.assignedTo || "").split(",").map(s => s.trim()).filter(Boolean);
    if (assigned.includes(id)) {
      updateObjectById(SHEETS.AKTIVITAS, a.id, { assignedTo: assigned.filter(x => x !== id).join(",") });
    }
  });

  // Hapus semua laporan dan penilaian terkait
  deleteRowsByCol(SHEETS.LAPORAN, "pegawaiId", id);
  deleteRowsByCol(SHEETS.PENILAIAN, "pegawaiId", id);
  deleteRowsByCol(SHEETS.PENILAIAN, "penilaiId", id);
  deleteRowsByCol(SHEETS.SESSIONS, "userId", id);

  const ok = deleteRowById(SHEETS.USERS, id);
  if (!ok) throw new Error("Pengguna tidak ditemukan.");
  return { ok: true };
}

/* ========================= AKTIVITAS HANDLERS ========================= */
function normalizeAktivitasOut(a) {
  return Object.assign({}, a, {
    assignedTo: (a.assignedTo || "").split(",").map(s => s.trim()).filter(Boolean),
    target: Number(a.target) || 0,
  });
}

function handleCreateAktivitas(body) {
  const current = requireUser(body.token);
  if (current.role !== "admin" && current.role !== "ketua_tim") {
    throw new Error("Akses ditolak.");
  }
  if (!body.nama || !body.target) throw new Error("Nama aktivitas dan target wajib diisi.");
  const item = {
    id: newId("akt"),
    tujuan: body.tujuan || "", sasaran: body.sasaran || "", iku: body.iku || "",
    kegiatan: body.kegiatan || "", subKegiatan: body.subKegiatan || "",
    nama: body.nama, target: Number(body.target), satuan: body.satuan || "",
    periodeMulai: body.periodeMulai || "", periodeSelesai: body.periodeSelesai || "",
    assignedTo: Array.isArray(body.assignedTo) ? body.assignedTo.join(",") : "",
    createdBy: current.id, createdAt: Date.now(),
  };
  appendObject(SHEETS.AKTIVITAS, item);
  return normalizeAktivitasOut(item);
}

function handleUpdateAktivitas(body) {
  const current = requireUser(body.token);
  if (current.role !== "admin" && current.role !== "ketua_tim") {
    throw new Error("Akses ditolak.");
  }
  const patch = {};
  ["tujuan", "sasaran", "iku", "kegiatan", "subKegiatan", "nama", "satuan", "periodeMulai", "periodeSelesai"].forEach(k => {
    if (body[k] !== undefined) patch[k] = body[k];
  });
  if (body.target !== undefined) patch.target = Number(body.target);
  if (body.assignedTo !== undefined) patch.assignedTo = Array.isArray(body.assignedTo) ? body.assignedTo.join(",") : "";
  const updated = updateObjectById(SHEETS.AKTIVITAS, body.id, patch);
  if (!updated) throw new Error("Aktivitas tidak ditemukan.");
  return normalizeAktivitasOut(updated);
}

function handleDeleteAktivitas(body) {
  const current = requireUser(body.token);
  if (current.role !== "admin" && current.role !== "ketua_tim") {
    throw new Error("Akses ditolak.");
  }
  deleteRowsByCol(SHEETS.LAPORAN, "aktivitasId", body.id);
  const ok = deleteRowById(SHEETS.AKTIVITAS, body.id);
  if (!ok) throw new Error("Aktivitas tidak ditemukan.");
  return { ok: true };
}

/* ========================= LAPORAN HANDLERS ========================= */
function normalizeLaporanOut(l) {
  return Object.assign({}, l, {
    capaian: Number(l.capaian) || 0,
    createdAt: Number(l.createdAt) || 0
  });
}

function saveBuktiFileToDrive(base64Data, fileName, mimeType) {
  const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  const bytes = Utilities.base64Decode(base64Data);
  const blob = Utilities.newBlob(bytes, mimeType || "application/octet-stream", fileName || "bukti");
  const file = folder.createFile(blob);
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    Logger.log("setSharing gagal: " + e.message);
  }
  return { url: "https://drive.google.com/uc?id=" + file.getId(), name: fileName || file.getName() };
}

function checkLaporanLocked(pegawaiId, tanggal) {
  if (!tanggal) return;
  const bulan = String(tanggal).slice(0, 7); // "YYYY-MM"
  const pengajuans = sheetToObjects(SHEETS.PENGAJUAN);
  const exists = pengajuans.find(p => p.pegawaiId === pegawaiId && p.bulan === bulan && p.status === "diajukan");
  if (exists) {
    throw new Error("Laporan untuk bulan ini sudah dikunci dan diajukan. Hubungi Penilai/Admin untuk membuka kunci.");
  }
}

function handleCreateLaporan(body) {
  const current = requireUser(body.token);
  if (current.role !== "pegawai") {
    throw new Error("Hanya pegawai yang dapat mengisi laporan harian.");
  }
  if (!body.aktivitasId || !body.tanggal || !body.uraian || !body.capaian) {
    throw new Error("Aktivitas, tanggal, uraian, dan capaian wajib diisi.");
  }
  
  checkLaporanLocked(current.id, body.tanggal);

  const aktivitas = sheetToObjects(SHEETS.AKTIVITAS).find(a => a.id === body.aktivitasId);
  if (!aktivitas) throw new Error("Aktivitas tidak ditemukan.");
  const assigned = (aktivitas.assignedTo || "").split(",").map(s => s.trim()).filter(Boolean);
  if (!assigned.includes(current.id)) throw new Error("Anda tidak ditugaskan pada aktivitas ini.");

  let buktiUrl = "", buktiNama = "";
  const buktiTipe = body.buktiTipe === "file" ? "file" : "link";
  if (buktiTipe === "file" && body.buktiFileBase64) {
    const saved = saveBuktiFileToDrive(body.buktiFileBase64, body.buktiFileName, body.buktiFileMime);
    buktiUrl = saved.url; buktiNama = saved.name;
  } else if (buktiTipe === "link") {
    buktiUrl = (body.buktiLink || "").trim();
  }

  const item = {
    id: newId("lap"), aktivitasId: body.aktivitasId, pegawaiId: current.id,
    tanggal: body.tanggal, uraian: String(body.uraian).trim(), capaian: Number(body.capaian),
    buktiTipe, buktiUrl, buktiNama, createdAt: Date.now(),
  };
  appendObject(SHEETS.LAPORAN, item);
  return item;
}

function handleUpdateLaporan(body) {
  const current = requireUser(body.token);
  const existing = sheetToObjects(SHEETS.LAPORAN).find(l => l.id === body.id);
  if (!existing) throw new Error("Laporan tidak ditemukan.");
  if (existing.pegawaiId !== current.id && current.role !== "admin" && current.role !== "ketua_tim") {
    throw new Error("Anda tidak dapat mengubah laporan ini.");
  }

  checkLaporanLocked(existing.pegawaiId, existing.tanggal);
  if (body.tanggal && body.tanggal !== existing.tanggal) {
    checkLaporanLocked(existing.pegawaiId, body.tanggal);
  }

  const patch = {};
  if (body.tanggal) patch.tanggal = body.tanggal;
  if (body.uraian) patch.uraian = String(body.uraian).trim();
  if (body.capaian !== undefined) patch.capaian = Number(body.capaian);
  if (body.buktiTipe === "file" && body.buktiFileBase64) {
    const saved = saveBuktiFileToDrive(body.buktiFileBase64, body.buktiFileName, body.buktiFileMime);
    patch.buktiTipe = "file"; patch.buktiUrl = saved.url; patch.buktiNama = saved.name;
  } else if (body.buktiTipe === "link") {
    patch.buktiTipe = "link"; patch.buktiUrl = (body.buktiLink || "").trim(); patch.buktiNama = "";
  }
  const updated = updateObjectById(SHEETS.LAPORAN, body.id, patch);
  return updated;
}

function handleDeleteLaporan(body) {
  const current = requireUser(body.token);
  const existing = sheetToObjects(SHEETS.LAPORAN).find(l => l.id === body.id);
  if (!existing) throw new Error("Laporan tidak ditemukan.");
  if (existing.pegawaiId !== current.id && current.role !== "admin" && current.role !== "ketua_tim") {
    throw new Error("Anda tidak dapat menghapus laporan ini.");
  }

  checkLaporanLocked(existing.pegawaiId, existing.tanggal);

  deleteRowById(SHEETS.LAPORAN, body.id);
  return { ok: true };
}

/* ========================= PENGAJUAN HANDLERS ========================= */
function handleCreatePengajuan(body) {
  const current = requireUser(body.token);
  const pegawaiId = body.pegawaiId || current.id;
  
  if (current.id !== pegawaiId && current.role !== "admin" && current.role !== "penilai") {
    throw new Error("Akses ditolak.");
  }
  
  if (!body.bulan) throw new Error("Bulan wajib ditentukan.");
  const bulan = String(body.bulan).slice(0, 7);
  
  const list = sheetToObjects(SHEETS.PENGAJUAN);
  const exists = list.find(p => p.pegawaiId === pegawaiId && p.bulan === bulan);
  if (exists) {
    if (exists.status === "diajukan") return exists;
    const updated = updateObjectById(SHEETS.PENGAJUAN, exists.id, { status: "diajukan", createdAt: Date.now() });
    return updated;
  }
  
  const item = {
    id: newId("pgj"),
    pegawaiId,
    bulan,
    status: "diajukan",
    createdAt: Date.now()
  };
  appendObject(SHEETS.PENGAJUAN, item);
  return item;
}

function handleDeletePengajuan(body) {
  const current = requireUser(body.token);
  const pegawaiId = body.pegawaiId || current.id;
  
  if (!body.bulan) {
    throw new Error("Bulan wajib ditentukan.");
  }
  const bulan = String(body.bulan).slice(0, 7);
  
  // Jika pegawai mencoba membatalkan kuncinya sendiri
  if (current.id === pegawaiId) {
    const hasPenilaian = sheetToObjects(SHEETS.PENILAIAN).some(p => p.pegawaiId === pegawaiId && p.bulan === bulan);
    if (hasPenilaian) {
      throw new Error("Laporan Anda sudah dinilai oleh Penilai. Silakan hubungi Penilai Anda untuk membuka kunci.");
    }
  } else {
    // Jika orang lain yang mencoba menghapus, harus admin, penilai, atau ketua_tim
    if (current.role !== "admin" && current.role !== "penilai" && current.role !== "ketua_tim") {
      throw new Error("Akses ditolak. Anda tidak berwenang membuka kunci laporan ini.");
    }
  }
  
  const list = sheetToObjects(SHEETS.PENGAJUAN);
  const exists = list.find(p => p.pegawaiId === pegawaiId && p.bulan === bulan);
  if (!exists) {
    throw new Error(`Pengajuan untuk pegawai ID ${pegawaiId} pada bulan ${bulan} tidak ditemukan.`);
  }
  deleteRowById(SHEETS.PENGAJUAN, exists.id);
  return { ok: true };
}

/* ========================= PENILAIAN HANDLERS ========================= */
function normalizePenilaianOut(p) {
  return Object.assign({}, p, {
    berorientasiPelayanan: Number(p.berorientasiPelayanan) || 0,
    akuntabel: Number(p.akuntabel) || 0,
    kompeten: Number(p.kompeten) || 0,
    harmonis: Number(p.harmonis) || 0,
    loyal: Number(p.loyal) || 0,
    adaptif: Number(p.adaptif) || 0,
    kolaboratif: Number(p.kolaboratif) || 0,
    createdAt: Number(p.createdAt) || 0
  });
}

function handleCreatePenilaian(body) {
  const current = requireUser(body.token);
  if (current.role !== "admin" && current.role !== "penilai") {
    throw new Error("Akses ditolak. Hanya Admin dan Penilai yang dapat melakukan penilaian.");
  }
  if (!body.pegawaiId || !body.bulan || !body.nilaiKinerja) {
    throw new Error("Pegawai, bulan, dan nilai kinerja wajib diisi.");
  }
  const item = {
    id: newId("pen"),
    pegawaiId: body.pegawaiId,
    penilaiId: current.id,
    bulan: body.bulan,
    nilaiKinerja: body.nilaiKinerja,
    berorientasiPelayanan: Number(body.berorientasiPelayanan) || 0,
    akuntabel: Number(body.akuntabel) || 0,
    kompeten: Number(body.kompeten) || 0,
    harmonis: Number(body.harmonis) || 0,
    loyal: Number(body.loyal) || 0,
    adaptif: Number(body.adaptif) || 0,
    kolaboratif: Number(body.kolaboratif) || 0,
    catatan: body.catatan || "",
    createdAt: Date.now()
  };
  appendObject(SHEETS.PENILAIAN, item);
  return normalizePenilaianOut(item);
}

function handleUpdatePenilaian(body) {
  const current = requireUser(body.token);
  if (current.role !== "admin" && current.role !== "penilai") {
    throw new Error("Akses ditolak. Hanya Admin dan Penilai yang dapat melakukan penilaian.");
  }
  const patch = {};
  ["nilaiKinerja", "catatan"].forEach(k => {
    if (body[k] !== undefined) patch[k] = body[k];
  });
  ["berorientasiPelayanan", "akuntabel", "kompeten", "harmonis", "loyal", "adaptif", "kolaboratif"].forEach(k => {
    if (body[k] !== undefined) patch[k] = Number(body[k]);
  });
  const updated = updateObjectById(SHEETS.PENILAIAN, body.id, patch);
  if (!updated) throw new Error("Penilaian tidak ditemukan.");
  return normalizePenilaianOut(updated);
}

function handleDeletePenilaian(body) {
  const current = requireUser(body.token);
  if (current.role !== "admin" && current.role !== "penilai") {
    throw new Error("Akses ditolak.");
  }
  const ok = deleteRowById(SHEETS.PENILAIAN, body.id);
  if (!ok) throw new Error("Penilaian tidak ditemukan.");
  return { ok: true };
}

function handleBootstrap(token) {
  const users = sheetToObjects(SHEETS.USERS);
  const result = {
    hasUsers: users.length > 0,
    referensi: REFERENSI,
    user: null,
    data: null
  };
  
  if (token) {
    const session = sheetToObjects(SHEETS.SESSIONS).find(s => s.token === token);
    if (session && Date.now() <= Number(session.expiresAt)) {
      const activeUser = users.find(u => u.id === session.userId);
      if (activeUser) {
        result.user = sanitizeUser(activeUser);
        const isTeamMember = ["admin", "ketua_tim", "penilai", "pegawai"].indexOf(activeUser.role) !== -1;
        if (isTeamMember) {
          result.data = {
            users: users.map(sanitizeUser),
            aktivitas: sheetToObjects(SHEETS.AKTIVITAS).map(normalizeAktivitasOut),
            laporan: sheetToObjects(SHEETS.LAPORAN).map(normalizeLaporanOut),
            penilaian: sheetToObjects(SHEETS.PENILAIAN).map(normalizePenilaianOut),
            pengajuan: sheetToObjects(SHEETS.PENGAJUAN)
          };
        }
      }
    }
  }
  return result;
}

function handleRefresh(activeUser) {
  const users = sheetToObjects(SHEETS.USERS);
  return {
    users: users.map(sanitizeUser),
    aktivitas: sheetToObjects(SHEETS.AKTIVITAS).map(normalizeAktivitasOut),
    laporan: sheetToObjects(SHEETS.LAPORAN).map(normalizeLaporanOut),
    penilaian: sheetToObjects(SHEETS.PENILAIAN).map(normalizePenilaianOut),
    pengajuan: sheetToObjects(SHEETS.PENGAJUAN)
  };
}
