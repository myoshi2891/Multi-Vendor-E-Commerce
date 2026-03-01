// import { User } from "@/generated/prisma";
// import { User } from "@/generated/prisma";
import { db } from "@/lib/db";
import { clerkClient, WebhookEvent } from "@clerk/nextjs/server";
import { User } from "@prisma/client";
import { headers } from "next/headers";
import { Webhook } from "svix";
/**
 * Handle Clerk webhook POST requests: verify the Svix signature and process user lifecycle events.
 *
 * Verifies the incoming request using the WEBHOOK_SECRET and Svix headers, then processes
 * user.created, user.updated, and user.deleted events by upserting or deleting the corresponding
 * user in the local database and updating the Clerk user's private metadata (role) when applicable.
 *
 * @returns A Response with status 200 when the webhook is processed successfully, or status 400 if required Svix headers are missing or signature verification fails.
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
	const headerPayload = headers();
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

			await clerkClient.users.updateUserMetadata(data.id, {
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
