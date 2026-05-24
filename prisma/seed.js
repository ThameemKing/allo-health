const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // Clear existing data
  await prisma.reservation.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.idempotencyKey.deleteMany();

  // Create warehouses
  const warehouseNY = await prisma.warehouse.create({
    data: {
      name: 'New York Warehouse',
      location: 'New York, NY',
    },
  });

  const warehouseLA = await prisma.warehouse.create({
    data: {
      name: 'Los Angeles Warehouse',
      location: 'Los Angeles, CA',
    },
  });

  const warehouseChicago = await prisma.warehouse.create({
    data: {
      name: 'Chicago Warehouse',
      location: 'Chicago, IL',
    },
  });

  // Create products
  const laptop = await prisma.product.create({
    data: {
      name: 'Premium Laptop',
      sku: 'LAPTOP-001',
      description: 'High-performance laptop for professionals',
    },
  });

  const monitor = await prisma.product.create({
    data: {
      name: '4K Monitor',
      sku: 'MONITOR-001',
      description: 'Ultra HD 4K display monitor',
    },
  });

  const keyboard = await prisma.product.create({
    data: {
      name: 'Mechanical Keyboard',
      sku: 'KEYBOARD-001',
      description: 'Professional mechanical keyboard',
    },
  });

  const mouse = await prisma.product.create({
    data: {
      name: 'Wireless Mouse',
      sku: 'MOUSE-001',
      description: 'Ergonomic wireless mouse',
    },
  });

  // Create stock entries
  await prisma.stock.create({
    data: {
      productId: laptop.id,
      warehouseId: warehouseNY.id,
      totalUnits: 50,
      reservedUnits: 0,
    },
  });

  await prisma.stock.create({
    data: {
      productId: laptop.id,
      warehouseId: warehouseLA.id,
      totalUnits: 30,
      reservedUnits: 0,
    },
  });

  await prisma.stock.create({
    data: {
      productId: monitor.id,
      warehouseId: warehouseNY.id,
      totalUnits: 100,
      reservedUnits: 0,
    },
  });

  await prisma.stock.create({
    data: {
      productId: monitor.id,
      warehouseId: warehouseLA.id,
      totalUnits: 75,
      reservedUnits: 0,
    },
  });

  await prisma.stock.create({
    data: {
      productId: keyboard.id,
      warehouseId: warehouseChicago.id,
      totalUnits: 200,
      reservedUnits: 0,
    },
  });

  await prisma.stock.create({
    data: {
      productId: mouse.id,
      warehouseId: warehouseChicago.id,
      totalUnits: 150,
      reservedUnits: 0,
    },
  });

  console.log('✓ Database seeded successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
