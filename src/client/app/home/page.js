"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
	IconSparkles,
	IconHelpCircle,
	IconBook,
	IconBulb,
	IconSettings,
	IconRepeat
} from "@tabler/icons-react"
import toast from "react-hot-toast"
import { motion, AnimatePresence } from "framer-motion"
import { Tooltip } from "react-tooltip"

const HelpTooltip = ({ content }) => (
	<div className="absolute top-6 right-6 z-40">
		<button
			data-tooltip-id="page-help-tooltip"
			data-tooltip-content={content}
			className="p-1.5 rounded-full text-neutral-500 hover:text-white hover:bg-[var(--color-primary-surface)] pulse-glow-animation"
		>
			<IconHelpCircle size={22} />
		</button>
	</div>
)

const IdeaCard = ({ icon, title, description, onClick, cta }) => (
	<motion.div
		whileHover={{ y: -5, boxShadow: "0 10px 20px rgba(0,0,0,0.2)" }}
		className="bg-gradient-to-br from-[var(--color-primary-surface)] to-neutral-800/60 p-6 rounded-2xl border border-[var(--color-primary-surface-elevated)] flex flex-col cursor-pointer"
		onClick={onClick}
	>
		<div className="flex items-center gap-4 mb-4">
			<div className="p-2 bg-[var(--color-accent-blue)]/20 rounded-lg text-[var(--color-accent-blue)]">
				{icon}
			</div>
			<h4 className="text-lg font-semibold text-white">{title}</h4>
		</div>
		<p className="text-sm text-[var(--color-text-secondary)] flex-grow mb-6">
			{description}
		</p>
		<div className="text-right">
			<span className="text-sm font-semibold text-[var(--color-accent-blue)] hover:underline">
				{cta} &rarr;
			</span>
		</div>
	</motion.div>
)

const HomePage = () => {
	const [userDetails, setUserDetails] = useState(null)
	const router = useRouter()

	const fetchUserDetails = useCallback(async () => {
		try {
			const response = await fetch("/api/user/data")
			if (!response.ok) throw new Error("Failed to fetch user details")
			const result = await response.json()
			const userName =
				result?.data?.personalInfo?.name ||
				result?.data?.onboardingAnswers?.["user-name"]
			setUserDetails({ given_name: userName || "User" })
		} catch (error) {
			toast.error(`Error fetching user details: ${error.message}`)
			setUserDetails({ given_name: "User" })
		}
	}, [])

	useEffect(() => {
		fetchUserDetails()
	}, [fetchUserDetails])

	const getGreeting = () => {
		const hour = new Date().getHours()
		if (hour < 12) return "Good Morning"
		if (hour < 18) return "Good Afternoon"
		return "Good Evening"
	}

	return (
		<div className="flex h-screen bg-[var(--color-primary-background)] text-[var(--color-text-primary)] overflow-x-hidden pl-0 md:pl-20">
			<Tooltip id="home-tooltip" style={{ zIndex: 9999 }} />
			<Tooltip id="page-help-tooltip" style={{ zIndex: 9999 }} />
			<div className="flex-1 flex flex-col overflow-hidden relative">
				<HelpTooltip content="This is your Home page. Get a high-level overview and jump into key areas of the app." />
				<main className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
					<div className="max-w-7xl w-full mx-auto">
						{/* Header Section */}
						<div className="mb-8 lg:mb-12">
							<motion.div
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.5 }}
								className="flex items-center mb-3"
							>
								<h1 className="text-3xl lg:text-4xl font-semibold text-[var(--color-text-primary)]">
									{getGreeting()},{" "}
									{userDetails?.given_name || "User"}
								</h1>
								<IconSparkles className="w-6 h-6 text-[var(--color-accent-blue)] ml-3 animate-pulse" />
							</motion.div>
							<motion.p
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.5, delay: 0.1 }}
								className="text-lg text-[var(--color-text-secondary)]"
							>
								I'm all ears. What’s next?
							</motion.p>
						</div>

						{/* Use Cases Section */}
						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.5, delay: 0.4 }}
							className="mt-12 lg:mt-16"
						>
							<h2 className="text-2xl font-semibold text-center mb-8 text-[var(--color-text-primary)]">
								What's Possible with Sentient?
							</h2>
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
								<IdeaCard
									icon={<IconRepeat size={24} />}
									title="Automate Reports"
									description="Set up a recurring workflow to search your Gmail for weekly reports and summarize them in a Google Doc."
									cta="Go to Organizer"
									onClick={() => router.push("/journal")}
								/>
								<IdeaCard
									icon={<IconSettings size={24} />}
									title="Personalize Your AI"
									description="Teach Sentient about your communication style and preferences in the Settings page."
									cta="Customize personality"
									onClick={() => router.push("/settings")}
								/>
								<IdeaCard
									icon={<IconBulb size={24} />}
									title="Never Forget an Idea"
									description="Add action items to your pipeline and let Sentient figure out the plan to get it done."
									cta="Go to Organizer"
									onClick={() => router.push("/journal")}
								/>
							</div>
						</motion.div>
					</div>
				</main>
			</div>
		</div>
	)
}

export default HomePage
