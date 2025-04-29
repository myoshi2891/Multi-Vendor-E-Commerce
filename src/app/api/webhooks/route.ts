import { User } from "@/generated/prisma";
import { db } from "@/lib/db";
import { clerkClient, WebhookEvent } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { Webhook } from "svix";
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
		// Parse the incoming event data
		const data = JSON.parse(body).data;
		const user: Partial<User> = {
			id: data.id,
			name: `${data.first_name} ${data.last_name}`,
			email: data.email_addresses[0].email_address,
            picture: data.image_url,
		};

		if (!user) return;

		const dbUser = await db.user.upsert({
			where: {
				email: user.email,
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
    }
    
    if (evt.type === "user.deleted") { 
        const userId = JSON.parse(body).data.id;
        await db.user.delete({
            where: {
                id: userId,
            }
        })
    }
	return new Response("", { status: 200 });
}
