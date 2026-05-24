import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const reservation = await prisma.$transaction(async (tx) => {
      const res = await tx.reservation.findUnique({
        where: { id },
      });

      if (!res) {
        throw new Error('Reservation not found');
      }

      if (res.status !== 'pending') {
        throw new Error('Reservation already processed');
      }

      // Release reservation
      const released = await tx.reservation.update({
        where: { id },
        data: { status: 'released' },
        include: {
          product: true,
          warehouse: true,
        },
      });

      // Restore reserved units
      await tx.stock.update({
        where: {
          productId_warehouseId: {
            productId: res.productId,
            warehouseId: res.warehouseId,
          },
        },
        data: {
          reservedUnits: {
            decrement: res.quantity,
          },
        },
      });

      return released;
    });

    return NextResponse.json(reservation);
  } catch (error: any) {
    console.error('Release error:', error);

    return NextResponse.json(
      { error: 'Failed to release reservation' },
      { status: 500 }
    );
  }
}