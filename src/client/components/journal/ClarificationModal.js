"use client"

import React, { useState } from "react"
import { motion } from "framer-motion"
import toast from "react-hot-toast"
import { IconX, IconLoader, IconTrash } from "@tabler/icons-react"

const ClarificationModal = ({ task, onClose, onSubmit, onDelete }) => {
	const [answers, setAnswers] = useState({})
	const [isSubmitting, setIsSubmitting] = useState(false)

	const handleAnswerChange = (questionId, text) => {
		setAnswers((prev) => ({ ...prev, [questionId]: text }))
	}

	const handleSubmit = async () => {
		setIsSubmitting(true)
		const answersPayload = Object.entries(answers).map(
			([question_id, answer_text]) => ({
				question_id,
				answer_text
			})
		)
		const success = await onSubmit(task.task_id, answersPayload)
		setIsSubmitting(false)
		if (success) {
			onClose()
		}
	}

	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4"
		>
			<motion.div
				initial={{ scale: 0.9, y: 20 }}
				animate={{ scale: 1, y: 0 }}
				exit={{ scale: 0.9, y: 20 }}
				className="bg-gradient-to-br from-[var(--color-primary-surface)] to-[var(--color-primary-background)] p-6 rounded-2xl shadow-xl w-full max-w-2xl border border-[var(--color-primary-surface-elevated)] max-h-[90vh] flex flex-col"
			>
				<div className="flex justify-between items-start mb-4">
					<div>
						<h3 className="text-xl font-semibold">
							Clarification Needed
						</h3>
						<p className="text-sm text-neutral-400 mt-1">
							The AI needs more information for: "
							{task.description}"
						</p>
					</div>
					<button onClick={onClose} className="hover:text-white">
						<IconX />
					</button>
				</div>
				<div className="space-y-4 overflow-y-auto custom-scrollbar pr-2">
					{task.clarifying_questions.map((q) => (
						<div key={q.question_id}>
							<label className="text-sm text-gray-300 block mb-1.5">
								{q.text}
							</label>
							<textarea
								value={answers[q.question_id] || ""}
								onChange={(e) =>
									handleAnswerChange(
										q.question_id,
										e.target.value
									)
								}
								rows={2}
								className="w-full p-2 bg-neutral-800/80 border border-neutral-600 rounded-md text-sm focus:border-blue-500 transition-colors"
								placeholder="Your answer..."
							/>
						</div>
					))}
				</div>
				<div className="flex justify-between items-center mt-6 pt-4 border-t border-neutral-700">
					<div>
						<button
							onClick={() => onDelete(task.task_id)}
							className="py-2 px-4 rounded-lg bg-red-600/20 text-red-400 hover:bg-red-600/40 text-sm font-semibold flex items-center gap-2"
						>
							<IconTrash size={16} /> Delete Task
						</button>
					</div>
					<div className="flex items-center gap-4">
						<button
							onClick={handleSubmit}
							disabled={isSubmitting}
							className="py-2.5 px-6 rounded-lg bg-[var(--color-accent-blue)] hover:bg-[var(--color-accent-blue-hover)] text-sm transition-colors disabled:opacity-50 flex items-center justify-center min-w-[120px]"
						>
							{isSubmitting ? (
								<IconLoader className="animate-spin h-5 w-5" />
							) : (
								"Submit Answers"
							)}
						</button>
					</div>
				</div>
			</motion.div>
		</motion.div>
	)
}

export default ClarificationModal
