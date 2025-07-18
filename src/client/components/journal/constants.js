import {
	IconClock,
	IconRefresh,
	IconCircleCheck,
	IconAlertCircle,
	IconMailQuestion,
	IconLoader,
	IconMessageQuestion,
	IconPlayerPlay,
	IconX
} from "@tabler/icons-react"

export const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export const taskStatusColors = {
	pending: {
		icon: IconClock,
		color: "text-gray-400",
		bg: "bg-[var(--color-status-pending)]/80",
		border: "border-[var(--color-status-pending)]"
	},
	processing: {
		icon: IconRefresh,
		color: "text-blue-400",
		bg: "bg-[var(--color-accent-blue)]/80",
		border: "border-[var(--color-accent-blue)]"
	},
	completed: {
		icon: IconCircleCheck,
		color: "text-green-400",
		bg: "bg-[var(--color-accent-green)]/80",
		border: "border-[var(--color-accent-green)]"
	},
	error: {
		icon: IconAlertCircle,
		color: "text-red-400",
		bg: "bg-[var(--color-accent-red)]/80",
		border: "border-[var(--color-accent-red)]"
	},
	approval_pending: {
		icon: IconMailQuestion,
		label: "Pending Approval",
		color: "text-yellow-400",
		bg: "bg-[var(--color-accent-purple)]/80",
		border: "border-[var(--color-accent-purple)]",
		borderColor: "border-yellow-400"
	},
	clarification_pending: {
		icon: IconMessageQuestion,
		label: "Clarification Needed",
		color: "text-orange-400",
		bg: "bg-[var(--color-accent-orange)]/80",
		border: "border-[var(--color-accent-orange)]"
	},
	context_verification: {
		icon: IconLoader,
		label: "Processing",
		color: "text-blue-400",
		bg: "bg-[var(--color-accent-blue)]/80",
		border: "border-[var(--color-accent-blue)]"
	},
	planning: {
		icon: IconLoader,
		label: "Generating Plan",
		color: "text-blue-400",
		bg: "bg-[var(--color-accent-blue)]/80",
		border: "border-[var(--color-accent-blue)]"
	},
	active: {
		icon: IconPlayerPlay,
		color: "text-green-400",
		bg: "bg-[var(--color-accent-green)]/80",
		border: "border-[var(--color-accent-green)]"
	},
	cancelled: {
		icon: IconX,
		color: "text-gray-500",
		bg: "bg-gray-600/80",
		border: "border-[var(--color-text-muted)]"
	},
	default: {
		icon: IconAlertCircle,
		color: "text-gray-500",
		bg: "bg-gray-500/80",
		border: "border-[var(--color-text-secondary)]"
	}
}

export const priorityMap = {
	0: { label: "High", color: "text-red-400", bg: "bg-red-500/10" },
	1: { label: "Medium", color: "text-yellow-400", bg: "bg-yellow-500/10" },
	2: { label: "Low", color: "text-gray-400", bg: "bg-gray-500/10" },
	default: {
		label: "Medium",
		color: "text-yellow-400",
		bg: "bg-yellow-500/10"
	}
}
