// src/client/app/api/tasks/update/route.js
import { NextResponse } from "next/server"
import { withAuth } from "@lib/api-utils"

const appServerUrl =
	process.env.NEXT_PUBLIC_ENVIRONMENT === "selfhost"
		? process.env.INTERNAL_APP_SERVER_URL
		: process.env.NEXT_PUBLIC_APP_SERVER_URL

export const POST = withAuth(async function POST(request, { authHeader }) {
	try {
		const taskData = await request.json()

		const response = await fetch(`${appServerUrl}/agents/update-task`, {
			method: "POST",
			headers: { "Content-Type": "application/json", ...authHeader },
			body: JSON.stringify(taskData)
		})

		const data = await response.json()
		if (!response.ok) {
			throw new Error(data.error || "Failed to update task")
		}
		return NextResponse.json(data)
	} catch (error) {
		console.error("API Error in /tasks/update:", error)
		return NextResponse.json({ error: error.message }, { status: 500 })
	}
})
