import { NextResponse } from "next/server"
import { withAuth } from "@lib/api-utils"

const APP_SERVER_URL =
	process.env.NEXT_PUBLIC_ENVIRONMENT === "selfhost"
		? process.env.INTERNAL_APP_SERVER_URL
		: process.env.NEXT_PUBLIC_APP_SERVER_URL

// GET: Fetch a single task by its ID
export const GET = withAuth(async function GET(
	request,
	{ params, authHeader }
) {
	const { taskId } = params
	if (!taskId) {
		return NextResponse.json(
			{ error: "Task ID parameter is required" },
			{ status: 400 }
		)
	}

	try {
		const response = await fetch(
			`${APP_SERVER_URL}/agents/tasks/${taskId}`,
			{
				headers: { "Content-Type": "application/json", ...authHeader }
			}
		)
		const data = await response.json()
		if (!response.ok)
			throw new Error(data.detail || "Failed to fetch task details")
		return NextResponse.json(data)
	} catch (error) {
		return NextResponse.json({ error: error.message }, { status: 500 })
	}
})

// POST: Handle interactive chat for a single task
export const POST = withAuth(async function POST(
	request,
	{ params, authHeader }
) {
	const { taskId } = params
	if (!taskId) {
		return NextResponse.json(
			{ error: "Task ID parameter is required" },
			{ status: 400 }
		)
	}

	try {
		const { messages } = await request.json()
		const backendResponse = await fetch(
			`${APP_SERVER_URL}/agents/tasks/${taskId}/chat`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json", ...authHeader },
				body: JSON.stringify({ messages }),
				duplex: "half" // Enable streaming
			}
		)

		if (!backendResponse.ok) {
			const errorText = await backendResponse.text()
			throw new Error(
				errorText ||
					`Backend chat endpoint failed with status ${backendResponse.status}`
			)
		}

		return new Response(backendResponse.body, {
			status: 200,
			headers: {
				"Content-Type": "application/x-ndjson",
				"Cache-Control": "no-cache",
				Connection: "keep-alive",
				"X-Accel-Buffering": "no" // Disable buffering on Netlify/Vercel
			}
		})
	} catch (error) {
		console.error(`API Error in /tasks/${taskId}/chat:`, error)
		return NextResponse.json({ error: error.message }, { status: 500 })
	}
})
