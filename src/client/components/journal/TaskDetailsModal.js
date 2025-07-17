"use client"

import React from "react"
import { motion } from "framer-motion"
import { Tooltip } from "react-tooltip"
import {
	IconX,
	IconCircleCheck,
	IconAlertTriangle,
	IconPencil,
	IconTrash
} from "@tabler/icons-react"
import TaskDetailsContent from "./TaskDetailsContent"

const TaskDetailsModal = ({
	task,
	onClose,
	onApprove,
	onEdit,
	onDelete,
	integrations
}) => {
	let missingTools = []
	if (task.status === "approval_pending" && integrations) {
		const requiredTools = new Set(task.plan?.map((step) => step.tool) || [])
		requiredTools.forEach((toolName) => {
			const integration = integrations.find((i) => i.name === toolName)
			if (
				integration &&
				!integration.connected &&
				integration.auth_type !== "builtin"
			) {
				missingTools.push(integration.display_name || toolName)
			}
		})
	}
	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4"
		>
			<Tooltip id="task-details-tooltip" />
			<motion.div
				initial={{ scale: 0.9, y: 20 }}
				animate={{ scale: 1, y: 0 }}
				exit={{ scale: 0.9, y: 20 }}
				className="bg-gradient-to-br from-[var(--color-primary-surface)] to-[var(--color-primary-background)] p-6 rounded-2xl shadow-xl w-full max-w-3xl border border-[var(--color-primary-surface-elevated)] max-h-[90vh] flex flex-col"
			>
				<div className="flex justify-between items-center mb-6">
					<h3 className="text-2xl font-semibold text-white truncate">
						{task.description}
					</h3>
					<button onClick={onClose} className="hover:text-white">
						<IconX />
					</button>
				</div>
				<div className="overflow-y-auto custom-scrollbar pr-2 space-y-6">
					<TaskDetailsContent task={task} />
				</div>
				<div className="flex justify-between items-center mt-6 pt-4 border-t border-neutral-700/80">
					<div>
						{onDelete && (
							<button
								onClick={() => onDelete(task.task_id)}
								className="py-2 px-4 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/40 text-sm font-semibold flex items-center gap-2"
							>
								<IconTrash size={16} /> Delete
							</button>
						)}
					</div>
					<div className="flex items-center gap-4">
						<button
							onClick={onClose}
							className="py-2 px-5 rounded-lg bg-[var(--color-primary-surface-elevated)] hover:bg-[var(--color-primary-surface)] text-sm"
						>
							Close
						</button>
						{task.status === "approval_pending" && (
							<>
								<button
									onClick={() => onEdit(task)}
									className="py-2.5 px-5 rounded-lg bg-orange-500/80 hover:bg-orange-500 text-sm flex items-center gap-2"
								>
									<IconPencil size={16} /> Edit
								</button>
								<button
									onClick={() => onApprove(task.task_id)}
									className="py-2.5 px-6 rounded-lg bg-[var(--color-accent-green)] hover:bg-[var(--color-accent-green-hover)] text-sm flex items-center gap-2 disabled:opacity-50 transition-colors"
									disabled={missingTools.length > 0}
									title={
										missingTools.length > 0
											? `Connect: ${missingTools.join(", ")}`
											: "Approve Plan"
									}
								>
									<IconCircleCheck className="w-5 h-5" />{" "}
									Approve
								</button>
							</>
						)}
					</div>
				</div>
			</motion.div>
		</motion.div>
	)
}

export default TaskDetailsModal
