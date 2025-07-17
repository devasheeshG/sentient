"use client"

import React, { useState } from "react"
import { motion } from "framer-motion"
import { cn } from "@utils/cn"
import { IconPlus } from "@tabler/icons-react"
import KanbanTaskCard from "./KanbanTaskCard"
import toast from "react-hot-toast"

const AddActionItemForm = ({ onAdd, onCancel }) => {
	const [content, setContent] = useState("")
	const [isSubmitting, setIsSubmitting] = useState(false)

	const handleSave = async () => {
		if (!content.trim()) return
		setIsSubmitting(true)
		try {
			const response = await fetch("/api/tasks/add", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ description: content })
			})
			if (!response.ok) {
				const error = await response.json()
				throw new Error(error.error || "Failed to add action item.")
			}
			toast.success("Action item added to the pipeline!")
			onAdd() // This will trigger a data refresh and close the form
		} catch (error) {
			toast.error(error.message)
			setIsSubmitting(false)
		}
	}

	return (
		<div className="p-2 bg-[var(--color-primary-surface)]/80 rounded-lg">
			<textarea
				value={content}
				onChange={(e) => setContent(e.target.value)}
				placeholder="Add an action item..."
				className="w-full bg-transparent p-2 rounded-md resize-none focus:outline-none placeholder:text-neutral-500 text-sm"
				rows={3}
				autoFocus
			/>
			<div className="flex justify-end gap-2 mt-2">
				<button
					onClick={onCancel}
					className="px-3 py-1 text-xs rounded-md hover:bg-[var(--color-primary-surface-elevated)]"
				>
					Cancel
				</button>
				<button
					onClick={handleSave}
					disabled={isSubmitting || !content.trim()}
					className="px-4 py-1 text-xs font-semibold bg-[var(--color-accent-blue)] text-white rounded-md disabled:opacity-50"
				>
					{isSubmitting ? "Adding..." : "Add"}
				</button>
			</div>
		</div>
	)
}

const KanbanColumn = ({
	stageKey,
	title,
	color,
	tasks,
	onDataChange,
	...handlers
}) => {
	const [isAdding, setIsAdding] = useState(false)

	return (
		<div
			className={cn(
				"w-80 flex-shrink-0 flex flex-col bg-neutral-800/40 rounded-xl max-h-full"
			)}
		>
			<div
				className={cn(
					"flex justify-between items-center p-3 rounded-t-xl border-t-4",
					color
				)}
			>
				<h2 className="font-semibold text-white">
					{title}{" "}
					<span className="text-sm text-neutral-400">
						({tasks.length})
					</span>
				</h2>
			</div>
			<div className="p-2 space-y-3 flex-1 overflow-y-auto custom-scrollbar">
				{tasks.map((task) => (
					<KanbanTaskCard
						key={task.task_id}
						task={task}
						{...handlers}
					/>
				))}
			</div>
			{stageKey === "action_items" && (
				<div className="p-2 mt-auto border-t border-white/5">
					{isAdding ? (
						<AddActionItemForm
							onAdd={() => {
								setIsAdding(false)
								onDataChange()
							}}
							onCancel={() => setIsAdding(false)}
						/>
					) : (
						<button
							onClick={() => setIsAdding(true)}
							className="w-full flex items-center justify-center gap-2 p-2 rounded-lg text-neutral-400 hover:bg-[var(--color-primary-surface)] hover:text-white transition-colors"
						>
							<IconPlus size={16} />
							<span className="text-sm font-medium">
								Add Item
							</span>
						</button>
					)}
				</div>
			)}
		</div>
	)
}

export default KanbanColumn
