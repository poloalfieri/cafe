import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validar datos requeridos
    const { total_amount, items, mesa_id } = body;
    
    if (!total_amount || !items || !mesa_id) {
      return NextResponse.json(
        { error: "Faltan campos requeridos: total_amount, items, mesa_id" },
        { status: 400 }
      );
    }

    // Validar que el monto sea positivo
    if (total_amount <= 0) {
      return NextResponse.json(
        { error: "El monto debe ser mayor a 0" },
        { status: 400 }
      );
    }

    // Validar items
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "La lista de items no puede estar vacía" },
        { status: 400 }
      );
    }

    // Enviar request al backend
    const backendUrl = process.env.BACKEND_URL || "http://localhost:5001";
    const response = await fetch(`${backendUrl}/payment/create-preference`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        total_amount,
        items,
        mesa_id,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || "Error del servidor" },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error en create-preference API:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
} 