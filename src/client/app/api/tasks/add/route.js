// src/client/app/api/tasks/add/route.js
import { NextResponse } from "next/server"
import { withAuth } from "@lib/api-utils"

const appServerUrl =
	process.env.NEXT_PUBLIC_ENVIRONMENT === "selfhost"
		? process.env.INTERNAL_APP_SERVER_URL
		: process.env.NEXT_PUBLIC_APP_SERVER_URL

export const POST = withAuth(async function POST(request, { authHeader }) {
	try {
		const { description } = await request.json()
		if (!description) {
			return NextResponse.json(
				{ error: "Description is required." },
				{ status: 400 }
			)
		}

		const response = await fetch(`${appServerUrl}/agents/add-action-item`, {
			method: "POST",
			headers: { "Content-Type": "application/json", ...authHeader },
			body: JSON.stringify({ description })
		})

		const data = await response.json()
		if (!response.ok) {
			throw new Error(data.error || "Failed to add task")
		}
		return NextResponse.json(data)
	} catch (error) {
		console.error("API Error in /tasks/add:", error)
		return NextResponse.json(
			{ error: `Failed to add action item: ${error.message}` },
			{ status: 500 }
		)
	}
})
