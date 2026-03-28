// import { User } from "@/generated/prisma";
// import { User } from "@/generated/prisma";
import { db } from "@/lib/db";
import { clerkClient, WebhookEvent } from "@clerk/nextjs/server";
import { User } from "@prisma/client";
import { headers } from "next/headers";
import { Webhook } from "svix";
/**
 * Handle Clerk (Svix) webhook POST requests to verify events and synchronize user records in the database.
 *
 * Verifies the Svix signature, processes user.created and user.updated events to upsert user records and update Clerk private metadata, and processes user.deleted events to remove users from the database. Throws an error if the webhook secret is not configured.
 *
 * @param req - The incoming HTTP Request containing the webhook JSON payload
 * @returns An HTTP Response: `200` on success, `400` for missing/invalid Svix headers, verification failure, or missing required event data
 * @throws Error if the `WEBHOOK_SECRET` environment variable is not set
 */
export async function POST(req: Request) {
	// You can find this in the Clerk Dashboard -> Webhooks -> choose the endpoint
	const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

	if (!WEBHOOK_SECRET) {
		throw new Error(
			"Please add WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local"
		);
	}

	// Get the headers
	const headerPayload = await headers();
	const svix_id = headerPayload.get("svix-id");
	const svix_timestamp = headerPayload.get("svix-timestamp");
	const svix_signature = headerPayload.get("svix-signature");

	// If there are no headers, error out
	if (!svix_id || !svix_timestamp || !svix_signature) {
		return new Response("Error occured -- no svix headers", {
			status: 400,
		});
	}

	// Get the body
	const payload = await req.json();
	const body = JSON.stringify(payload);

	// Create a new Svix instance with your secret.
	const wh = new Webhook(WEBHOOK_SECRET);

	let evt: WebhookEvent;

	// Verify the payload with the headers
	try {
		evt = wh.verify(body, {
			"svix-id": svix_id,
			"svix-timestamp": svix_timestamp,
			"svix-signature": svix_signature,
		}) as WebhookEvent;
	} catch (err) {
		console.error("Error verifying webhook:", err);
		return new Response("Error occured", {
			status: 400,
		});
	}

	// When user is created or updated
	if (evt.type === "user.created" || evt.type === "user.updated") {
		// Svix検証済みのイベントデータを使用
		const data = evt.data as {
			id: string;
			first_name: string;
			last_name: string;
			email_addresses: { email_address: string }[];
			image_url: string;
		};

		const primaryEmail = data.email_addresses[0]?.email_address;
		if (!primaryEmail) {
			console.error("Webhook event missing primary email", { userId: data.id });
			return new Response("Missing primary email", { status: 400 });
		}

		const user: Partial<User> = {
			id: data.id,
			name: `${data.first_name} ${data.last_name}`,
			email: primaryEmail,
			picture: data.image_url,
		};

		try {
			const dbUser = await db.user.upsert({
				where: {
					id: user.id!,
				},
				update: user,
				create: {
					id: user.id!,
					name: user.name!,
					email: user.email!,
					picture: user.picture!,
					role: user.role || "USER",
				},
			});

			const client = await clerkClient();
			await client.users.updateUserMetadata(data.id, {
				privateMetadata: {
					role: dbUser.role || "USER",
				},
			});
		} catch (error) {
			console.error("Webhook user upsert/metadata update failed:", error);
			return new Response("Internal Server Error", { status: 500 });
		}
	}

	if (evt.type === "user.deleted") {
		const userId = (evt.data as { id: string }).id;
		try {
			await db.user.deleteMany({
				where: {
					id: userId,
				},
			});
		} catch (error) {
			console.error("Webhook user deletion failed:", error);
			return new Response("Internal Server Error", { status: 500 });
		}
	}
	return new Response("", { status: 200 });
}
