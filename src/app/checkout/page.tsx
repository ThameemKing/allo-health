'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiCall } from '@/lib/api-client';
import Link from 'next/link';

interface Warehouse {
  id: string;
  name: string;
  location: string;
}

export default function CheckoutPage() {
  const searchParams = useSearchParams();
  const productId = searchParams.get('productId');
  const warehouseId = searchParams.get('warehouseId');
  const quantity = searchParams.get('quantity') || '1';

  const [loading, setLoading] = useState(false);
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<number | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  const [selectedQuantity, setSelectedQuantity] = useState(quantity);

  useEffect(() => {
    const fetchWarehouses = async () => {
      const { data } = await apiCall<Warehouse[]>('/api/warehouses');
      if (data) setWarehouses(data);
    };
    fetchWarehouses();
  }, []);

  const handleReserve = async () => {
    if (!productId || !warehouseId) {
      setError('Invalid request');
      return;
    }

    setLoading(true);
    setError(null);
    setErrorCode(null);

    const { data, error: apiError, status } = await apiCall(
      '/api/reservations',
      {
        method: 'POST',
        body: JSON.stringify({
          productId,
          warehouseId,
          quantity: parseInt(selectedQuantity),
        }),
      }
    );

    if (apiError) {
      setError(apiError);
      setErrorCode(status);
    } else if (data && (data as any).id) {
      setReservationId((data as any).id);
    }

    setLoading(false);
  };

  const warehouse = warehouses.find((w) => w.id === warehouseId);

  if (reservationId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <h1 className="text-2xl font-bold text-green-600 mb-4">✓ Reserved!</h1>
          <p className="text-gray-600 mb-6">
            Your reservation has been created. Complete your purchase to confirm.
          </p>
          <Link
            href={`/reservation/${reservationId}`}
            className="block w-full px-4 py-2 bg-blue-600 text-white text-center rounded hover:bg-blue-700 transition font-medium"
          >
            Complete Purchase
          </Link>
          <Link href="/" className="block w-full mt-3 px-4 py-2 bg-gray-200 text-gray-900 text-center rounded hover:bg-gray-300 transition font-medium">
            Back to Products
          </Link>
        </div>
      </div>
    );
  }

  const getErrorMessage = () => {
    if (errorCode === 409) {
      return '❌ Not enough stock available. Please try a different quantity or warehouse.';
    }
    if (errorCode === 410) {
      return '⏰ Reservation expired. Please try again.';
    }
    return `❌ ${error}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto mt-12">
        <Link href="/" className="text-blue-600 hover:text-blue-700 mb-6 inline-block">
          ← Back to Products
        </Link>

        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Reserve Items</h1>

          {error && (
            <div
              className={`mb-6 p-4 rounded ${
                errorCode === 409
                  ? 'bg-red-50 border border-red-200'
                  : errorCode === 410
                  ? 'bg-yellow-50 border border-yellow-200'
                  : 'bg-red-50 border border-red-200'
              }`}
            >
              <p
                className={
                  errorCode === 409 ? 'text-red-800' : errorCode === 410 ? 'text-yellow-800' : 'text-red-800'
                }
              >
                {getErrorMessage()}
              </p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quantity
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={selectedQuantity}
                onChange={(e) => setSelectedQuantity(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
              />
            </div>

            {warehouse && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Warehouse
                </label>
                <p className="px-3 py-2 bg-gray-50 rounded border border-gray-200">
                  {warehouse.name} ({warehouse.location})
                </p>
              </div>
            )}

            <button
              onClick={handleReserve}
              disabled={loading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:bg-gray-400 transition"
            >
              {loading ? 'Reserving...' : 'Reserve Now'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
