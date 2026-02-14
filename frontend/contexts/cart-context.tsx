"use client"

import { createContext, useContext, useReducer, ReactNode } from 'react'

export interface Product {
  id: string
  name: string
  description?: string
  price: number
  category: string
  image?: string
}

export interface CartItem extends Product {
  quantity: number
}

export interface CartState {
  items: CartItem[]
  total: number
  discounts: number
  serviceCharge: number
}

interface CartContextType {
  state: CartState
  addItem: (product: Product) => void
  removeItem: (id: string) => void
  updateQuantity: (id: string, quantity: number) => void
  clearCart: () => void
  getItemQuantity: (id: string) => number
}

const CartContext = createContext<CartContextType | undefined>(undefined)

type CartAction = 
  | { type: 'ADD_ITEM'; payload: Product }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'UPDATE_QUANTITY'; payload: { id: string; quantity: number } }
  | { type: 'CLEAR_CART' }

const cartReducer = (state: CartState, action: CartAction): CartState => {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existingItem = state.items.find(item => item.id === action.payload.id)
      
      if (existingItem) {
        const updatedItems = state.items.map(item =>
          item.id === action.payload.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
        const subtotal = calculateTotal(updatedItems)
        return {
          items: updatedItems,
          total: calculateFinalTotal(subtotal, state.discounts, state.serviceCharge),
          discounts: state.discounts,
          serviceCharge: state.serviceCharge
        }
      } else {
        const newItem: CartItem = { ...action.payload, quantity: 1 }
        const updatedItems = [...state.items, newItem]
        const subtotal = calculateTotal(updatedItems)
        return {
          items: updatedItems,
          total: calculateFinalTotal(subtotal, state.discounts, state.serviceCharge),
          discounts: state.discounts,
          serviceCharge: state.serviceCharge
        }
      }
    }
    
    case 'REMOVE_ITEM': {
      const updatedItems = state.items.filter(item => item.id !== action.payload)
      const subtotal = calculateTotal(updatedItems)
      return {
        items: updatedItems,
        total: calculateFinalTotal(subtotal, state.discounts, state.serviceCharge),
        discounts: state.discounts,
        serviceCharge: state.serviceCharge
      }
    }
    
    case 'UPDATE_QUANTITY': {
      if (action.payload.quantity <= 0) {
        const updatedItems = state.items.filter(item => item.id !== action.payload.id)
        const subtotal = calculateTotal(updatedItems)
        return {
          items: updatedItems,
          total: calculateFinalTotal(subtotal, state.discounts, state.serviceCharge),
          discounts: state.discounts,
          serviceCharge: state.serviceCharge
        }
      }
      
      const updatedItems = state.items.map(item =>
        item.id === action.payload.id
          ? { ...item, quantity: action.payload.quantity }
          : item
      )
      const subtotal = calculateTotal(updatedItems)
      return {
        items: updatedItems,
        total: calculateFinalTotal(subtotal, state.discounts, state.serviceCharge),
        discounts: state.discounts,
        serviceCharge: state.serviceCharge
      }
    }
    
    case 'CLEAR_CART':
      return { items: [], total: 0, discounts: 0, serviceCharge: 0 }
    
    default:
      return state
  }
}

const calculateTotal = (items: CartItem[]): number => {
  return items.reduce((total, item) => total + (item.price * item.quantity), 0)
}

const calculateFinalTotal = (subtotal: number, discounts: number, serviceCharge: number): number => {
  return Math.max(0, subtotal - discounts + serviceCharge)
}

const initialState: CartState = {
  items: [],
  total: 0,
  discounts: 0,
  serviceCharge: 0
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialState)

  const addItem = (product: Product) => {
    dispatch({ type: 'ADD_ITEM', payload: product })
  }

  const removeItem = (id: string) => {
    dispatch({ type: 'REMOVE_ITEM', payload: id })
  }

  const updateQuantity = (id: string, quantity: number) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { id, quantity } })
  }

  const clearCart = () => {
    dispatch({ type: 'CLEAR_CART' })
  }

  const getItemQuantity = (id: string): number => {
    const item = state.items.find(item => item.id === id)
    return item ? item.quantity : 0
  }

  return (
    <CartContext.Provider value={{
      state,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      getItemQuantity
    }}>
      {children}
    </CartContext.Provider>
  )
}

export const useCart = () => {
  const context = useContext(CartContext)
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}
