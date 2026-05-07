export const getPendingPayments = async () =>
  Promise.resolve([
    {
      id: 72,
      user: 'Amara Okafor',
      talent: 'Bruno Mars',
      method: 'BANK_TRANSFER',
      amount: 299,
      proofType: 'receipt',
      submittedAt: new Date(Date.now() - 2 * 60000).toISOString(),
    },
    {
      id: 71,
      user: 'James Kofi',
      talent: 'Kai Cenat',
      method: 'GIFT_CARD',
      amount: 199,
      proofType: 'image',
      submittedAt: new Date(Date.now() - 8 * 60000).toISOString(),
    },
    {
      id: 70,
      user: 'Maria Santos',
      talent: 'Zendaya',
      method: 'CRYPTO',
      amount: 449,
      proofType: 'hash',
      submittedAt: new Date(Date.now() - 15 * 60000).toISOString(),
    },
    {
      id: 69,
      user: 'Tunde Adeyemi',
      talent: 'Sydney Sweeney',
      method: 'BANK_TRANSFER',
      amount: 799,
      proofType: 'receipt',
      submittedAt: new Date(Date.now() - 22 * 60000).toISOString(),
    },
  ])

export const approvePayment = async (_paymentId) => Promise.resolve({ success: true })

export const rejectPayment = async (_paymentId) => Promise.resolve({ success: true })

export const flagPayment = async (_paymentId) => Promise.resolve({ success: true })

export const getAdminDashboard = async () =>
  Promise.resolve({
    pendingVerifications: 14,
    todayRevenue: 24890,
    activeOrders: 89,
    fraudAlerts: 3,
  })
