import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ReserveSchema = z.object({
  productId: z.string().cuid('Invalid product ID'),
  warehouseId: z.string().cuid('Invalid warehouse ID'),
  quantity: z.number().int().positive('Quantity must be positive'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { productId, warehouseId, quantity } = ReserveSchema.parse(body);

    const reservation = await prisma.$transaction(async (tx) => {
      // Get the stock row
      const stock = await tx.stock.findUnique({
        where: {
          productId_warehouseId: { productId, warehouseId },
        },
      });

      if (!stock) {
        throw new Error('Stock not found');
      }

      const availableUnits = stock.totalUnits - stock.reservedUnits;

      if (availableUnits < quantity) {
        const error = new Error('Insufficient stock');
        (error as any).code = 'INSUFFICIENT_STOCK';
        throw error;
      }

      // Create reservation with 10-minute expiry
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      const res = await tx.reservation.create({
        data: {
          productId,
          warehouseId,
          quantity,
          status: 'pending',
          expiresAt,
        },
        include: {
          product: true,
          warehouse: true,
        },
      });

      // Update stock - increment reserved units
      await tx.stock.update({
        where: {
          productId_warehouseId: { productId, warehouseId },
        },
        data: {
          reservedUnits: {
            increment: quantity,
          },
        },
      });

      return res;
    });

    return NextResponse.json(reservation, { status: 201 });
  } catch (error: any) {
    console.error('Reservation error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }

    if (error.code === 'INSUFFICIENT_STOCK') {
      return NextResponse.json(
        { error: 'Insufficient stock available' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create reservation' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const reservations = await prisma.reservation.findMany({
      include: {
        product: true,
        warehouse: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(reservations);
  } catch (error) {
    console.error('Error fetching reservations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reservations' },
      { status: 500 }
    );
  }
}