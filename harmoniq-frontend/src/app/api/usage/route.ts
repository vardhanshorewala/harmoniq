import { NextRequest, NextResponse } from "next/server";
import { env } from "~/env";

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const start = searchParams.get("start");
    const end = searchParams.get("end");
    const connectionId = searchParams.get("connection_id");
    const productId = searchParams.get("product_id");

    console.log("Usage API called with params:", { start, end, connectionId, productId });
    console.log("Start date parsed:", start ? new Date(start).toISOString() : 'none');
    console.log("End date parsed:", end ? new Date(end).toISOString() : 'none');

    // Validate required parameters
    if (!start) {
      return NextResponse.json(
        { error: { message: "Start date is required", code: "missing_start_date" } },
        { status: 400 }
      );
    }

    // Check for API key
    if (!env.LAVA_API_KEY) {
      console.error("LAVA_API_KEY is not configured!");
      return NextResponse.json(
        { error: { message: "Lava API key not configured on server. Please set LAVA_API_KEY in your .env.local file", code: "missing_api_key" } },
        { status: 500 }
      );
    }

    console.log("Using API key:", env.LAVA_API_KEY.substring(0, 10) + "...");
    console.log("API key length:", env.LAVA_API_KEY.length);

    // Build query parameters for Lava API
    const params = new URLSearchParams({ start });
    if (end) params.append("end", end);
    if (connectionId) params.append("connection_id", connectionId);
    if (productId) params.append("product_id", productId);

    const apiUrl = `https://api.lavapayments.com/v1/usage?${params.toString()}`;
    console.log("Calling Lava API:", apiUrl);

    // Call Lava API
    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${env.LAVA_API_KEY}`,
      },
      cache: "no-store", // Don't cache usage data
    });

    console.log("Lava API response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Lava API error response:", errorText);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: { message: errorText || "Failed to fetch usage data" } };
      }
      
      return NextResponse.json(
        { error: errorData.error || { message: "Failed to fetch usage data", details: errorText } },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("Lava API success, items count:", data.items?.length || 0);
    console.log("Lava API totals:", data.totals);
    if (data.items?.length > 0) {
      console.log("First item:", data.items[0]);
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching usage data:", error);
    return NextResponse.json(
      { 
        error: { 
          message: error instanceof Error ? error.message : "Internal server error", 
          code: "internal_error" 
        } 
      },
      { status: 500 }
    );
  }
}

