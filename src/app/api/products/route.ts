import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest) {
  try {
    const products = await prisma.product.findMany({
      include: {
        stocks: {
          include: {
            warehouse: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Transform to include available stock
    const productsWithStock = products.map((product) => ({
      ...product,
      stocks: product.stocks.map((stock) => ({
        ...stock,
        availableUnits: stock.totalUnits - stock.reservedUnits,
      })),
    }));

    return NextResponse.json(productsWithStock);
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}
