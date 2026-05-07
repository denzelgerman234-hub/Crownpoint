import {
  deleteUserRecord,
  getUserById,
  updateUserAccount as updateUserAccountRecord,
  updateUserProfile as updateUserProfileRecord,
} from './authService'
import { removeUserEventBookingRequests } from './eventBookingService'
import { removeUserMembershipRequests } from './membershipService'
import { removeUserThreads } from './messageService'
import { removeUserOrders } from './orderService'

export const getUserProfile = async (userId) => Promise.resolve(getUserById(userId))

export const updateUserProfile = async (userId, data) =>
  Promise.resolve(updateUserProfileRecord(userId, data))

export const updateUserAccount = async (userId, data) =>
  Promise.resolve(updateUserAccountRecord(userId, data))

export const deleteUserAccount = async (userId, options = {}) => {
  const user = getUserById(userId)

  if (!user) {
    throw new Error('We could not find that account to delete.')
  }

  if (user.authUserId) {
    return deleteUserRecord(userId, options)
  }

  const [removedThreadCount, removedEventBookingCount, removedMembershipCount, removedOrderCount] = await Promise.all([
    removeUserThreads(userId),
    Promise.resolve(removeUserEventBookingRequests(userId)),
    Promise.resolve(removeUserMembershipRequests(userId)),
    Promise.resolve(removeUserOrders(userId)),
  ])

  const deletedUser = await deleteUserRecord(userId, options)

  return {
    deletedUser,
    removedThreadCount,
    removedEventBookingCount,
    removedMembershipCount,
    removedOrderCount,
  }
}
