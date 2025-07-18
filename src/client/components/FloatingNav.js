"use client"
import React, { useState, useEffect, useRef } from "react"
import { useRouter, usePathname } from "next/navigation"
import { FloatingDock } from "@components/ui/floating-dock"
import {
	IconAdjustments,
	IconBook,
	IconHome,
	IconLogout,
	IconChecklist,
	IconMessage,
	IconPlugConnected
} from "@tabler/icons-react"
import toast from "react-hot-toast"
import { IconBell } from "@tabler/icons-react"
import { motion } from "framer-motion"
import { cn } from "@utils/cn"

export default function FloatingNav({ onChatOpen, onNotificationsOpen }) {
	const router = useRouter()
	const pathname = usePathname()
	const [userDetails, setUserDetails] = useState(null)
	const isSelfHost = process.env.NEXT_PUBLIC_ENVIRONMENT === "selfhost"
	const [unreadCount, setUnreadCount] = useState(0)
	const wsRef = useRef(null)

	useEffect(() => {
		fetch("/api/user/profile")
			.then((res) => {
				if (res.ok) return res.json()
				return null
			})
			.then((data) => setUserDetails(data))
			.catch((err) => console.error("Failed to fetch user profile", err))
	}, [])

	useEffect(() => {
		if (!userDetails?.sub) {
			return
		}

		const connectWebSocket = async () => {
			if (wsRef.current && wsRef.current.readyState < 2) {
				return
			}
			try {
				const tokenResponse = await fetch("/api/auth/token")
				if (!tokenResponse.ok) {
					setTimeout(connectWebSocket, 5000)
					return
				}
				const { accessToken } = await tokenResponse.json()
				const wsProtocol =
					window.location.protocol === "https:" ? "wss" : "ws"
				const serverUrlHttp =
					process.env.NEXT_PUBLIC_APP_SERVER_URL ||
					"http://localhost:5000"
				// Strip the protocol from the server URL to get just the host and port
				const serverHost = serverUrlHttp.replace(/^https?:\/\//, "")
				const wsUrl = `${wsProtocol}://${serverHost}/api/ws/notifications`
				const ws = new WebSocket(wsUrl)
				ws.isCleaningUp = false
				wsRef.current = ws
				ws.onopen = () => {
					ws.send(
						JSON.stringify({ type: "auth", token: accessToken })
					)
				}
				ws.onmessage = (event) => {
					const data = JSON.parse(event.data)
					if (data.type === "new_notification" && data.notification) {
						setUnreadCount((prev) => prev + 1)
						toast.custom(
							(t) => (
								<div
									className={`${t.visible ? "animate-enter" : "animate-leave"} max-w-md w-full bg-neutral-800 shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5 border border-neutral-700`}
								>
									<div className="flex-1 w-0 p-4">
										<div className="flex items-start">
											<div className="flex-shrink-0 pt-0.5">
												{" "}
												<IconBell className="h-6 w-6 text-[var(--color-accent-blue)]" />{" "}
											</div>
											<div className="ml-3 flex-1">
												<p className="text-sm font-medium text-white">
													New Notification
												</p>
												<p className="mt-1 text-sm text-gray-400">
													{data.notification.message}
												</p>
											</div>
										</div>
									</div>
									<div className="flex border-l border-neutral-700">
										<button
											onClick={() => {
												router.push("/tasks")
												toast.dismiss(t.id)
											}}
											className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-[var(--color-accent-blue)] hover:text-[var(--color-accent-blue-hover)] focus:outline-none"
										>
											View
										</button>
									</div>
								</div>
							),
							{ duration: 10000 }
						)
					}
				}
				ws.onclose = () => {
					if (!ws.isCleaningUp) {
						wsRef.current = null
						setTimeout(connectWebSocket, 5000)
					}
				}
				ws.onerror = (error) => {
					ws.close()
				}
			} catch (error) {
				setTimeout(connectWebSocket, 5000)
			}
		}
		connectWebSocket()
		return () => {
			if (wsRef.current) {
				wsRef.current.isCleaningUp = true
				wsRef.current.close()
				wsRef.current = null
			}
		}
	}, [userDetails?.sub, router])

	const NotificationIcon = ({ className }) => (
		<div className="relative h-full w-full flex items-center justify-center">
			<IconBell
				className={cn(
					"h-full w-full text-neutral-500 dark:text-neutral-300",
					className
				)}
			/>
			{unreadCount > 0 && (
				<motion.div
					initial={{ scale: 0 }}
					animate={{ scale: 1 }}
					className="absolute top-0 right-0 h-3 w-3 bg-[var(--color-accent-red)] rounded-full border-2 border-[var(--color-primary-surface)]"
				/>
			)}
		</div>
	)

	const navLinks = [
		{
			title: "Home",
			href: "/home",
			icon: (
				<IconHome className="h-full w-full text-neutral-500 dark:text-neutral-300" />
			)
		},
		{
			title: "Tasks",
			href: "/journal", // This page is now the main task list
			icon: (
				<IconChecklist className="h-full w-full text-neutral-500 dark:text-neutral-300" />
			)
		},
		{
			title: "Integrations",
			href: "/integrations",
			icon: (
				<IconPlugConnected className="h-full w-full text-neutral-500 dark:text-neutral-300" />
			)
		},
		{
			title: "Notifications",
			href: "#",
			icon: <NotificationIcon />,
			onClick: () => {
				setUnreadCount(0)
				onNotificationsOpen()
			}
		},
		{
			title: "Settings",
			href: "/settings",
			icon: (
				<IconAdjustments className="h-full w-full text-neutral-500 dark:text-neutral-300" />
			)
		}
	]

	const actionLinks = [
		{
			title: "Chat",
			href: "#",
			onClick: onChatOpen,
			icon: (
				<IconMessage className="h-full w-full text-neutral-500 dark:text-neutral-300" />
			)
		}
	]
	const allLinks = [...navLinks, ...actionLinks]

	if (userDetails && !isSelfHost) {
		allLinks.push({
			title: "Logout",
			href: "/auth/logout",
			icon: (
				<IconLogout className="h-full w-full text-neutral-500 dark:text-neutral-300" />
			)
		})
	}

	if (pathname === "/onboarding" || pathname === "/") {
		return null
	}

	// Filter out the "Profile" link and replace it with "Settings"
	const finalLinks = allLinks.filter((link) => link.title !== "Profile")

	return <FloatingDock items={finalLinks} />
}
