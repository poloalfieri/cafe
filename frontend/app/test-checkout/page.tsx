"use client";

import React, { useState } from "react";
import { MercadoPagoCheckout } from "@/components/mercadopago-checkout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";

interface CartItem {
  name: string;
  quantity: number;
  price: number;
}

export default function TestCheckoutPage() {
  const [items, setItems] = useState<CartItem[]>([
    { name: "Café Americano", quantity: 1, price: 500 },
    { name: "Torta de Chocolate", quantity: 2, price: 800 },
  ]);
  const [mesaId, setMesaId] = useState("1");
  const [newItem, setNewItem] = useState({ name: "", quantity: 1, price: 0 });

  const addItem = () => {
    if (newItem.name && newItem.price > 0) {
      setItems([...items, { ...newItem }]);
      setNewItem({ name: "", quantity: 1, price: 0 });
    }
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof CartItem, value: any) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setItems(updatedItems);
  };

  const handlePaymentSuccess = (orderId: string, token: string) => {
    console.log("Pago exitoso:", { orderId, token });
    alert(`¡Pago exitoso! Order ID: ${orderId}, Token: ${token}`);
  };

  const handlePaymentError = (error: string) => {
    console.error("Error en el pago:", error);
    alert(`Error en el pago: ${error}`);
  };

  const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">
          Test - Mercado Pago Checkout
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Panel de configuración */}
          <Card>
            <CardHeader>
              <CardTitle>Configuración del Pedido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Mesa ID */}
              <div>
                <Label htmlFor="mesaId">Mesa ID:</Label>
                <Input
                  id="mesaId"
                  type="text"
                  value={mesaId}
                  onChange={(e) => setMesaId(e.target.value)}
                  placeholder="Número de mesa"
                />
              </div>

              {/* Agregar nuevo item */}
              <div className="space-y-2">
                <Label>Agregar Item:</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    placeholder="Nombre"
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  />
                  <Input
                    type="number"
                    placeholder="Cantidad"
                    value={newItem.quantity}
                    onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
                  />
                  <Input
                    type="number"
                    placeholder="Precio"
                    value={newItem.price}
                    onChange={(e) => setNewItem({ ...newItem, price: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <Button onClick={addItem} size="sm" className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Item
                </Button>
              </div>

              {/* Lista de items */}
              <div className="space-y-2">
                <Label>Items del Pedido:</Label>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {items.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 border rounded">
                      <div className="flex-1">
                        <div className="font-medium">{item.name}</div>
                        <div className="text-sm text-gray-600">
                          Cantidad: {item.quantity} | Precio: ${item.price}
                        </div>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="border-t pt-4">
                <div className="flex justify-between font-bold text-lg">
                  <span>Total:</span>
                  <span>${totalAmount.toFixed(2)} ARS</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Checkout de Mercado Pago */}
          <div>
            <MercadoPagoCheckout
              items={items}
              mesaId={mesaId}
              onPaymentSuccess={handlePaymentSuccess}
              onPaymentError={handlePaymentError}
            />
          </div>
        </div>

        {/* Información de prueba */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Información para Pruebas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p><strong>Tarjetas de prueba (Sandbox):</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li>Visa: 4509 9535 6623 3704</li>
                <li>Mastercard: 5031 4332 1540 6351</li>
                <li>American Express: 3711 8030 3257 522</li>
              </ul>
              <p className="mt-4"><strong>Datos de prueba:</strong></p>
              <ul className="list-disc list-inside space-y-1">
                <li>CVV: 123</li>
                <li>Fecha de vencimiento: 12/25</li>
                <li>DNI: 12345678</li>
                <li>Nombre: APRO (para pagos aprobados)</li>
                <li>Nombre: OTHE (para pagos pendientes)</li>
                <li>Nombre: CONT (para pagos rechazados)</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 