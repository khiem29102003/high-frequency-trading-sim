import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const assets = [
    { symbol: 'AAPL', name: 'Apple Inc.' },
    { symbol: 'MSFT', name: 'Microsoft Corp.' },
    { symbol: 'BTC-USD', name: 'Bitcoin / USD' },
  ];
  for (const asset of assets) {
    await prisma.asset.upsert({
      where: { symbol: asset.symbol },
      create: { ...asset, priceDecimals: 8, qtyDecimals: 8, isActive: true },
      update: { name: asset.name, isActive: true },
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
