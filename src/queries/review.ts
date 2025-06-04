"use server";

import { db } from "@/lib/db";
import { ReviewDetailsType } from "@/lib/types";
import { currentUser } from "@clerk/nextjs/server";

/**
 * @name upsertReview
 * @description - Upserts a review into the database, updating if it exists or creating a new one if not.
 * @access Admin only for creation/updating of reviews.
 * @param productId - The ID of the product the review belongs to.
 * @param review - The review object containing details of the review to be upserted.
 * @returns {Review} - Returns the updated or newly created review details.
 */
export const upsertReview = async (
	productId: string,
	review: ReviewDetailsType
) => {
	try {
		// Get current user
		const user = await currentUser();

		// Ensure user is authenticated
		if (!user) throw new Error("Unauthorized.");

		// Ensure productId and review are provided
		if (!productId) throw new Error("Product ID is required.");
		if (!review) throw new Error("Please provide review data.");

		// Upsert the review into the database
		const reviewDetails = await db.review.upsert({
			where: {
				id: review.id,
			},
			update: {
				...review,
				images: {
					deleteMany: {},
					create: review.images.map((img) => ({
						url: img.url,
					})),
				},
				userId: user.id,
			},
			create: {
				...review,
				images: {
					create: review.images.map((img) => ({
						url: img.url,
					})),
				},
				productId,
				userId: user.id,
			},
		});

		// Calculate the new average rating
		const productReviews = await db.review.findMany({
			where: {
				productId,
			},
			select: {
				rating: true,
			},
		});

		const totalRating = productReviews.reduce(
			(acc, review) => acc + review.rating,
			0
		);
		const newAverageRating = totalRating / productReviews.length;

		// Update the product's average rating
		const updatedProduct = await db.product.update({
			where: {
				id: productId,
			},
			data: {
				rating: newAverageRating, // Update the average rating
				numReviews: productReviews.length, // Update the number of reviews
			},
		});
		return reviewDetails;
	} catch (error) {
		console.error("Error updating review", error);
		throw new Error("Error updating review");
	}
};
