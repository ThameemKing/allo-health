'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { apiCall } from '@/lib/api-client';
import Link from 'next/link';

interface Reservation {
  id: string;
  productId: string;
  warehouseId: string;
  quantity: number;
  status: string;
  expiresAt: string;
  createdAt: string;
  product: { name: string };
  warehouse: { name: string };
}

function ReservationContent() {
  const params = useParams();
  const router = useRouter();
  const reservationId = params.id as string;

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isExpired, setIsExpired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchReservation = async () => {
      const { data, error: apiError } = await apiCall<Reservation>(
        `/api/reservations/${reservationId}`
      );

      if (apiError) {
        setError(apiError);
      } else if (data) {
        setReservation(data);
      }
      setLoading(false);
    };

    fetchReservation();
  }, [reservationId]);

  useEffect(() => {
    if (!reservation) return;

    const timer = setInterval(() => {
      const now = new Date();
      const expiresAt = new Date(reservation.expiresAt);
      const diff = expiresAt.getTime() - now.getTime();

      if (diff <= 0) {
        setIsExpired(true);
        setTimeLeft('Expired');
        clearInterval(timer);
      } else {
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [reservation]);

  const handleConfirm = async () => {
    setConfirming(true);
    setError(null);

    const { data, error: apiError, status } = await apiCall(
      `/api/reservations/${reservationId}/confirm`,
      { method: 'POST' }
    );

    if (apiError) {
      if (status === 410) {
        setError('Reservation has expired. Please try again.');
        setIsExpired(true);
      } else {
        setError(apiError);
      }
    } else if (data) {
      setSuccess(true);
      setReservation((data as any) as Reservation);
    }

    setConfirming(false);
  };

  const handleRelease = async () => {
    setReleasing(true);
    setError(null);

    const { error: apiError } = await apiCall(
      `/api/reservations/${reservationId}/release`,
      { method: 'POST' }
    );

    if (apiError) {
      setError(apiError);
    } else {
      router.push('/?cancelled=true');
    }

    setReleasing(false);
  };

  if (loading) {
    return <div className="p-8 text-center">Loading reservation...</div>;
  }

  if (!reservation) {
    return (
      <div className="p-8 text-center text-red-600">
        Reservation not found
        <br />
        <Link href="/" className="text-blue-600 hover:text-blue-700">
          Back to Products
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">✓</div>
          <h1 className="text-2xl font-bold text-green-600 mb-2">
            Purchase Confirmed!
          </h1>
          <p className="text-gray-600 mb-6">
            Order for {reservation.quantity}x {reservation.product.name} has been
            confirmed.
          </p>
          <Link
            href="/"
            className="block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition font-medium"
          >
            Back to Products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto mt-12">
        <Link href="/" className="text-blue-600 hover:text-blue-700 mb-6 inline-block">
          ← Back to Products
        </Link>

        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Confirm Purchase</h1>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded">
              <p className="text-red-800">✗ {error}</p>
            </div>
          )}

          <div className="space-y-4 mb-8">
            <div className="flex justify-between items-center pb-4 border-b border-gray-200">
              <span className="text-gray-600">Product:</span>
              <span className="font-semibold text-gray-900">
                {reservation.product.name}
              </span>
            </div>

            <div className="flex justify-between items-center pb-4 border-b border-gray-200">
              <span className="text-gray-600">Quantity:</span>
              <span className="font-semibold text-gray-900">
                {reservation.quantity}
              </span>
            </div>

            <div className="flex justify-between items-center pb-4 border-b border-gray-200">
              <span className="text-gray-600">Warehouse:</span>
              <span className="font-semibold text-gray-900">
                {reservation.warehouse.name}
              </span>
            </div>

            <div className="flex justify-between items-center pt-4 bg-blue-50 p-4 rounded">
              <span className="text-gray-600 font-medium">Time remaining:</span>
              <span
                className={`text-2xl font-bold ${
                  isExpired ? 'text-red-600' : 'text-blue-600'
                }`}
              >
                {timeLeft}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={handleConfirm}
              disabled={confirming || isExpired}
              className="w-full px-4 py-3 bg-green-600 text-white rounded font-medium hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
            >
              {confirming ? 'Confirming...' : 'Confirm Purchase'}
            </button>

            <button
              onClick={handleRelease}
              disabled={releasing}
              className="w-full px-4 py-3 bg-red-100 text-red-700 rounded font-medium hover:bg-red-200 disabled:bg-gray-200 disabled:cursor-not-allowed transition"
            >
              {releasing ? 'Cancelling...' : 'Cancel Reservation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReservationPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading reservation...</div>}>
      <ReservationContent />
    </Suspense>
  );
}