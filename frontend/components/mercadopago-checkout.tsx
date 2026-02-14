"use client";

import React, { useState, useEffect, useRef } from "react";
import { initMercadoPago, Wallet } from "@mercadopago/sdk-react";
import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Loader2, CreditCard, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

interface MercadoPagoCheckoutProps {
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
  }>;
  mesaId: string;
  mesaToken: string;
  onPaymentSuccess?: (orderId: string, token: string) => void;
  onPaymentError?: (error: string) => void;
}

interface PaymentPreference {
  preference_id: string;
  init_point: string;
  order_id: string;
  order_token: string;
  public_key: string;
}

export function MercadoPagoCheckout({
  items,
  mesaId,
  mesaToken,
  onPaymentSuccess,
  onPaymentError,
}: MercadoPagoCheckoutProps) {
  const [preference, setPreference] = useState<PaymentPreference | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mpInitialized = useRef(false);

  const totalAmount = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const createPreference = async () => {
    setLoading(true);
    setError(null);

    try {
      const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error("Variables de entorno de Supabase no configuradas");
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/create-payment-preference`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mesa_id: mesaId,
            token: mesaToken,
            items: items.map((item) => ({
              id: item.id,
              name: item.name,
              quantity: item.quantity,
              price: item.price,
            })),
            total_amount: totalAmount,
          }),
        }
      );

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `Error ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        const prefData: PaymentPreference = {
          preference_id: data.preference_id,
          init_point: data.init_point,
          order_id: data.order_id,
          order_token: data.order_token,
          public_key: data.public_key || "",
        };
        setPreference(prefData);

        // Initialize MercadoPago SDK with the returned public_key
        if (prefData.public_key && !mpInitialized.current) {
          initMercadoPago(prefData.public_key);
          mpInitialized.current = true;
        }

        toast.success("Preferencia de pago creada exitosamente");
      } else {
        throw new Error(data.error || "Error desconocido");
      }
    } catch (err: any) {
      const errorMessage =
        err?.data?.error || err?.message || "Error desconocido";
      setError(errorMessage);
      toast.error(errorMessage);
      onPaymentError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    if (preference) {
      toast.success("Pago realizado exitosamente");
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

        {/* Button to create preference */}
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

            {preference.public_key && (
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
            )}

            {!preference.public_key && (
              <div className="text-sm text-gray-600">
                <a
                  href={preference.init_point}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline"
                >
                  Ir a Mercado Pago para completar el pago
                </a>
              </div>
            )}

            <Button
              variant="outline"
              onClick={() => {
                setPreference(null);
                mpInitialized.current = false;
              }}
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
