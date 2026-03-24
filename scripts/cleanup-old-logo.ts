import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Updating stores with old logo path...');
  const result = await prisma.store.updateMany({
    where: {
      logo: '/assets/images/logo.png'
    },
    data: {
      logo: '/assets/images/no_image.png'
    }
  });
  console.log(`✓ Updated ${result.count} stores to use no_image.png`);
}

main()
  .catch((error: unknown) => {
    if (error instanceof Error) {
      console.error('[cleanup-old-logo] Error:', error.message, { stack: error.stack });
    } else {
      console.error('[cleanup-old-logo] Error:', error);
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
