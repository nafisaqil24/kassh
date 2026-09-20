const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clear existing data
  await prisma.pembayaran.deleteMany();
  await prisma.anggota.deleteMany();
  await prisma.pertemuan.deleteMany();
  await prisma.pengaturan.deleteMany();

  // Create pengaturan
  await prisma.pengaturan.create({
    data: {
      id: 1,
      periode: 'Oktober 2026',
      nominal: 10000,
    },
  });

  // Create anggota
  const anggotaNames = ['Danang', 'Rian', 'Nayif', 'Nafis', 'Alung', 'Putra'];
  const createdAnggota = [];
  for (const name of anggotaNames) {
    const a = await prisma.anggota.create({ data: { nama: name } });
    createdAnggota.push(a);
  }

  // Create pertemuan
  const pertemuanData = [
    { hari: 'Kamis', tanggal: '1' },
    { hari: 'Sabtu', tanggal: '3' },
    { hari: 'Selasa', tanggal: '6' },
    { hari: 'Kamis', tanggal: '8' },
    { hari: 'Sabtu', tanggal: '10' },
    { hari: 'Selasa', tanggal: '13' },
    { hari: 'Kamis', tanggal: '15' },
    { hari: 'Sabtu', tanggal: '17' },
    { hari: 'Selasa', tanggal: '20' },
    { hari: 'Kamis', tanggal: '22' },
    { hari: 'Sabtu', tanggal: '24' },
    { hari: 'Selasa', tanggal: '27' },
    { hari: 'Kamis', tanggal: '29' },
    { hari: 'Sabtu', tanggal: '31' },
  ];

  const createdPertemuan = [];
  for (const p of pertemuanData) {
    const pert = await prisma.pertemuan.create({ data: p });
    createdPertemuan.push(pert);
  }

  // Initialize pembayaran records (all false by default, maybe a few random true for seed realism if wanted, or all false)
  for (const anggota of createdAnggota) {
    for (const pertemuan of createdPertemuan) {
      await prisma.pembayaran.create({
        data: {
          anggotaId: anggota.id,
          pertemuanId: pertemuan.id,
          status: false,
        },
      });
    }
  }

  console.log('Seeding finished successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
