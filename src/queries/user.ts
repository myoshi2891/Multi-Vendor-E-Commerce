"use server";

import { db } from "@/lib/db";
import { currentUser } from "@clerk/nextjs/server";

/**
 * @name followStore
 * @description - Toggle follow status for a store by the current user.1
 *              - If the user is already following the store, unfollow it.
 *              - If the user is not following the store, follow it.
 * @access User
 * @param storeId - The ID of the store to be followed or unfollowed.
 * @returns {boolean} - Returns true if the follow status was updated successfully, false otherwise.
 */
export const followStore = async (storeId: string): Promise<boolean> => { 
    try {
        // Get the current authenticated user
        const user = await currentUser();
        
        // Ensure user is authenticated
        if (!user) throw new Error("Unauthenticated.");

        // Check if the store exists
        const store = await db.store.findUnique({ where: { id: storeId } });
        if (!store) throw new Error("Store not found.");  // Store does not exist, cannot follow or unfollow

        // Check if the user exists
        const userData = await db.user.findUnique({ where: { id: user.id } });
        if (!userData) throw new Error("User not found.");  // User does not exist, cannot follow or unfollow

        // Check if the user is already following the store
        const userFollowingStore = await db.user.findFirst({
            where: {
                id: user.id,
                following: {
                    some: {
                        id: storeId,
                    }
                }
            }
        })

        if (userFollowingStore) {
            // Unfollow the store and return false
            await db.store.update({
                where: {
                    id: storeId
                },
                data: {
                    followers: {
                        disconnect: {id: userData.id}
                    }
                }
            })
            return false;
        } else {
            // Follow the store and return true
            await db.store.update({
                where: {
                    id: storeId
                },
                data: {
                    followers: {
                        connect: {id: userData.id}
                    }
                }
            })
            return true;  // Follow status updated successfully
        }

     } catch (error) { 
        console.error("Error following store", error); 
        throw new Error("Error following store");
    }
}