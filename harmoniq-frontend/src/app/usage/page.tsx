"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface UsageItem {
  date: string;
  start: string;
  end: string;
  total_requests: number;
  total_usage_tokens: number;
  total_usage_cost: string;
  total_fee_amount: string;
  total_service_charge_amount: string;
  total_request_cost: string;
  total_wallet_cost: string;
  total_merchant_cost: string;
}

interface UsageTotals {
  total_requests: number;
  total_usage_tokens: number;
  total_usage_cost: string;
  total_fee_amount: string;
  total_service_charge_amount: string;
  total_request_cost: string;
  total_wallet_cost: string;
  total_merchant_cost: string;
}

interface UsageResponse {
  items: UsageItem[];
  totals: UsageTotals;
}

export default function UsagePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usageData, setUsageData] = useState<UsageResponse | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  // Date range state
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30); // Default to last 30 days
    date.setHours(0, 0, 0, 0); // Start of day
    return date.toISOString();
  });
  const [endDate, setEndDate] = useState(() => {
    const date = new Date();
    date.setHours(23, 59, 59, 999); // End of day
    return date.toISOString();
  });
  
  // Filter state
  const [connectionId, setConnectionId] = useState("");
  const [productId, setProductId] = useState("");

  // Fetch usage data via Next.js API route
  const fetchUsageData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        start: startDate,
        end: endDate,
      });

      if (connectionId) params.append("connection_id", connectionId);
      if (productId) params.append("product_id", productId);

      console.log("Fetching usage data with params:", { startDate, endDate, connectionId, productId });

      // Call our internal API route instead of Lava directly
      const response = await fetch(`/api/usage?${params.toString()}`);

      console.log("API response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error("API error:", errorData);
        throw new Error(errorData.error?.message || "Failed to fetch usage data");
      }

      const data: UsageResponse = await response.json();
      console.log("Usage data received:", data);
      setUsageData(data);
    } catch (err) {
      console.error("Error fetching usage data:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch usage data");
    } finally {
      setIsLoading(false);
    }
  };

  // Format currency
  const formatCurrency = (value: string) => {
    const num = parseFloat(value);
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(num);
  };

  // Format number with commas
  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("en-US").format(value);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Auto-fetch on mount
  useEffect(() => {
    if (!usageData && !isLoading) {
      fetchUsageData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#0a0a0f]">
      {/* Animated background gradients */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-linear-to-br from-blue-950/20 via-transparent to-purple-950/20" />
        <div className="animated-gradient absolute inset-0" />
      </div>

      {/* Header */}
      <div className="sticky top-0 z-50 border-b border-blue-500/10 bg-[#0a0f1e]/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/")}
                className="flex items-center gap-2 text-gray-400 transition-colors hover:text-blue-400"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
              </button>
              <div className="w-[120px]">
                <Image
                  src="/full-logo.png"
                  alt="Harmoniq Logo"
                  width={120}
                  height={40}
                  className="h-10 w-[120px] object-contain"
                  quality={100}
                  unoptimized
                />
              </div>
              <h1 className="ml-2 text-2xl font-bold text-white">
                Usage Statistics
              </h1>
            </div>
            <div className="h-10 w-10 overflow-hidden rounded-full border border-blue-500/15 bg-[#0a0f1e] transition-all duration-300 hover:border-blue-500/40 hover:bg-blue-600/10">
              <div className="flex h-full w-full items-center justify-center text-sm font-bold text-blue-400">
                JP
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {/* Filters Section */}
        <div className="mb-6">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="group hover:blue-glow mb-4 flex cursor-pointer items-center gap-2 rounded-xl border border-blue-500/20 bg-[#0a0f1e]/90 px-4 py-2.5 backdrop-blur-xl transition-all duration-300 hover:border-blue-500/40"
          >
            <svg
              className="h-5 w-5 text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
              />
            </svg>
            <span className="text-sm font-medium text-white">
              {showFilters ? "Hide Filters" : "Show Filters"}
            </span>
          </button>

          {showFilters && (
            <div className="animate-in slide-in-from-top-4 rounded-2xl border border-blue-500/15 bg-[#0a0f1e]/90 p-6 backdrop-blur-xl duration-300">
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-600/5 p-3">
                <svg
                  className="h-5 w-5 text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-sm text-gray-300">
                  API key is configured server-side for security
                </p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {/* Start Date */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={startDate.split('T')[0]}
                    onChange={(e) => {
                      const date = new Date(e.target.value);
                      date.setHours(0, 0, 0, 0);
                      setStartDate(date.toISOString());
                    }}
                    className="w-full rounded-lg border border-blue-500/20 bg-[#0a0f1e] px-4 py-2.5 text-sm text-white outline-none transition-colors focus:border-blue-500/50"
                  />
                </div>

                {/* End Date */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate.split('T')[0]}
                    onChange={(e) => {
                      const date = new Date(e.target.value);
                      date.setHours(23, 59, 59, 999);
                      setEndDate(date.toISOString());
                    }}
                    className="w-full rounded-lg border border-blue-500/20 bg-[#0a0f1e] px-4 py-2.5 text-sm text-white outline-none transition-colors focus:border-blue-500/50"
                  />
                </div>

                {/* Connection ID */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    Connection ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={connectionId}
                    onChange={(e) => setConnectionId(e.target.value)}
                    placeholder="Filter by connection"
                    className="w-full rounded-lg border border-blue-500/20 bg-[#0a0f1e] px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition-colors focus:border-blue-500/50"
                  />
                </div>

                {/* Product ID */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-300">
                    Product ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={productId}
                    onChange={(e) => setProductId(e.target.value)}
                    placeholder="Filter by product"
                    className="w-full rounded-lg border border-blue-500/20 bg-[#0a0f1e] px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition-colors focus:border-blue-500/50"
                  />
                </div>

                {/* Fetch Button */}
                <div className="flex items-end">
                  <button
                    onClick={fetchUsageData}
                    disabled={isLoading || !startDate}
                    className={`group hover:blue-glow w-full cursor-pointer rounded-xl border px-6 py-2.5 font-semibold transition-all duration-300 ${
                      isLoading || !startDate
                        ? "cursor-not-allowed border-gray-600/30 bg-transparent text-gray-600"
                        : "border-blue-500/30 bg-transparent text-blue-400 hover:border-blue-500/60 hover:bg-blue-600/20 hover:text-blue-300"
                    }`}
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg
                          className="h-4 w-4 animate-spin"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Loading...
                      </span>
                    ) : (
                      "Refresh Usage Data"
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
            <div className="flex items-center gap-2 text-red-400">
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Info Note about merchant usage */}
        {usageData && usageData.items.length === 0 && (
          <div className="mb-6 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
            <div className="flex items-start gap-3">
              <svg
                className="mt-0.5 h-5 w-5 flex-shrink-0 text-yellow-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="flex-1">
                <p className="mb-1 text-sm font-semibold text-yellow-400">
                  No Customer Usage Data Found
                </p>
                <p className="text-sm text-gray-300">
                  The <code className="rounded bg-yellow-500/20 px-1 py-0.5 text-xs">/v1/usage</code> endpoint tracks billable customer usage only. 
                  Your "Internal (merchant self-usage)" requests may not appear here. 
                  Check your Lava dashboard for complete merchant usage statistics.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Usage Data Display */}
        {usageData && usageData.items.length > 0 && (
          <>
            {/* Summary Cards */}
            <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {/* Total Requests */}
              <div className="group hover:blue-glow rounded-2xl border border-blue-500/15 bg-[#0a0f1e]/90 p-6 backdrop-blur-xl transition-all duration-300">
                <div className="mb-2 flex items-center gap-2">
                  <svg
                    className="h-5 w-5 text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  <p className="text-sm font-medium text-gray-400">
                    Total Requests
                  </p>
                </div>
                <p className="text-3xl font-bold text-white">
                  {formatNumber(usageData.totals.total_requests)}
                </p>
              </div>

              {/* Total Tokens */}
              <div className="group hover:blue-glow rounded-2xl border border-blue-500/15 bg-[#0a0f1e]/90 p-6 backdrop-blur-xl transition-all duration-300">
                <div className="mb-2 flex items-center gap-2">
                  <svg
                    className="h-5 w-5 text-purple-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                    />
                  </svg>
                  <p className="text-sm font-medium text-gray-400">
                    Total Tokens
                  </p>
                </div>
                <p className="text-3xl font-bold text-white">
                  {formatNumber(usageData.totals.total_usage_tokens)}
                </p>
              </div>

              {/* Total Cost */}
              <div className="group hover:blue-glow rounded-2xl border border-blue-500/15 bg-[#0a0f1e]/90 p-6 backdrop-blur-xl transition-all duration-300">
                <div className="mb-2 flex items-center gap-2">
                  <svg
                    className="h-5 w-5 text-green-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="text-sm font-medium text-gray-400">
                    Usage Cost
                  </p>
                </div>
                <p className="text-3xl font-bold text-white">
                  {formatCurrency(usageData.totals.total_usage_cost)}
                </p>
              </div>

              {/* Total Request Cost */}
              <div className="group hover:blue-glow rounded-2xl border border-blue-500/15 bg-[#0a0f1e]/90 p-6 backdrop-blur-xl transition-all duration-300">
                <div className="mb-2 flex items-center gap-2">
                  <svg
                    className="h-5 w-5 text-yellow-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                  <p className="text-sm font-medium text-gray-400">
                    Total Request Cost
                  </p>
                </div>
                <p className="text-3xl font-bold text-white">
                  {formatCurrency(usageData.totals.total_request_cost)}
                </p>
              </div>
            </div>

            {/* Additional Totals */}
            <div className="mb-8 rounded-2xl border border-blue-500/15 bg-[#0a0f1e]/90 p-6 backdrop-blur-xl">
              <h2 className="mb-4 text-xl font-semibold text-white">
                Cost Breakdown
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="flex flex-col">
                  <span className="mb-1 text-sm text-gray-400">Fee Amount</span>
                  <span className="text-lg font-semibold text-white">
                    {formatCurrency(usageData.totals.total_fee_amount)}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="mb-1 text-sm text-gray-400">
                    Service Charges
                  </span>
                  <span className="text-lg font-semibold text-white">
                    {formatCurrency(
                      usageData.totals.total_service_charge_amount
                    )}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="mb-1 text-sm text-gray-400">
                    Wallet Cost
                  </span>
                  <span className="text-lg font-semibold text-white">
                    {formatCurrency(usageData.totals.total_wallet_cost)}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="mb-1 text-sm text-gray-400">
                    Merchant Cost
                  </span>
                  <span className="text-lg font-semibold text-white">
                    {formatCurrency(usageData.totals.total_merchant_cost)}
                  </span>
                </div>
              </div>
            </div>

            {/* Daily Usage Table */}
            <div className="rounded-2xl border border-blue-500/15 bg-[#0a0f1e]/90 backdrop-blur-xl">
              <div className="border-b border-blue-500/10 px-6 py-4">
                <h2 className="text-xl font-semibold text-white">
                  Daily Usage Statistics
                </h2>
                <p className="mt-1 text-sm text-gray-400">
                  Detailed breakdown of usage per day
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-blue-500/10">
                      <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                        Date
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">
                        Requests
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">
                        Tokens
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">
                        Usage Cost
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">
                        Fees
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-400">
                        Total Cost
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-500/10">
                    {usageData.items.map((item, index) => (
                      <tr
                        key={index}
                        className="transition-colors hover:bg-blue-600/5"
                      >
                        <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-white">
                          {formatDate(item.date)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-300">
                          {formatNumber(item.total_requests)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-300">
                          {formatNumber(item.total_usage_tokens)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-300">
                          {formatCurrency(item.total_usage_cost)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-gray-300">
                          {formatCurrency(item.total_fee_amount)}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-semibold text-white">
                          {formatCurrency(item.total_request_cost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Empty State */}
        {!usageData && !isLoading && !error && (
          <div className="flex min-h-[400px] items-center justify-center rounded-2xl border border-blue-500/15 bg-[#0a0f1e]/90 backdrop-blur-xl">
            <div className="text-center">
              <svg
                className="mx-auto mb-4 h-16 w-16 text-blue-400/50"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              <h3 className="mb-2 text-xl font-semibold text-white">
                No Usage Data
              </h3>
              <p className="mb-6 text-gray-400">
                Select a date range to view usage statistics
              </p>
              <button
                onClick={fetchUsageData}
                className="group hover:blue-glow cursor-pointer rounded-xl border border-blue-500/30 bg-transparent px-6 py-3 font-semibold text-blue-400 transition-all duration-300 hover:border-blue-500/60 hover:bg-blue-600/20 hover:text-blue-300"
              >
                Load Usage Data
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

