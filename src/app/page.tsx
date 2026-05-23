'use client';

import { useEffect, useState } from 'react';
import { apiCall } from '@/lib/api-client';
import Link from 'next/link';

interface Stock {
  id: string;
  warehouse: { id: string; name: string };
  totalUnits: number;
  reservedUnits: number;
  availableUnits: number;
}

interface Product {
  id: string;
  name: string;
  sku: string;
  description?: string;
  stocks: Stock[];
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const { data, error: apiError } = await apiCall<Product[]>('/api/products');
        if (apiError) {
          setError(apiError);
        } else if (data) {
          setProducts(data);
        }
      } catch (err) {
        setError('Failed to fetch products');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  if (loading) {
    return <div className="p-8 text-center">Loading products...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-600">Error: {error}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Allo Health Inventory</h1>
          <p className="text-gray-600 mt-2">Browse and reserve products</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map((product) => (
            <div
              key={product.id}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <h2 className="text-xl font-semibold text-gray-900">{product.name}</h2>
              <p className="text-sm text-gray-600 mt-1">SKU: {product.sku}</p>
              {product.description && (
                <p className="text-gray-600 mt-2 text-sm">{product.description}</p>
              )}

              <div className="mt-6 space-y-3">
                {product.stocks.map((stock) => (
                  <div
                    key={stock.id}
                    className="p-3 bg-gray-50 rounded border border-gray-200"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium text-gray-900">
                          {stock.warehouse.name}
                        </p>
                        <p
                          className={`text-sm ${
                            stock.availableUnits > 0
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                        >
                          {stock.availableUnits} available
                        </p>
                      </div>
                      {stock.availableUnits > 0 && (
                        <Link
                          href={`/checkout?productId=${product.id}&warehouseId=${stock.warehouse.id}`}
                          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition"
                        >
                          Reserve
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
