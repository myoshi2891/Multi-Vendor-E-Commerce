import { NextResponse } from "next/server";

export async function POST(request: Request) { 
    try { 
        // Parse the incoming request body as JSON
        const body = await request.json();
        const { userCountry } = body
        
        // Check if userCountry is provided
        if (!userCountry)
            return new NextResponse("Please provide userCountry data.", {status: 400})

        // Set the cookie
        const response = new NextResponse("User country saved successfully", { status: 200 });
        
        response.cookies.set('userCountry', JSON.stringify(userCountry), {
            httpOnly: true, // Cookies should only be sent over HTTPS
            secure: process.env.NODE_ENV === 'production', // Secure cookie in production
            sameSite: 'lax', // Helps protect against CSRF attacks
        })

        return response;
    } catch (error) { 
        return new NextResponse("Couldn't save data", {status: 500})
    }
}