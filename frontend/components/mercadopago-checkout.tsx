"use client";

import React, { useState, useEffect } from "react";
import { initMercadoPago, Wallet } from "@mercadopago/sdk-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Loader2, CreditCard, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/fetcher";

// Inicializar Mercado Pago con la clave pública
initMercadoPago(process.env.NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY || "");

interface MercadoPagoCheckoutProps {
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  mesaId: string;
  onPaymentSuccess?: (orderId: string, token: string) => void;
  onPaymentError?: (error: string) => void;
}

interface PaymentPreference {
  preference_id: string;
  init_point: string;
  order_id: string;
  order_token: string;
}

export function MercadoPagoCheckout({
  items,
  mesaId,
  onPaymentSuccess,
  onPaymentError,
}: MercadoPagoCheckoutProps) {
  const [preference, setPreference] = useState<PaymentPreference | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const createPreference = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await api.post("/api/payment/create-preference", {
        total_amount: totalAmount,
        items: items,
        mesa_id: mesaId,
      });

      if (data.success) {
        setPreference({
          preference_id: data.preference_id,
          init_point: data.init_point,
          order_id: data.order_id,
          order_token: data.order_token,
        });
        toast.success("Preferencia de pago creada exitosamente");
      } else {
        throw new Error(data.error || "Error desconocido");
      }
    } catch (err: any) {
      const errorMessage = err?.data?.error || err?.message || "Error desconocido";
      setError(errorMessage);
      toast.error(errorMessage);
      onPaymentError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    if (preference) {
      toast.success("¡Pago realizado exitosamente!");
      onPaymentSuccess?.(preference.order_id, preference.order_token);
    }
  };

  const handlePaymentError = () => {
    const errorMessage = "Error en el proceso de pago";
    setError(errorMessage);
    toast.error(errorMessage);
    onPaymentError?.(errorMessage);
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Pago con Mercado Pago
        </CardTitle>
        <CardDescription>
          Total a pagar: ${totalAmount.toFixed(2)} ARS
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Resumen de items */}
        <div className="space-y-2">
          <h4 className="font-medium">Resumen del pedido:</h4>
          {items.map((item, index) => (
            <div key={index} className="flex justify-between text-sm">
              <span>
                {item.name} x{item.quantity}
              </span>
              <span>${(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
          <div className="border-t pt-2 flex justify-between font-medium">
            <span>Total:</span>
            <span>${totalAmount.toFixed(2)}</span>
          </div>
        </div>

        {/* Botón para crear preferencia */}
        {!preference && (
          <Button
            onClick={createPreference}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creando preferencia...
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                Proceder al pago
              </>
            )}
          </Button>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm">
            <XCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {/* Wallet de Mercado Pago */}
        {preference && !error && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle className="h-4 w-4" />
              Preferencia creada exitosamente
            </div>
            
            <Wallet
              initialization={{
                preferenceId: preference.preference_id,
              }}
              customization={{
                texts: {
                  valueProp: "smart_option",
                },
              }}
              onReady={() => {
                console.log("Mercado Pago Wallet ready");
              }}
              onSubmit={handlePaymentSuccess}
              onError={handlePaymentError}
            />
            
            <Button
              variant="outline"
              onClick={() => setPreference(null)}
              className="w-full"
            >
              Crear nueva preferencia
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
} 
