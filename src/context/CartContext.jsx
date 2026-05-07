import { createContext, useContext, useState } from 'react'
import { ORDER_TYPES } from '../utils/constants'

const CartContext = createContext(null)

const createEmptyCart = () => ({
  talent: null,
  items: [],
  orderType: null,
})

export function CartProvider({ children }) {
  const [cart, setCart] = useState(createEmptyCart)

  const addServiceItem = ({ talent, service }) => {
    if (!talent || !service) {
      return { ok: false, reason: 'missing-service' }
    }

    setCart({
      talent,
      orderType: ORDER_TYPES.SERVICE,
      items: [
        {
          lineId: `${service.id}::experience`,
          id: service.id,
          type: service.type,
          title: service.label,
          subtitle: service.description,
          image: '',
          quantity: 1,
          unitPrice: service.price,
          totalPrice: service.price,
          selectedSize: '',
          stock: null,
        },
      ],
    })

    return { ok: true, reason: 'added' }
  }

  const removeItem = (lineId) => {
    setCart((current) => {
      const nextItems = current.items.filter((item) => item.lineId !== lineId)

      return {
        talent: nextItems.length ? current.talent : null,
        orderType: nextItems.length ? current.orderType : null,
        items: nextItems,
      }
    })
  }

  const clearCart = () => {
    setCart(createEmptyCart())
  }

  const itemCount = cart.items.reduce((total, item) => total + item.quantity, 0)
  const subtotal = cart.items.reduce((total, item) => total + item.totalPrice, 0)

  return (
    <CartContext.Provider
      value={{
        cart,
        itemCount,
        subtotal,
        addServiceItem,
        removeItem,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export const useCart = () => useContext(CartContext)
