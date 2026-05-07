import { ORDER_STATUS, ORDER_TYPES } from './constants'
import { getShippingAddressSummary } from './checkout'
import { formatDate } from './formatters'

export const getOrderType = (order) => order?.orderType ?? ORDER_TYPES.SERVICE

export const getOrderTalentName = (order) =>
  order?.talent?.name ?? order?.talentName ?? 'Selected talent'

export const getOrderItems = (order) => {
  if (order?.items?.length) {
    return order.items
  }

  if (order?.service?.label) {
    const totalPrice = order.totalPrice ?? order.service.price ?? 0

    return [{
      id: order.service.id ?? 'service-item',
      title: order.service.label,
        subtitle: order.occasion || 'Personalized experience request',
      quantity: 1,
      unitPrice: totalPrice,
      totalPrice,
    }]
  }

  if (typeof order?.service === 'string') {
    return [{
      id: order.refCode ?? order.service,
      title: order.service,
      subtitle: order.requestedFor ?? 'Tracked order',
      quantity: 1,
      unitPrice: order.totalPrice ?? 0,
      totalPrice: order.totalPrice ?? 0,
    }]
  }

  return []
}

export const getOrderItemCount = (order) =>
  getOrderItems(order).reduce((total, item) => total + (item.quantity ?? 1), 0)

export const getOrderTitle = (order) => {
  if (order?.itemLabel) {
    return order.itemLabel
  }

  switch (getOrderType(order)) {
    case ORDER_TYPES.TICKET:
      return order?.event?.title ?? 'Event ticket'
    case ORDER_TYPES.SHOP: {
      const items = getOrderItems(order)

      if (items.length === 1) {
        return items[0].title
      }

      const itemCount = getOrderItemCount(order)
      return `${itemCount} merch item${itemCount === 1 ? '' : 's'}`
    }
    default:
      return order?.service?.label ?? order?.service ?? 'Selected experience'
  }
}

export const getOrderTypeLabel = (order) => {
  switch (getOrderType(order)) {
    case ORDER_TYPES.TICKET:
      return 'Event ticket'
    case ORDER_TYPES.SHOP:
      return 'Merch order'
    default:
      return 'Experience request'
  }
}

export const getOrderContextLabel = (order) => {
  if (order?.requestedFor) {
    return order.requestedFor
  }

  switch (getOrderType(order)) {
    case ORDER_TYPES.TICKET:
      if (order?.event?.date && order?.event?.venue) {
        return `${formatDate(order.event.date)} / ${order.event.venue}`
      }

      return order?.ticketTier?.label ?? 'Ticket selection pending'
    case ORDER_TYPES.SHOP: {
      const itemCount = getOrderItemCount(order)
      const shippingSummary = getShippingAddressSummary(order?.shippingAddress)

      if (shippingSummary) {
        return shippingSummary
      }

      return itemCount
        ? `${itemCount} item${itemCount === 1 ? '' : 's'} in this merch order`
        : 'Merch checkout'
    }
    default: {
      const detail = [order?.recipient, order?.occasion].filter(Boolean).join(' - ')
      return detail || 'Current recipient'
    }
  }
}

export const getOrderEta = (order) => {
  if (order?.eta) {
    return order.eta
  }

  switch (order?.status) {
    case ORDER_STATUS.UNDER_REVIEW:
      return 'Awaiting payment check'
    case ORDER_STATUS.FLAGGED:
      return 'Flagged for manual review'
    case ORDER_STATUS.PENDING_PAYMENT:
      return 'Finish payment submission'
    case ORDER_STATUS.PAID:
      return 'Payment approved / fulfillment preparing'
    case ORDER_STATUS.IN_PROGRESS:
      return getOrderType(order) === ORDER_TYPES.TICKET
        ? 'Ticket confirmation preparing'
        : 'Fulfillment in motion'
    case ORDER_STATUS.COMPLETED:
      return 'Order completed'
    case ORDER_STATUS.FAILED:
      return 'Payment was rejected'
    default:
      return 'Concierge follow-up pending'
  }
}

export const getOrderBackLink = (order) => {
  const talentId = order?.talent?.id

  switch (getOrderType(order)) {
    case ORDER_TYPES.TICKET:
      return talentId ? `/talent/${talentId}/events` : '/events'
    case ORDER_TYPES.SHOP:
      return talentId ? `/talent/${talentId}/shop` : '/talents'
    default:
      if (talentId) {
        const params = new URLSearchParams({ talent: String(talentId) })

        if (order?.service?.id) {
          params.set('service', order.service.id)
        }

        return `/experiences?${params.toString()}`
      }

      return '/experiences'
  }
}

export const getOrderBackLabel = (order) => {
  switch (getOrderType(order)) {
    case ORDER_TYPES.TICKET:
      return 'Back to events'
    case ORDER_TYPES.SHOP:
      return 'Back to merch'
    default:
      return 'Back to experiences'
  }
}
