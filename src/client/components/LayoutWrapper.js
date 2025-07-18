"use client"
import React, { useState, useEffect, useCallback } from "react"
import ChatOverlay from "@components/ChatOverlay"
import NotificationsOverlay from "@components/NotificationsOverlay"
import FloatingNav from "@components/FloatingNav"
import {
	IconMessage,
	IconKeyboard,
	IconCommand,
	IconX
} from "@tabler/icons-react"
import { usePathname, useRouter } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"

const ShortcutLegendModal = ({ onClose }) => {
	const shortcuts = {
		Global: [
			{ keys: ["Ctrl", "M"], description: "Open Chat" },
			{ keys: ["Ctrl", "B"], description: "Toggle Notifications" },
			{ keys: ["Ctrl", "?"], description: "Toggle Shortcuts Legend" },
			{ keys: ["Esc"], description: "Close Modal / Chat" }
		],
		Navigation: [
			{ keys: ["Ctrl", "H"], description: "Go to Home" },
			{ keys: ["Ctrl", "J"], description: "Go to Organizer" },
			{ keys: ["Ctrl", "A"], description: "Go to Tasks" },
			{ keys: ["Ctrl", "I"], description: "Go to Integrations" },
			{ keys: ["Ctrl", "S"], description: "Go to Settings" }
		]
	}

	return (
		<div
			className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-[100] p-4"
			onClick={onClose}
		>
			<motion.div
				initial={{ scale: 0.9, opacity: 0 }}
				animate={{ scale: 1, opacity: 1 }}
				exit={{ scale: 0.9, opacity: 0 }}
				transition={{ type: "spring", stiffness: 400, damping: 30 }}
				className="bg-gradient-to-br from-[var(--color-primary-surface)] to-[var(--color-primary-background)] p-6 rounded-2xl shadow-xl w-full max-w-2xl border border-[var(--color-primary-surface-elevated)]"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex justify-between items-center mb-6">
					<h2 className="text-2xl font-bold text-white flex items-center gap-3">
						<IconKeyboard />
						Keyboard Shortcuts
					</h2>
					<button
						onClick={onClose}
						className="p-1 rounded-full hover:bg-[var(--color-primary-surface-elevated)]"
					>
						<IconX />
					</button>
				</div>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
					{Object.entries(shortcuts).map(([category, list]) => (
						<div key={category}>
							<h3 className="text-lg font-semibold text-[var(--color-accent-blue)] mb-4">
								{category}
							</h3>
							<div className="space-y-3">
								{list.map((shortcut) => (
									<div
										key={shortcut.description}
										className="flex justify-between items-center text-sm"
									>
										<span className="text-neutral-300">
											{shortcut.description}
										</span>
										<div className="flex items-center gap-2">
											{shortcut.keys.map((key) => (
												<kbd
													key={key}
													className="px-2 py-1.5 text-xs font-semibold text-gray-300 bg-neutral-700 border border-neutral-600 rounded-md"
												>
													{key}
												</kbd>
											))}
										</div>
									</div>
								))}
							</div>
						</div>
					))}
				</div>
			</motion.div>
		</div>
	)
}

const ShortcutIndicator = ({ onClick }) => (
	<button
		onClick={onClick}
		className="fixed bottom-5 right-5 z-40 items-center gap-2 px-3 py-2 bg-[var(--color-primary-surface)]/80 backdrop-blur-md text-neutral-400 border border-[var(--color-primary-surface-elevated)] rounded-full shadow-lg hover:bg-[var(--color-accent-blue)] hover:text-white transition-all duration-200 group hidden md:flex"
		aria-label="Show keyboard shortcuts"
	>
		<IconKeyboard
			size={20}
			className="group-hover:scale-110 transition-transform"
		/>
		<div className="flex items-center gap-1">
			<kbd className="px-1.5 py-0.5 text-xs font-semibold text-gray-300 bg-neutral-900/50 border border-neutral-600 rounded-md">
				Ctrl
			</kbd>
			<span className="text-xs">+</span>
			<kbd className="px-1.5 py-0.5 text-xs font-semibold text-gray-300 bg-neutral-900/50 border-neutral-600 rounded-md">
				?
			</kbd>
		</div>
	</button>
)

export default function LayoutWrapper({ children }) {
	const [isChatOpen, setChatOpen] = useState(false)
	const [isLegendOpen, setLegendOpen] = useState(false)
	const [isNotificationsOpen, setNotificationsOpen] = useState(false)
	const pathname = usePathname()
	const router = useRouter()

	const handleChatOpen = useCallback(() => {
		setChatOpen(true)
	}, [])

	const handleNotificationsOpen = useCallback(() => {
		setNotificationsOpen(true)
	}, [])

	const showChatButton = pathname !== "/onboarding" && pathname !== "/"

	const handleKeyDown = useCallback(
		(e) => {
			if (e.ctrlKey) {
				switch (e.key.toLowerCase()) {
					case "h":
						router.push("/home")
						break
					case "j":
						router.push("/journal") // "j" for journal/tasks
						break
					case "t":
						router.push("/journal")
						break
					case "i":
						router.push("/integrations")
						break
					case "s":
						router.push("/settings")
						break
					case "b":
						handleNotificationsOpen()
						break
					case "m":
						setChatOpen(true)
						break
					case "/":
					case "?":
						e.preventDefault()
						setLegendOpen((prev) => !prev)
						break
					default:
						return
				}
				e.preventDefault()
			} else if (e.key === "Escape") {
				if (isChatOpen) setChatOpen(false)
				if (isLegendOpen) setLegendOpen(false)
				if (isNotificationsOpen) setNotificationsOpen(false)
			}
		},
		[
			router,
			isChatOpen,
			isLegendOpen,
			isNotificationsOpen,
			handleNotificationsOpen
		]
	)

	useEffect(() => {
		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [handleKeyDown])

	return (
		<>
			<FloatingNav
				onChatOpen={handleChatOpen}
				onNotificationsOpen={handleNotificationsOpen}
			/>
			{children}
			<AnimatePresence>
				{isChatOpen && (
					<ChatOverlay
						key="chat-overlay"
						onClose={() => setChatOpen(false)}
					/>
				)}
				{isNotificationsOpen && (
					<NotificationsOverlay
						key="notifications-overlay"
						onClose={() => setNotificationsOpen(false)}
					/>
				)}
				{isLegendOpen && (
					<ShortcutLegendModal
						key="shortcut-legend"
						onClose={() => setLegendOpen(false)}
					/>
				)}
			</AnimatePresence>
			{showChatButton &&
				!isLegendOpen &&
				!isChatOpen &&
				!isNotificationsOpen && (
					<ShortcutIndicator onClick={() => setLegendOpen(true)} />
				)}
		</>
	)
}
