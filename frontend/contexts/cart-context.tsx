"use client"

import { createContext, useContext, useReducer, ReactNode } from 'react'
import {
  buildCartLineId,
  normalizeSelectedOptions,
  type SelectedProductOption,
} from '@/lib/product-options'

export interface Product {
  id: string
  name: string
  description?: string
  price: number
  basePrice?: number
  category: string
  image?: string
  selectedOptions?: SelectedProductOption[]
  lineId?: string
}

export interface CartItem extends Product {
  lineId: string
  basePrice: number
  selectedOptions: SelectedProductOption[]
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
  removeItem: (lineId: string) => void
  removeOneByProductId: (productId: string) => void
  updateQuantity: (lineId: string, quantity: number) => void
  clearCart: () => void
  getItemQuantity: (lineId: string) => number
  getProductQuantity: (productId: string) => number
}

const CartContext = createContext<CartContextType | undefined>(undefined)

type CartAction = 
  | { type: 'ADD_ITEM'; payload: Product }
  | { type: 'REMOVE_ITEM'; payload: string }
  | { type: 'REMOVE_ONE_BY_PRODUCT_ID'; payload: string }
  | { type: 'UPDATE_QUANTITY'; payload: { id: string; quantity: number } }
  | { type: 'CLEAR_CART' }

const toTwoDecimals = (value: number): number => {
  return Math.round(value * 100) / 100
}

const buildLineIdFromProduct = (product: Product): string => {
  if (product.lineId) {
    return product.lineId
  }
  return buildCartLineId(product.id, product.selectedOptions || [])
}

const cartReducer = (state: CartState, action: CartAction): CartState => {
  switch (action.type) {
    case 'ADD_ITEM': {
      const selectedOptions = normalizeSelectedOptions(action.payload.selectedOptions || [])
      const lineId = buildLineIdFromProduct(action.payload)
      const basePrice = action.payload.basePrice ?? action.payload.price
      const finalPrice = toTwoDecimals(action.payload.price)
      const existingItem = state.items.find(item => item.lineId === lineId)
      
      if (existingItem) {
        const updatedItems = state.items.map(item =>
          item.lineId === lineId
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
        const newItem: CartItem = {
          ...action.payload,
          lineId,
          price: finalPrice,
          basePrice: toTwoDecimals(basePrice),
          selectedOptions,
          quantity: 1,
        }
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
      const updatedItems = state.items.filter(item => item.lineId !== action.payload)
      const subtotal = calculateTotal(updatedItems)
      return {
        items: updatedItems,
        total: calculateFinalTotal(subtotal, state.discounts, state.serviceCharge),
        discounts: state.discounts,
        serviceCharge: state.serviceCharge
      }
    }

    case 'REMOVE_ONE_BY_PRODUCT_ID': {
      let targetIndex = -1
      for (let index = state.items.length - 1; index >= 0; index -= 1) {
        if (state.items[index].id === action.payload) {
          targetIndex = index
          break
        }
      }
      if (targetIndex === -1) {
        return state
      }

      const targetItem = state.items[targetIndex]
      let updatedItems: CartItem[]
      if (targetItem.quantity <= 1) {
        updatedItems = state.items.filter((_, index) => index !== targetIndex)
      } else {
        updatedItems = state.items.map((item, index) =>
          index === targetIndex
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
      }

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
        const updatedItems = state.items.filter(item => item.lineId !== action.payload.id)
        const subtotal = calculateTotal(updatedItems)
        return {
          items: updatedItems,
          total: calculateFinalTotal(subtotal, state.discounts, state.serviceCharge),
          discounts: state.discounts,
          serviceCharge: state.serviceCharge
        }
      }
      
      const updatedItems = state.items.map(item =>
        item.lineId === action.payload.id
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

  const removeItem = (lineId: string) => {
    dispatch({ type: 'REMOVE_ITEM', payload: lineId })
  }

  const removeOneByProductId = (productId: string) => {
    dispatch({ type: 'REMOVE_ONE_BY_PRODUCT_ID', payload: productId })
  }

  const updateQuantity = (lineId: string, quantity: number) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { id: lineId, quantity } })
  }

  const clearCart = () => {
    dispatch({ type: 'CLEAR_CART' })
  }

  const getItemQuantity = (lineId: string): number => {
    const item = state.items.find(item => item.lineId === lineId)
    return item ? item.quantity : 0
  }

  const getProductQuantity = (productId: string): number => {
    return state.items
      .filter(item => item.id === productId)
      .reduce((total, item) => total + item.quantity, 0)
  }

  return (
    <CartContext.Provider value={{
      state,
      addItem,
      removeItem,
      removeOneByProductId,
      updateQuantity,
      clearCart,
      getItemQuantity,
      getProductQuantity
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
