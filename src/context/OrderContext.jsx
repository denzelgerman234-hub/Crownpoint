import { createContext, useContext, useState } from 'react'
import { ORDER_TYPES } from '../utils/constants'
import { createEmptyCheckoutContact, createEmptyShippingAddress } from '../utils/checkout'

export const OrderContext = createContext(null)

const createEmptyOrder = () => ({
  orderType: ORDER_TYPES.SERVICE,
  talent: null,
  service: null,
  event: null,
  ticketTier: null,
  recipient: '',
  occasion: '',
  tone: '',
  deliveryWindow: '',
  note: '',
  itemLabel: '',
  refCode: null,
  totalPrice: 0,
  items: [],
  status: null,
  paymentMethod: null,
  paymentProof: '',
  paymentProofFileName: '',
  giftCardBrand: '',
  cryptoAsset: '',
  cryptoNetwork: '',
  contact: createEmptyCheckoutContact(),
  shippingAddress: createEmptyShippingAddress(),
})

export const OrderProvider = ({ children }) => {
  const [currentOrder, setCurrentOrder] = useState(createEmptyOrder)

  const updateOrder = (updates) =>
    setCurrentOrder((prev) => ({ ...prev, ...updates }))

  const resetOrder = () =>
    setCurrentOrder(createEmptyOrder())

  return (
    <OrderContext.Provider value={{ currentOrder, updateOrder, resetOrder }}>
      {children}
    </OrderContext.Provider>
  )
}

export const useOrder = () => useContext(OrderContext)
