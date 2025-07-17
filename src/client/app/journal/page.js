"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import toast from "react-hot-toast"
import { usePostHog } from "posthog-js/react"
import { IconLoader, IconSearch, IconHelpCircle } from "@tabler/icons-react"
import { Tooltip } from "react-tooltip"
import { AnimatePresence, motion } from "framer-motion"
import KanbanColumn from "@components/journal/KanbanColumn"
import EditTaskModal from "@components/journal/EditTaskModal"
import ClarificationModal from "@components/journal/ClarificationModal"
import TaskDetailsModal from "@components/journal/TaskDetailsModal"
import DeleteConfirmationModal from "@components/journal/DeleteConfirmationModal"

const KANBAN_STAGES = {
	action_items: {
		title: "Action Items",
		color: "border-blue-500",
		statuses: ["context_verification"]
	},
	clarification_needed: {
		title: "Clarification Needed",
		color: "border-orange-500",
		statuses: ["clarification_pending"]
	},
	approval_needed: {
		title: "Approval Needed",
		color: "border-purple-500",
		statuses: ["approval_pending", "planning"]
	},
	ongoing: {
		title: "Ongoing",
		color: "border-yellow-500",
		statuses: ["processing", "pending"]
	},
	completed: {
		title: "Completed",
		color: "border-green-500",
		statuses: ["completed", "error", "cancelled"]
	},
	scheduled: {
		title: "Scheduled",
		color: "border-cyan-500",
		statuses: ["pending"] // Special filtering needed
	},
	recurring: {
		title: "Recurring",
		color: "border-teal-500",
		statuses: ["active"]
	}
}

const OrganizerPage = () => {
	const [searchQuery, setSearchQuery] = useState("")
	const [editingTask, setEditingTask] = useState(null)
	const [clarifyingTask, setClarifyingTask] = useState(null)
	const [viewingTask, setViewingTask] = useState(null) // For TaskDetailsModal
	const [deletingBlock, setDeletingBlock] = useState(null)
	const posthog = usePostHog()
	const [allTasks, setAllTasks] = useState([]) // Combined loading state
	const [isLoading, setIsLoading] = useState(true) // Combined loading state

	const [integrations, setIntegrations] = useState([]) // For checking connected tools
	const [allTools, setAllTools] = useState([])

	// Fetch journal entries and tasks for the current week
	const fetchData = useCallback(async () => {
		setIsLoading(true)
		try {
			const [tasksRes, integrationsRes] = await Promise.all([
				fetch("/api/tasks"),
				fetch("/api/settings/integrations")
			])

			if (!tasksRes.ok) throw new Error("Failed to fetch tasks")
			if (!integrationsRes.ok)
				throw new Error("Failed to fetch integrations")

			const tasksData = await tasksRes.json()
			setAllTasks(Array.isArray(tasksData.tasks) ? tasksData.tasks : [])

			const integrationsData = await integrationsRes.json()
			const allIntegrations = integrationsData.integrations || []
			setIntegrations(allIntegrations)
			const tools = allIntegrations.map((i) => ({
				name: i.name,
				display_name: i.display_name
			}))
			setAllTools(tools)
		} catch (error) {
			toast.error(error.message)
		} finally {
			setIsLoading(false)
		}
	}, [])

	useEffect(() => {
		fetchData()
	}, [fetchData])

	const tasksById = useMemo(() => {
		return allTasks.reduce((acc, task) => {
			acc[task.task_id] = task
			return acc
		}, {})
	}, [allTasks])

	const searchResults = useMemo(() => {
		if (!searchQuery) return []
		const lowerQuery = searchQuery.toLowerCase()

		const taskResults = allTasks
			.filter((t) => t.description.toLowerCase().includes(lowerQuery))
			.map((t) => ({ ...t, item_type: "task" }))

		return taskResults.sort(
			(a, b) => new Date(b.created_at) - new Date(a.created_at)
		)
	}, [searchQuery, allTasks])

	const refreshData = () => {
		fetchData()
	}

	const handleApproveTask = async (taskId) => {
		if (!taskId) return
		try {
			const response = await fetch("/api/tasks/approve", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ taskId })
			})
			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(errorData.error || "Approval failed")
			}
			posthog?.capture("task_approved", { task_id: taskId })
			toast.success("Plan approved! Task has been queued for execution.")
			refreshData()
		} catch (error) {
			toast.error(`Error approving task: ${error.message}`)
		}
	}

	const handleAnswerClarifications = async (taskId, answers) => {
		if (!taskId || !answers || answers.length === 0) return false
		try {
			const response = await fetch("/api/tasks/clarify", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ taskId, answers })
			})
			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(errorData.error || "Failed to submit answers")
			}
			toast.success("Answers submitted! Task will now proceed.")
			refreshData()
			return true
		} catch (error) {
			toast.error(`Error submitting answers: ${error.message}`)
			return false
		}
	}

	const handleToggleEnableTask = async (taskId, isEnabled) => {
		try {
			const response = await fetch("/api/tasks/update", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ taskId, enabled: !isEnabled })
			})
			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(
					errorData.error || "Failed to update workflow status."
				)
			}
			toast.success(`Workflow ${!isEnabled ? "resumed" : "paused"}.`)
			refreshData()
		} catch (error) {
			toast.error(error.message)
		}
	}
	const handleDeleteTask = async (taskId) => {
		if (
			!taskId ||
			!window.confirm("Are you sure you want to delete this task?")
		)
			return

		const taskToDelete = allTasks.find((t) => t.task_id === taskId)

		try {
			const response = await fetch("/api/tasks/delete", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ taskId })
			})
			if (!response.ok) throw new Error((await response.json()).error)
			if (taskToDelete?.status === "approval_pending") {
				posthog?.capture("task_disapproved", { task_id: taskId })
			}
			toast.success("Task deleted successfully!")
			refreshData()
			setViewingTask(null) // Clear the viewing state to prevent stale UI
		} catch (error) {
			toast.error(`Error deleting task: ${error.message}`)
		}
	}

	const handleUpdateTask = async () => {
		// This will be called from the EditTaskModal
		if (!editingTask) return
		try {
			const response = await fetch("/api/tasks/update", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					...editingTask,
					taskId: editingTask.task_id
				})
			})
			if (!response.ok) throw new Error((await response.json()).error)
			posthog?.capture("task_edited", {
				task_id: editingTask.task_id,
				is_recurring: editingTask.schedule?.type === "recurring"
			})
			toast.success("Task updated successfully!")
			setEditingTask(null)
			refreshData()
		} catch (error) {
			toast.error(`Failed to update task: ${error.message}`)
		}
	}

	const handleUpdateTaskSchedule = async (taskId, schedule) => {
		if (!taskId) return false
		try {
			const response = await fetch("/api/tasks/update", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ taskId, schedule })
			})
			if (!response.ok) throw new Error((await response.json()).error)
			toast.success("Task schedule updated!")
			fetchData() // Refresh data
			return true // Indicate success
		} catch (error) {
			toast.error(`Failed to update schedule: ${error.message}`)
			return false
		}
	}

	const displayedTasks = useMemo(() => {
		if (!searchQuery) return allTasks
		const lowerQuery = searchQuery.toLowerCase()
		return allTasks.filter((task) =>
			task.description.toLowerCase().includes(lowerQuery)
		)
	}, [allTasks, searchQuery])

	const boards = useMemo(() => {
		const now = new Date()
		const boardData = {
			action_items: displayedTasks.filter((t) =>
				KANBAN_STAGES.action_items.statuses.includes(t.status)
			),
			clarification_needed: displayedTasks.filter((t) =>
				KANBAN_STAGES.clarification_needed.statuses.includes(t.status)
			),
			approval_needed: displayedTasks.filter((t) =>
				KANBAN_STAGES.approval_needed.statuses.includes(t.status)
			),
			ongoing: displayedTasks.filter(
				(t) =>
					KANBAN_STAGES.ongoing.statuses.includes(t.status) &&
					(t.schedule?.type !== "once" ||
						!t.next_execution_at ||
						new Date(t.next_execution_at) <= now)
			),
			completed: displayedTasks.filter((t) =>
				KANBAN_STAGES.completed.statuses.includes(t.status)
			),
			scheduled: displayedTasks.filter(
				(t) =>
					t.status === "pending" &&
					t.schedule?.type === "once" &&
					t.next_execution_at &&
					new Date(t.next_execution_at) > now
			),
			recurring: displayedTasks.filter(
				(t) =>
					t.status === "active" &&
					t.schedule?.type === "recurring" &&
					t.enabled
			)
		}
		return boardData
	}, [displayedTasks])

	return (
		<div className="flex h-screen bg-gradient-to-br from-[var(--color-primary-background)] via-[var(--color-primary-background)] to-[var(--color-primary-surface)]/20 text-[var(--color-text-primary)] overflow-x-hidden pl-0 md:pl-20">
			<Tooltip id="journal-tooltip" style={{ zIndex: 9999 }} />
			<Tooltip id="journal-help" style={{ zIndex: 9999 }} />
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
						<div className="relative w-full max-w-xs">
							<IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
							<input
								type="text"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								placeholder="Search tasks..."
								className="w-full bg-neutral-800/50 border border-neutral-700/80 rounded-lg py-2 pl-10 pr-4 transition-colors focus:border-[var(--color-accent-blue)]"
							/>
						</div>
						<button
							data-tooltip-id="journal-help"
							data-tooltip-content="This is your main workflow page. Add action items and watch them move through the pipeline."
							className="p-1.5 rounded-full text-neutral-500 hover:text-white hover:bg-[var(--color-primary-surface)] pulse-glow-animation"
						>
							<IconHelpCircle size={22} />
						</button>
					</div>
				</motion.header>
				<main className="flex-1 flex overflow-x-auto p-4 md:p-6 space-x-6 custom-scrollbar">
					{isLoading ? (
						<div className="flex justify-center items-center h-full">
							<IconLoader className="w-10 h-10 animate-spin text-[var(--color-accent-blue)]" />
						</div>
					) : (
						Object.entries(KANBAN_STAGES).map(([key, stage]) => (
							<KanbanColumn
								key={key}
								stageKey={key}
								title={stage.title}
								color={stage.color}
								tasks={boards[key]}
								onDataChange={refreshData}
								onViewTask={setViewingTask}
								onEditTask={setEditingTask}
								onDeleteTask={handleDeleteTask}
								onApproveTask={handleApproveTask}
								onClarifyTask={setClarifyingTask}
								integrations={integrations}
							/>
						))
					)}
				</main>
			</div>
			<AnimatePresence>
				{editingTask && (
					<EditTaskModal
						key={editingTask.task_id}
						task={editingTask}
						onClose={() => setEditingTask(null)}
						onSave={handleUpdateTask}
						setTask={setEditingTask}
						onUpdateSchedule={handleUpdateTaskSchedule}
						allTools={allTools}
						integrations={integrations}
					/>
				)}
				{clarifyingTask && (
					<ClarificationModal
						task={clarifyingTask}
						onClose={() => setClarifyingTask(null)}
						onSubmit={handleAnswerClarifications}
						onDelete={handleDeleteTask}
					/>
				)}
				{viewingTask && (
					<TaskDetailsModal
						task={viewingTask}
						onClose={() => setViewingTask(null)}
						onApprove={handleApproveTask}
						onEdit={setEditingTask}
						onDelete={handleDeleteTask}
						integrations={integrations}
					/>
				)}
				{deletingBlock && (
					<DeleteConfirmationModal
						block={deletingBlock}
						onClose={() => setDeletingBlock(null)}
						onDataChange={refreshData}
					/>
				)}
			</AnimatePresence>
		</div>
	)
}

export default OrganizerPage
