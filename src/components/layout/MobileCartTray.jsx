import { ArrowRight, Trash2, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useCart } from '../../context/CartContext'
import { useOrder } from '../../context/OrderContext'
import { useToast } from '../../hooks/useToast'
import { ORDER_STATUS, ORDER_TYPES } from '../../utils/constants'
import { formatCurrency } from '../../utils/formatters'
import { generateRef } from '../../utils/generateRef'

export default function MobileCartTray({ isOpen, onClose }) {
  const navigate = useNavigate()
  const { cart, clearCart, itemCount, removeItem, subtotal } = useCart()
  const { currentOrder, updateOrder } = useOrder()
  const { showToast } = useToast()

  const handleCheckout = () => {
    if (!cart.talent || !cart.items.length) {
      showToast('Add something to your cart before continuing.', 'warning')
      return
    }

    const selectedItem = cart.items[0]
    const shouldReuseRef =
      currentOrder.refCode &&
      currentOrder.orderType === ORDER_TYPES.SERVICE &&
      currentOrder.talent?.id === cart.talent.id &&
      currentOrder.service?.id === selectedItem?.id
    const refCode = shouldReuseRef ? currentOrder.refCode : generateRef()

    updateOrder({
      orderType: ORDER_TYPES.SERVICE,
      talent: cart.talent,
      service:
        currentOrder.service?.id === selectedItem?.id
          ? currentOrder.service
          : {
              id: selectedItem.id,
              type: selectedItem.type,
              label: selectedItem.title,
              description: selectedItem.subtitle || '',
              price: selectedItem.unitPrice,
            },
      event: null,
      ticketTier: null,
      recipient: currentOrder.recipient,
      occasion: currentOrder.occasion,
      tone: currentOrder.tone,
      deliveryWindow: currentOrder.deliveryWindow,
      note: currentOrder.note,
      itemLabel: '',
      refCode,
      totalPrice: subtotal,
      items: [
        {
          id: selectedItem.id,
          title: selectedItem.title,
          subtitle:
            currentOrder.occasion || selectedItem.subtitle || 'Personalized experience request',
          quantity: 1,
          unitPrice: selectedItem.unitPrice,
          totalPrice: selectedItem.totalPrice,
        },
      ],
      status: ORDER_STATUS.PENDING_PAYMENT,
      paymentMethod: null,
      paymentProof: '',
      paymentProofFileName: '',
    })

    onClose()
    navigate(`/payment?ref=${refCode}`)
  }

  return (
    <>
      <button
        aria-hidden={!isOpen}
        aria-label="Close cart summary"
        className={`cp-cart-tray-backdrop${isOpen ? ' is-open' : ''}`}
        onClick={onClose}
        type="button"
      />

      <aside
        aria-hidden={!isOpen}
        aria-modal="true"
        aria-labelledby="mobile-cart-tray-title"
        className={`cp-cart-tray${isOpen ? ' is-open' : ''}`}
        id="mobile-cart-tray"
        role="dialog"
      >
        <div className="cp-cart-tray-header">
          <div className="cp-cart-tray-copy">
            <span className="cp-eyebrow">Cart summary</span>
            <h3 id="mobile-cart-tray-title">
              {cart.talent ? `${cart.talent.name} experience cart` : 'Your cart'}
            </h3>
            <p className="cp-text-muted">
              {cart.items.length
                ? 'Review your selected experience, then open payment when you are ready.'
                : 'Your experience selection will appear here as soon as you add it.'}
            </p>
          </div>

          <button
            aria-label="Close cart tray"
            className="cp-cart-tray-close"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <div className="cp-cart-tray-body">
          {cart.items.length ? (
            <div className="cp-cart-stack">
              {cart.items.map((item) => (
                <div key={item.lineId} className="cp-cart-item">
                  <div className="cp-cart-item-header">
                    <div>
                      <strong>{item.title}</strong>
                      <span>
                        {currentOrder.occasion || currentOrder.recipient || item.subtitle || 'Personalized experience'}
                      </span>
                    </div>
                    <button
                      className="cp-copy-btn"
                      onClick={() => removeItem(item.lineId)}
                      title="Remove item"
                      type="button"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="cp-price-row">
                    <div>
                      <strong>{formatCurrency(item.totalPrice)}</strong>
                      <span>
                        {currentOrder.deliveryWindow || 'Delivery timing will be confirmed after review'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="cp-cart-empty">
              <p>Your cart is empty. Add an experience and continue when you are ready.</p>
            </div>
          )}
        </div>

        <div className="cp-cart-tray-footer">
          <div className="cp-price-row">
            <div>
              <strong>{formatCurrency(subtotal)}</strong>
              <span>
                {`${itemCount} experience${itemCount === 1 ? '' : 's'} ready`}
              </span>
            </div>
          </div>

          <div className="cp-card-actions">
            <button className="cp-btn cp-btn--primary" disabled={!cart.items.length} onClick={handleCheckout} type="button">
              Open payment
              <ArrowRight size={14} />
            </button>
            <button className="cp-btn cp-btn--ghost" disabled={!cart.items.length} onClick={clearCart} type="button">
              Clear cart
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
