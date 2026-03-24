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
  .catch((error) => {
    console.error('Error:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
