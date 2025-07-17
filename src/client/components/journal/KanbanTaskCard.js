"use client"

import React from "react"
import { motion } from "framer-motion"
import { cn } from "@utils/cn"
import {
	IconCircleCheck,
	IconClock,
	IconPlayerPlay,
	IconAlertCircle,
	IconMailQuestion,
	IconRefresh,
	IconX,
	IconHelpCircle,
	IconMessageQuestion,
	IconPencil,
	IconTrash,
	IconAlertTriangle,
	IconLoader
} from "@tabler/icons-react"
import { Tooltip } from "react-tooltip"

const statusMap = {
	pending: { icon: IconClock, color: "text-yellow-400" },
	processing: { icon: IconPlayerPlay, color: "text-blue-400" },
	completed: { icon: IconCircleCheck, color: "text-green-400" },
	error: { icon: IconAlertCircle, color: "text-red-400" },
	approval_pending: { icon: IconMailQuestion, color: "text-purple-400" },
	clarification_pending: {
		icon: IconMessageQuestion,
		color: "text-orange-400"
	},
	active: { icon: IconRefresh, color: "text-green-500" },
	cancelled: { icon: IconX, color: "text-gray-500" },
	context_verification: {
		icon: IconLoader,
		color: "text-blue-300",
		isSpinning: true
	},
	planning: { icon: IconLoader, color: "text-blue-400", isSpinning: true },
	default: { icon: IconHelpCircle, color: "text-gray-400" }
}

const KanbanTaskCard = ({
	task,
	onViewTask,
	onEditTask,
	onDeleteTask,
	onApproveTask,
	onClarifyTask,
	integrations
}) => {
	const isProcessing =
		task.status === "context_verification" || task.status === "planning"
	const statusInfo = statusMap[task.status] || statusMap.default

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

	const handleClick = () => {
		if (isProcessing) return
		if (task.status === "clarification_pending") {
			onClarifyTask(task)
		} else if (task.status === "approval_pending") {
			onEditTask(task)
		} else {
			onViewTask(task)
		}
	}

	return (
		<motion.div
			layout
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			onClick={handleClick}
			className={cn(
				"bg-[var(--color-primary-surface)] p-3 rounded-lg border border-transparent hover:border-blue-500/50 group",
				isProcessing ? "cursor-wait" : "cursor-pointer"
			)}
		>
			<p className="text-sm leading-relaxed text-white">
				{task.description}
			</p>
			<div className="flex items-center justify-between mt-2 pt-2 border-t border-white/10">
				<div className="flex items-center gap-1.5 text-xs text-neutral-400">
					<statusInfo.icon
						className={cn(
							"h-4 w-4",
							statusInfo.color,
							statusInfo.isSpinning && "animate-spin"
						)}
					/>
					<span className="capitalize">
						{task.status.replace(/_/g, " ")}
					</span>
				</div>
				{missingTools.length > 0 && (
					<div
						className="flex items-center gap-1 text-yellow-400"
						data-tooltip-id="organizer-tooltip"
						data-tooltip-content={`Connect: ${missingTools.join(", ")}`}
					>
						<IconAlertTriangle size={14} />
					</div>
				)}
			</div>
		</motion.div>
	)
}

export default KanbanTaskCard
