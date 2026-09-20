const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Get all app data (anggota, pertemuan, pembayaran, pengaturan)
app.get('/api/data', async (req, res) => {
  try {
    const anggota = await prisma.anggota.findMany({
      orderBy: { id: 'asc' },
    });
    const pertemuan = await prisma.pertemuan.findMany({
      orderBy: { id: 'asc' },
    });
    const pembayaran = await prisma.pembayaran.findMany();
    let pengaturan = await prisma.pengaturan.findUnique({
      where: { id: 1 },
    });

    if (!pengaturan) {
      pengaturan = await prisma.pengaturan.create({
        data: { id: 1, periode: 'Oktober 2026', nominal: 10000 },
      });
    }

    res.json({ anggota, pertemuan, pembayaran, pengaturan });
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Gagal mengambil data kas' });
  }
});

// Add Anggota
app.post('/api/anggota', async (req, res) => {
  try {
    const { nama } = req.body;
    if (!nama || !nama.trim()) {
      return res.status(400).json({ error: 'Nama anggota wajib diisi' });
    }

    const newAnggota = await prisma.anggota.create({
      data: { nama: nama.trim() },
    });

    // Create default pembayaran entries for all existing pertemuan
    const allPertemuan = await prisma.pertemuan.findMany();
    for (const p of allPertemuan) {
      await prisma.pembayaran.create({
        data: {
          anggotaId: newAnggota.id,
          pertemuanId: p.id,
          status: false,
        },
      });
    }

    const updatedData = await prisma.anggota.findMany({ orderBy: { id: 'asc' } });
    const updatedPembayaran = await prisma.pembayaran.findMany();
    res.json({ anggota: updatedData, pembayaran: updatedPembayaran, newAnggota });
  } catch (error) {
    console.error('Error adding anggota:', error);
    res.status(500).json({ error: 'Gagal menambah anggota' });
  }
});

// Delete Anggota
app.delete('/api/anggota/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.anggota.delete({
      where: { id },
    });
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error deleting anggota:', error);
    res.status(500).json({ error: 'Gagal menghapus anggota' });
  }
});

// Add Pertemuan
app.post('/api/pertemuan', async (req, res) => {
  try {
    const { hari, tanggal } = req.body;
    if (!hari || !tanggal) {
      return res.status(400).json({ error: 'Hari dan tanggal wajib diisi' });
    }

    const newPertemuan = await prisma.pertemuan.create({
      data: { hari, tanggal },
    });

    // Create default pembayaran entries for all existing anggota
    const allAnggota = await prisma.anggota.findMany();
    for (const a of allAnggota) {
      await prisma.pembayaran.create({
        data: {
          anggotaId: a.id,
          pertemuanId: newPertemuan.id,
          status: false,
        },
      });
    }

    res.json(newPertemuan);
  } catch (error) {
    console.error('Error adding pertemuan:', error);
    res.status(500).json({ error: 'Gagal menambah pertemuan' });
  }
});

// Delete Pertemuan
app.delete('/api/pertemuan/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await prisma.pertemuan.delete({
      where: { id },
    });
    res.json({ success: true, id });
  } catch (error) {
    console.error('Error deleting pertemuan:', error);
    res.status(500).json({ error: 'Gagal menghapus pertemuan' });
  }
});

// Update Pengaturan (periode, nominal)
app.put('/api/pengaturan', async (req, res) => {
  try {
    const { periode, nominal } = req.body;
    const updated = await prisma.pengaturan.upsert({
      where: { id: 1 },
      update: {
        ...(periode !== undefined ? { periode } : {}),
        ...(nominal !== undefined ? { nominal: parseInt(nominal) } : {}),
      },
      create: {
        id: 1,
        periode: periode || 'Oktober 2026',
        nominal: nominal ? parseInt(nominal) : 10000,
      },
    });
    res.json(updated);
  } catch (error) {
    console.error('Error updating pengaturan:', error);
    res.status(500).json({ error: 'Gagal memperbarui pengaturan' });
  }
});

// Update Pembayaran Status (Toggle)
app.put('/api/pembayaran', async (req, res) => {
  try {
    const { anggotaId, pertemuanId, status } = req.body;
    if (anggotaId === undefined || pertemuanId === undefined || status === undefined) {
      return res.status(400).json({ error: 'Data pembayaran tidak lengkap' });
    }

    const updated = await prisma.pembayaran.upsert({
      where: {
        anggotaId_pertemuanId: {
          anggotaId: parseInt(anggotaId),
          pertemuanId: parseInt(pertemuanId),
        },
      },
      update: { status: Boolean(status) },
      create: {
        anggotaId: parseInt(anggotaId),
        pertemuanId: parseInt(pertemuanId),
        status: Boolean(status),
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating pembayaran:', error);
    res.status(500).json({ error: 'Gagal memperbarui status pembayaran' });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
