"use client"

import React, { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { Tooltip } from "react-tooltip"
import {
	IconX,
	IconSend,
	IconLoader,
	IconPlayerStopFilled
} from "@tabler/icons-react"
import ChatBubble from "@components/ChatBubble"
import toast from "react-hot-toast"

const TaskChatPanel = ({ task, onClose, onDataChange }) => {
	const [messages, setMessages] = useState(task.agent_history || [])
	const [input, setInput] = useState("")
	const [isSending, setIsSending] = useState(false)
	const chatEndRef = useRef(null)
	const abortControllerRef = useRef(null)

	useEffect(() => {
		chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
	}, [messages])

	const handleSendMessage = async () => {
		if (!input.trim()) return
		setIsSending(true)

		const newUserMessage = { role: "user", content: input }
		const updatedMessages = [...messages, newUserMessage]
		setMessages(updatedMessages)
		setInput("")

		abortControllerRef.current = new AbortController()

		try {
			const response = await fetch(`/api/tasks/${task.task_id}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ messages: updatedMessages }),
				signal: abortControllerRef.current.signal
			})

			if (!response.ok || !response.body) {
				const errorData = await response.json().catch(() => ({}))
				throw new Error(
					errorData.error ||
						"Failed to get streaming response from server."
				)
			}

			const reader = response.body.getReader()
			const decoder = new TextDecoder()
			let buffer = ""
			let assistantMessageId = null

			while (true) {
				const { value, done } = await reader.read()
				if (done) break

				buffer += decoder.decode(value, { stream: true })
				let newlineIndex
				while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
					const line = buffer.slice(0, newlineIndex).trim()
					buffer = buffer.slice(newlineIndex + 1)
					if (!line) continue

					try {
						const parsed = JSON.parse(line)
						if (parsed.type === "assistantStream") {
							const token = parsed.token || ""
							assistantMessageId = parsed.messageId

							setMessages((prev) => {
								const existingMsgIndex = prev.findIndex(
									(msg) => msg.id === assistantMessageId
								)
								if (existingMsgIndex !== -1) {
									return prev.map((msg, index) =>
										index === existingMsgIndex
											? {
													...msg,
													content:
														(msg.content || "") +
														token
												}
											: msg
									)
								} else {
									return [
										...prev,
										{
											id: assistantMessageId,
											role: "assistant",
											content: token
										}
									]
								}
							})
						}
					} catch (e) {
						console.error("Error parsing stream line:", line, e)
					}
				}
			}
		} catch (error) {
			if (error.name !== "AbortError") {
				toast.error(`Error: ${error.message}`)
			}
		} finally {
			setIsSending(false)
			onDataChange() // Refresh the main task list
		}
	}

	const handleStopStreaming = () => {
		abortControllerRef.current?.abort()
	}

	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-end z-50"
		>
			<Tooltip id="task-details-tooltip" />
			<motion.div
				initial={{ x: "100%" }}
				animate={{ x: 0 }}
				exit={{ x: "100%" }}
				transition={{ type: "spring", stiffness: 300, damping: 30 }}
				className="bg-gradient-to-br from-[var(--color-primary-surface)] to-[var(--color-primary-background)] shadow-xl w-full max-w-2xl h-full border-l border-[var(--color-primary-surface-elevated)] flex flex-col"
			>
				<header className="flex justify-between items-center p-4 border-b border-neutral-700 flex-shrink-0">
					<h3 className="text-xl font-semibold text-white truncate">
						{task.description}
					</h3>
					<button onClick={onClose} className="hover:text-white">
						<IconX />
					</button>
				</header>
				<div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
					{messages.map((msg, i) => (
						<div
							key={msg.id || i}
							className={`flex w-full ${
								msg.role === "user"
									? "justify-end"
									: "justify-start"
							}`}
						>
							<ChatBubble
								message={msg.content}
								isUser={msg.role === "user"}
							/>
						</div>
					))}
					<div ref={chatEndRef} />
				</div>
				<div className="p-4 border-t border-neutral-700 flex-shrink-0">
					<div className="relative">
						<textarea
							value={input}
							onChange={(e) => setInput(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter" && !e.shiftKey) {
									e.preventDefault()
									handleSendMessage()
								}
							}}
							placeholder="Chat with the AI about this task..."
							className="w-full bg-neutral-800/50 border border-neutral-700 rounded-lg p-3 pr-20 resize-none"
							rows={2}
						/>
						<div className="absolute right-3 top-1/2 -translate-y-1/2">
							{isSending ? (
								<button
									onClick={handleStopStreaming}
									className="p-2 rounded-full bg-red-500 text-white"
								>
									<IconPlayerStopFilled size={16} />
								</button>
							) : (
								<button
									onClick={handleSendMessage}
									disabled={!input.trim()}
									className="p-2 rounded-full bg-blue-500 text-white disabled:bg-neutral-600"
								>
									<IconSend size={16} />
								</button>
							)}
						</div>
					</div>
				</div>
			</motion.div>
		</motion.div>
	)
}

export default TaskChatPanel
