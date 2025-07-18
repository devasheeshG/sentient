"use client"

import React, { useState, useEffect, useCallback } from "react"
import toast from "react-hot-toast"
import { usePostHog } from "posthog-js/react"
import {
	IconLoader,
	IconHelpCircle,
	IconPlus,
	IconUser,
	IconSparkles,
	IconChevronDown,
	IconCircleCheck,
	IconDots
} from "@tabler/icons-react"
import { Tooltip } from "react-tooltip"
import { AnimatePresence, motion } from "framer-motion"
import { cn } from "@utils/cn"
import TaskChatPanel from "@components/journal/TaskDetailsModal" // Repurposed as Chat Panel
import { priorityMap, taskStatusColors } from "@components/journal/constants"

const AddTaskInline = ({ onTaskAdded }) => {
	const [description, setDescription] = useState("")
	const [isSubmitting, setIsSubmitting] = useState(false)

	const handleSubmit = async (e) => {
		e.preventDefault()
		if (!description.trim()) return
		setIsSubmitting(true)
		try {
			const response = await fetch("/api/tasks/add", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ description })
			})
			if (!response.ok) {
				const error = await response.json()
				throw new Error(error.error || "Failed to add task.")
			}
			toast.success("Task added.")
			setDescription("")
			onTaskAdded()
		} catch (error) {
			toast.error(error.message)
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<form
			onSubmit={handleSubmit}
			className="grid grid-cols-[auto,1fr,120px,100px,180px] items-center gap-4 p-2 border-b border-neutral-800"
		>
			<div className="pl-2">
				<IconPlus size={18} className="text-neutral-500" />
			</div>
			<input
				type="text"
				value={description}
				onChange={(e) => setDescription(e.target.value)}
				placeholder="Add a new task..."
				className="w-full bg-transparent py-1 text-base placeholder:text-neutral-500 focus:outline-none"
			/>
			{/* Placeholder columns to maintain layout */}
			<div></div>
			<div></div>
			<div></div>
		</form>
	)
}

const PriorityTag = ({ priority }) => {
	const { label, color, bg } = priorityMap[priority] || priorityMap.default
	return (
		<div
			className={cn(
				"flex items-center justify-center gap-1.5 w-full py-1 px-2 text-xs font-medium rounded-md text-center",
				color,
				bg
			)}
		>
			<IconDots size={12} />
			{label}
		</div>
	)
}

const StatusTag = ({ status }) => {
	const statusInfo = taskStatusColors[status] || taskStatusColors.default
	const Icon = statusInfo.icon
	return (
		<div
			className={cn(
				"flex items-center justify-center gap-1.5 w-full py-1 px-2 text-xs font-medium rounded-md text-center",
				statusInfo.color,
				statusInfo.bg
			)}
		>
			<Icon size={14} />
			<span className="capitalize">{status.replace(/_/g, " ")}</span>
		</div>
	)
}

const TaskRow = ({ task, onSelectTask, onAssigneeChange }) => {
	const [isMenuOpen, setIsMenuOpen] = useState(false)

	const handleAssigneeClick = (newAssignee) => {
		onAssigneeChange(task.task_id, newAssignee)
		setIsMenuOpen(false)
	}

	return (
		<div
			onClick={() => onSelectTask(task)}
			className="grid grid-cols-[auto,1fr,120px,100px,180px] items-center gap-4 group p-2 border-b border-neutral-800 hover:bg-neutral-800/40 cursor-pointer transition-colors"
		>
			<div className="pl-2">
				<IconCircleCheck
					size={18}
					className={cn(
						"transition-colors",
						task.status === "completed"
							? "text-green-500"
							: "text-neutral-600 group-hover:text-green-500/50"
					)}
				/>
			</div>
			<div className="truncate py-1">
				<p className="text-white truncate">{task.description}</p>
			</div>
			<div className="relative">
				<button
					onClick={(e) => {
						e.stopPropagation()
						setIsMenuOpen(!isMenuOpen)
					}}
					className={cn(
						"flex items-center justify-center gap-2 w-full p-1.5 rounded-md text-sm transition-colors",
						task.assigned_to === "ai"
							? "bg-blue-500/10 text-blue-300 hover:bg-blue-500/20"
							: "bg-neutral-700/50 text-neutral-300 hover:bg-neutral-700"
					)}
				>
					{task.assigned_to === "ai" ? (
						<IconSparkles size={16} />
					) : (
						<IconUser size={16} />
					)}
					<span className="capitalize font-medium">
						{task.assigned_to}
					</span>
				</button>
				<AnimatePresence>
					{isMenuOpen && (
						<motion.div
							initial={{ opacity: 0, y: -5, scale: 0.95 }}
							animate={{ opacity: 1, y: 0, scale: 1 }}
							exit={{ opacity: 0, y: -5, scale: 0.95 }}
							className="absolute top-full right-0 mt-2 w-36 bg-neutral-900 border border-neutral-700 rounded-md shadow-lg z-10 p-1"
						>
							<button
								onClick={(e) => {
									e.stopPropagation()
									handleAssigneeClick("user")
								}}
								className="w-full text-left px-3 py-1.5 text-sm text-white rounded hover:bg-neutral-800 flex items-center gap-2"
							>
								<IconUser size={16} /> User
							</button>
							<button
								onClick={(e) => {
									e.stopPropagation()
									handleAssigneeClick("ai")
								}}
								className="w-full text-left px-3 py-1.5 text-sm text-white rounded hover:bg-neutral-800 flex items-center gap-2"
							>
								<IconSparkles size={16} /> AI
							</button>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
			<div>
				<PriorityTag priority={task.priority} />
			</div>
			<div className="truncate">
				<p className="text-neutral-400 text-xs truncate text-center">
					{task.latest_progress_update || (
						<StatusTag status={task.status} />
					)}
				</p>
			</div>
		</div>
	)
}

const JournalPage = () => {
	const [tasks, setTasks] = useState([])
	const [isLoading, setIsLoading] = useState(true)
	const [selectedTask, setSelectedTask] = useState(null)
	const posthog = usePostHog()

	const fetchData = useCallback(async () => {
		setIsLoading(true)
		try {
			const tasksRes = await fetch("/api/tasks")
			if (!tasksRes.ok) throw new Error("Failed to fetch tasks")
			const tasksData = await tasksRes.json()
			setTasks(Array.isArray(tasksData.tasks) ? tasksData.tasks : [])
		} catch (error) {
			toast.error(error.message)
		} finally {
			setIsLoading(false)
		}
	}, []) // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		fetchData()
	}, [fetchData])

	const handleAssigneeChange = async (taskId, newAssignee) => {
		const originalTasks = [...tasks]
		setTasks((prevTasks) =>
			prevTasks.map((t) =>
				t.task_id === taskId ? { ...t, assigned_to: newAssignee } : t
			)
		)

		try {
			const response = await fetch("/api/tasks/update", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ taskId, assigned_to: newAssignee })
			})
			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(errorData.error || "Failed to update assignee.")
			}
			toast.success(`Task assigned to ${newAssignee}.`)
			posthog?.capture("task_assigned", {
				task_id: taskId,
				assignee: newAssignee
			})
			fetchData() // Refresh to get latest status from backend
		} catch (error) {
			toast.error(error.message)
			setTasks(originalTasks) // Revert on error
		}
	}

	const handleSelectTask = (task) => {
		if (task.assigned_to === "ai") {
			setSelectedTask(task)
		} else {
			// TODO: Open a simple edit/details modal for user-assigned tasks
			toast("Viewing user-assigned tasks is not implemented yet.")
		}
	}

	return (
		<div className="flex h-screen bg-gradient-to-br from-[var(--color-primary-background)] via-[var(--color-primary-background)] to-[var(--color-primary-surface)]/20 text-[var(--color-text-primary)] overflow-x-hidden pl-0 md:pl-20">
			<Tooltip id="tasks-tooltip" style={{ zIndex: 9999 }} />
			<div className="flex-1 flex flex-col overflow-hidden relative">
				<motion.header
					initial={{ y: -20, opacity: 0 }}
					animate={{ y: 0, opacity: 1 }}
					transition={{ duration: 0.6, ease: "easeOut" }}
					className="flex items-center justify-between p-4 md:p-6 border-b border-[var(--color-primary-surface)]/50 backdrop-blur-md bg-[var(--color-primary-background)]/90 shrink-0"
				>
					<div className="flex items-center gap-4">
						<h1 className="text-3xl font-semibold text-white">
							Organizer
						</h1>
						<button
							data-tooltip-id="tasks-tooltip"
							data-tooltip-content="This is your task list. Assign tasks to the AI to have them automated."
							className="p-1.5 rounded-full text-neutral-500 hover:text-white hover:bg-[var(--color-primary-surface)] pulse-glow-animation"
						>
							<IconHelpCircle size={22} />
						</button>
					</div>
				</motion.header>
				<main className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
					{isLoading ? (
						<div className="flex justify-center items-center h-full w-full">
							<IconLoader className="w-10 h-10 animate-spin text-[var(--color-accent-blue)]" />
						</div>
					) : (
						<div className="w-full max-w-7xl mx-auto">
							<div className="bg-neutral-800/20 rounded-lg border border-neutral-800">
								<div className="grid grid-cols-[auto,1fr,120px,100px,180px] items-center gap-4 p-3 text-xs text-neutral-400 font-semibold border-b border-neutral-800">
									<div />
									<div className="pl-1">TASK NAME</div>
									<div className="text-center">ASSIGNEE</div>
									<div className="text-center">PRIORITY</div>
									<div className="text-center">STATUS</div>
								</div>
								<div>
									<AddTaskInline onTaskAdded={fetchData} />
									{tasks.map((task) => (
										<TaskRow
											key={task.task_id}
											task={task}
											onSelectTask={handleSelectTask}
											onAssigneeChange={
												handleAssigneeChange
											}
										/>
									))}
									{tasks.length === 0 && (
										<div className="text-center py-12 text-neutral-500">
											<p>Your task list is empty.</p>
											<p>
												Add a task above to get started.
											</p>
										</div>
									)}
								</div>
							</div>
						</div>
					)}
				</main>
			</div>
			<AnimatePresence>
				{selectedTask && (
					<TaskChatPanel
						task={selectedTask}
						onClose={() => setSelectedTask(null)}
						onDataChange={fetchData} // To refresh list on progress updates
					/>
				)}
			</AnimatePresence>
		</div>
	)
}

export default JournalPage
