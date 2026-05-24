import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // Verify this is a cron request from Vercel
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const now = new Date();

    // Find all expired pending reservations
    const expiredReservations = await prisma.reservation.findMany({
      where: {
        status: 'pending',
        expiresAt: {
          lt: now,
        },
      },
    });

    // Release each expired reservation
    for (const reservation of expiredReservations) {
      await prisma.$transaction(async (tx) => {
        // Update reservation status
        await tx.reservation.update({
          where: { id: reservation.id },
          data: { status: 'released' },
        });

        // Restore reserved units
        await tx.stock.update({
          where: {
            productId_warehouseId: {
              productId: reservation.productId,
              warehouseId: reservation.warehouseId,
            },
          },
          data: {
            reservedUnits: {
              decrement: reservation.quantity,
            },
          },
        });
      });
    }

    return NextResponse.json({
      success: true,
      released: expiredReservations.length,
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      { error: 'Failed to release expired reservations' },
      { status: 500 }
    );
  }
}