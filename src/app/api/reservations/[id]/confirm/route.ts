import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
        const error = new Error('Invalid reservation status');
        (error as any).code = 'INVALID_STATUS';
        throw error;
      }

      // Check if reservation has expired
      if (new Date() > res.expiresAt) {
        // Auto-release if expired
        await tx.reservation.update({
          where: { id },
          data: { status: 'released' },
        });

        // Restore stock
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

        const error = new Error('Reservation expired');
        (error as any).code = 'RESERVATION_EXPIRED';
        throw error;
      }

      // Confirm reservation
      const confirmed = await tx.reservation.update({
        where: { id },
        data: {
          status: 'confirmed',
          confirmedAt: new Date(),
        },
        include: {
          product: true,
          warehouse: true,
        },
      });

      // Decrement total units (permanent reduction)
      await tx.stock.update({
        where: {
          productId_warehouseId: {
            productId: res.productId,
            warehouseId: res.warehouseId,
          },
        },
        data: {
          totalUnits: {
            decrement: res.quantity,
          },
          reservedUnits: {
            decrement: res.quantity,
          },
        },
      });

      return confirmed;
    });

    return NextResponse.json(reservation);
  } catch (error: any) {
    console.error('Confirm error:', error);

    if (error.code === 'RESERVATION_EXPIRED') {
      return NextResponse.json(
        { error: 'Reservation has expired' },
        { status: 410 }
      );
    }

    if (error.code === 'INVALID_STATUS') {
      return NextResponse.json(
        { error: 'Cannot confirm this reservation' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to confirm reservation' },
      { status: 500 }
    );
  }
}