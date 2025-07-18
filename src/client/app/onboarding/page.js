"use client"
import React, { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@utils/cn"
import toast from "react-hot-toast"
import { usePostHog } from "posthog-js/react"
import Typewriter from "typewriter-effect"
import { useRouter } from "next/navigation"
import {
	IconLoader,
	IconMapPin,
	IconMapPinFilled,
	IconMoodHappy,
	IconBriefcase,
	IconHeart,
	IconUser,
	IconClock,
	IconListCheck,
	IconCheck,
	IconBrandWhatsapp,
	IconPlugConnected,
	IconBook,
	IconMessageChatbot,
	IconArrowRight,
	IconSparkles,
	IconLink
} from "@tabler/icons-react"

// --- Helper Components ---

const CheckFilled = ({ className }) => (
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		fill="currentColor"
		className={cn("w-6 h-6", className)}
	>
		<path
			fillRule="evenodd"
			d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z"
			clipRule="evenodd"
		/>
	</svg>
)

const BlinkingInstructions = ({ text }) => (
	<motion.p
		className="text-center text-sm text-neutral-500 mt-8"
		initial={{ opacity: 0.4 }}
		animate={{ opacity: [0.4, 1, 0.4] }}
		transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
	>
		{text}
	</motion.p>
)

// --- Onboarding Data ---

const questions = [
	{
		id: "user-name",
		sentientComment:
			"To get started, I just need to ask a few questions to personalize your experience. First things first...",
		question: "What should I call you?",
		type: "text-input",
		required: true,
		placeholder: "e.g., Alex",
		icon: <IconUser />
	},
	{
		id: "agent-name",
		sentientComment:
			"Great to meet you, {user-name}! I'm your personal AI. You can call me Sentient, or you can give me a name of your own.",
		question: "What would you like to call me? (Optional)",
		type: "text-input",
		required: false,
		placeholder: "e.g., Jarvis, Athena, Friday",
		icon: <IconMessageChatbot />
	},
	{
		id: "timezone",
		sentientComment:
			"Great to meet you, {user-name}! To make sure I'm always on your time...",
		question: "What's your timezone?",
		type: "select",
		required: true,
		options: [
			{ value: "", label: "Select your timezone...", disabled: true },
			{ value: "America/New_York", label: "Eastern Time (US & Canada)" },
			{ value: "America/Chicago", label: "Central Time (US & Canada)" },
			{ value: "America/Denver", label: "Mountain Time (US & Canada)" },
			{
				value: "America/Los_Angeles",
				label: "Pacific Time (US & Canada)"
			},
			{ value: "Europe/London", label: "London, Dublin (GMT/BST)" },
			{ value: "Europe/Berlin", label: "Berlin, Paris (CET)" },
			{ value: "Asia/Kolkata", label: "India (IST)" },
			{ value: "Asia/Singapore", label: "Singapore (SGT)" },
			{ value: "UTC", label: "Coordinated Universal Time (UTC)" }
		],
		icon: <IconClock />
	},
	{
		id: "whatsapp_number",
		sentientComment:
			"Got it. I can also send you important notifications on WhatsApp if you'd like.",
		question: "WhatsApp Number (Optional)",
		description:
			"Enter your number with country code (e.g., +14155552671).",
		type: "text-input",
		required: false,
		placeholder: "+14155552671",
		icon: <IconBrandWhatsapp />
	},
	{
		id: "location",
		sentientComment:
			"Perfect. Now, to help with local info like weather and places...",
		question: "Where are you located?",
		description:
			"Share your location for automatic updates, or type your city.",
		type: "location",
		icon: <IconMapPin />
	},
	{
		id: "professional-context",
		sentientComment:
			"This helps me understand your professional goals and context.",
		question: "What's your professional world like?",
		type: "textarea",
		placeholder: "e.g., I'm a software developer at a startup...",
		icon: <IconBriefcase />
	},
	{
		id: "personal-context",
		sentientComment:
			"And when you're not working? Tell me about your hobbies.",
		question: "What about your personal life and interests?",
		type: "textarea",
		placeholder: "e.g., I enjoy hiking, learning guitar, and soccer.",
		icon: <IconHeart />
	},
	{
		id: "linkedin-url",
		sentientComment:
			"To get a better professional snapshot, you can also provide your LinkedIn profile URL. This is optional.",
		question: "What is your LinkedIn Profile URL? (Optional)",
		type: "text-input",
		required: false,
		placeholder: "https://www.linkedin.com/in/your-profile",
		icon: <IconLink />
	},
	{
		id: "response-verbosity",
		sentientComment:
			"This is really helpful! Let's set the right tone for our chats. When I give you an answer, how much detail do you prefer?",
		question: "Choose your preferred level of detail",
		type: "single-choice",
		required: true,
		options: ["Concise", "Balanced", "Detailed"],
		icon: <IconMoodHappy />
	},
	{
		id: "communication-style",
		sentientComment:
			"This is really helpful! Let's set the right tone for our chats.",
		question: "How should I communicate with you?",
		type: "single-choice",
		required: true,
		options: [
			"Casual & Friendly",
			"Professional & Formal",
			"Concise & To-the-point",
			"Enthusiastic & Witty"
		],
		icon: <IconMoodHappy />
	},
	{
		id: "core-priorities",
		sentientComment:
			"Last one! To help me focus on what's truly important to you...",
		question: "What are your top 3 priorities right now?",
		type: "multi-choice",
		limit: 3,
		options: [
			"Career Growth",
			"Health & Wellness",
			"Family & Relationships",
			"Learning & Personal Growth",
			"Financial Stability",
			"Hobbies & Leisure"
		],
		icon: <IconListCheck />
	}
]

// --- Main Component ---

const OnboardingPage = () => {
	const [stage, setStage] = useState("intro") // 'intro', 'questions', 'submitting', 'whatsNext', 'complete'
	const [answers, setAnswers] = useState({})
	const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
	const [isLoading, setIsLoading] = useState(true)
	const [isInputVisible, setIsInputVisible] = useState(false) // prettier-ignore
	const [fullyTyped, setFullyTyped] = useState({})
	const posthog = usePostHog()
	const router = useRouter()

	const [locationState, setLocationState] = useState({
		loading: false,
		data: null,
		error: null
	})

	const handleTypingComplete = useCallback(() => {
		setIsInputVisible(true)
	}, [])

	const handleAnswer = (questionId, answer) => {
		setAnswers((prev) => ({ ...prev, [questionId]: answer }))
		// Auto-advance for single-choice questions to improve flow
		const currentQuestion = questions[currentQuestionIndex]
		if (currentQuestion.type === "single-choice") {
			// Use a small timeout to let the user see their selection
			setTimeout(() => {
				if (currentQuestionIndex < questions.length - 1) {
					handleNext()
				} else {
					handleSubmit()
				}
			}, 400)
		}
	}

	const handleMultiChoice = (questionId, option) => {
		const currentAnswers = answers[questionId] || []
		const limit = questions.find((q) => q.id === questionId)?.limit || 1
		let newAnswers
		if (currentAnswers.includes(option)) {
			newAnswers = currentAnswers.filter((item) => item !== option)
		} else {
			if (currentAnswers.length < limit) {
				newAnswers = [...currentAnswers, option]
			} else {
				toast.error(`You can select up to ${limit} options.`)
				newAnswers = currentAnswers
			}
		}
		setAnswers((prev) => ({ ...prev, [questionId]: newAnswers }))
	}

	const handleGetLocation = () => {
		if (navigator.geolocation) {
			setLocationState({ loading: true, data: null, error: null })
			navigator.geolocation.getCurrentPosition(
				(position) => {
					const { latitude, longitude } = position.coords
					const locationData = { latitude, longitude }
					setLocationState({
						loading: false,
						data: locationData,
						error: null
					})
					handleAnswer("location", locationData)
				},
				(error) => {
					setLocationState({
						loading: false,
						data: null,
						error: error.message
					})
					toast.error(`Could not get location: ${error.message}`)
				}
			)
		}
	}

	const isCurrentQuestionAnswered = useCallback(() => {
		if (stage !== "questions") return false
		const currentQuestion = questions[currentQuestionIndex]
		if (!currentQuestion.required) return true
		const answer = answers[currentQuestion.id]
		if (answer === undefined || answer === null || answer === "")
			return false
		if (Array.isArray(answer) && answer.length === 0) return false
		return true
	}, [answers, currentQuestionIndex, stage])

	const handleSubmit = async () => {
		setStage("submitting")
		const whatsappNumber = answers["whatsapp_number"]
		const mainOnboardingData = { ...answers }
		delete mainOnboardingData["whatsapp_number"]

		try {
			const response = await fetch("/api/onboarding", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ data: mainOnboardingData })
			})
			if (!response.ok) {
				const result = await response.json()
				throw new Error(
					result.message || "Failed to save onboarding data"
				)
			}
			if (whatsappNumber && whatsappNumber.trim()) {
				await fetch("/api/settings/whatsapp", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ whatsapp_number: whatsappNumber })
				})
			}
			posthog?.capture("onboarding_completed")
			setStage("whatsNext") // Go to the new "What's Next" screen
			// setTimeout(() => router.push("/home"), 2500) // Removed auto-redirect
		} catch (error) {
			toast.error(`Error: ${error.message}`)
			setStage("questions") // Go back to questions on error
		}
	}

	const handleNext = useCallback(() => {
		if (!isCurrentQuestionAnswered()) return
		if (currentQuestionIndex < questions.length - 1) {
			setFullyTyped((prev) => ({
				...prev,
				[currentQuestionIndex]: true
			}))
			setIsInputVisible(false)
			setCurrentQuestionIndex((prev) => prev + 1)
		} else {
			handleSubmit()
		}
	}, [currentQuestionIndex, answers, isCurrentQuestionAnswered, handleSubmit])

	const handleBack = useCallback(() => {
		if (currentQuestionIndex > 0) {
			setIsInputVisible(true) // Show input immediately when going back
			setCurrentQuestionIndex((prev) => prev - 1)
		}
	}, [currentQuestionIndex])

	// --- Effects ---

	useEffect(() => {
		const checkStatus = async () => {
			try {
				const response = await fetch("/api/user/data")
				if (!response.ok) throw new Error("Could not fetch user data.")
				const result = await response.json()
				if (result?.data?.onboardingComplete) {
					router.push("/home")
				} else {
					setIsLoading(false)
				}
			} catch (error) {
				toast.error(error.message)
				setIsLoading(false)
			}
		}
		checkStatus()
	}, [router])

	useEffect(() => {
		try {
			const userTimezone =
				Intl.DateTimeFormat().resolvedOptions().timeZone
			if (userTimezone) handleAnswer("timezone", userTimezone)
		} catch (e) {
			console.warn("Could not detect user timezone.")
		}
	}, [])

	useEffect(() => {
		const handleKeyDown = (e) => {
			if (stage === "intro" && e.key === "Enter") {
				e.preventDefault()
				setStage("questions")
			} else if (stage === "questions") {
				if (e.key === "ArrowLeft") handleBack()
				else if (e.key === "Enter") {
					const currentQuestion = questions[currentQuestionIndex]
					if (currentQuestion.type === "textarea" && e.shiftKey) {
						return
					}
					e.preventDefault()
					handleNext()
				}
			}
		}

		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [stage, handleBack, handleNext, currentQuestionIndex])

	// --- Render Logic ---

	if (isLoading) {
		return (
			<div className="flex flex-col items-center justify-center min-h-screen bg-black">
				<IconLoader className="w-10 h-10 animate-spin text-[var(--color-accent-blue)]" />
			</div>
		)
	}

	const renderContent = () => {
		const introVariants = {
			hidden: { opacity: 0 },
			visible: {
				opacity: 1,
				transition: {
					staggerChildren: 0.3
				}
			}
		}

		const itemVariants = {
			hidden: { y: 20, opacity: 0 },
			visible: {
				y: 0,
				opacity: 1,
				transition: { type: "spring", stiffness: 100 }
			}
		}

		switch (stage) {
			case "intro":
				return (
					<motion.div
						key="intro"
						variants={introVariants}
						initial="hidden"
						animate="visible"
						exit={{ opacity: 0, y: -20 }}
						className="text-center flex flex-col items-center"
					>
						<motion.div variants={itemVariants} className="mb-8">
							<IconSparkles
								size={80}
								className="mx-auto text-[var(--color-accent-blue)] drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]"
							/>
						</motion.div>
						<motion.h1
							variants={itemVariants}
							className="text-5xl md:text-6xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-b from-neutral-50 to-neutral-400"
						>
							Welcome. I'm Sentient.
						</motion.h1>
						<motion.p
							variants={itemVariants}
							className="text-xl text-neutral-300 max-w-xl mx-auto"
						>
							Your proactive AI, ready to get to know you.
						</motion.p>
						<motion.div variants={itemVariants}>
							<BlinkingInstructions text="Press Enter to begin" />
						</motion.div>
					</motion.div>
				)

			case "questions":
				const currentQuestion = questions[currentQuestionIndex]
				const isRevisiting = !!fullyTyped[currentQuestionIndex]
				let sentientComment = currentQuestion.sentientComment || ""
				if (sentientComment.includes("{user-name}")) {
					sentientComment = sentientComment.replace(
						"{user-name}",
						answers["user-name"] || "friend"
					)
				}
				return (
					<motion.div
						key="questions"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="w-full"
					>
						<AnimatePresence mode="wait">
							<motion.div
								key={currentQuestionIndex}
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								exit={{ opacity: 0, y: -20 }}
								transition={{
									duration: 0.4,
									ease: "easeInOut"
								}}
								className="w-full max-w-3xl mx-auto flex flex-col items-center"
							>
								<div className="w-full flex gap-4 mb-8 items-start">
									<div className="w-12 h-12 flex-shrink-0 bg-neutral-800 rounded-full flex items-center justify-center border-2 border-neutral-700">
										<IconSparkles className="text-[var(--color-accent-blue)]" />
									</div>
									<div className="bg-neutral-800 p-4 rounded-xl rounded-tl-none min-h-[60px] w-full">
										<div className="text-lg text-neutral-300">
											{isRevisiting ? (
												<p>{sentientComment}</p>
											) : (
												<Typewriter
													onInit={(typewriter) => {
														typewriter
															.typeString(
																sentientComment
															)
															.callFunction(
																() => {
																	handleTypingComplete()
																}
															)
															.start()
													}}
													options={{
														delay: 30,
														cursor: ""
													}}
												/>
											)}
										</div>
									</div>
								</div>

								<AnimatePresence>
									{isInputVisible && (
										<motion.div
											initial={{ opacity: 0, y: 20 }}
											animate={{ opacity: 1, y: 0 }}
											exit={{ opacity: 0 }}
											transition={{
												duration: 0.5,
												delay: 0.2
											}}
											className="bg-neutral-800/50 border border-neutral-700 p-8 rounded-2xl w-full"
										>
											<label className="block text-2xl font-semibold mb-3 flex items-center gap-4 text-neutral-100">
												<span className="text-neutral-500">
													{currentQuestion.icon}
												</span>
												{currentQuestion.question}
											</label>
											{currentQuestion.description && (
												<p className="text-base text-neutral-400 mb-6 ml-12">
													{
														currentQuestion.description
													}
												</p>
											)}
											<div className="mt-4 ml-12">
												{(() => {
													switch (
														currentQuestion.type
													) {
														case "text-input":
															return (
																<input
																	type="text"
																	value={
																		answers[
																			currentQuestion
																				.id
																		] || ""
																	}
																	onChange={(
																		e
																	) =>
																		handleAnswer(
																			currentQuestion.id,
																			e
																				.target
																				.value
																		)
																	}
																	className="w-full py-3 px-4 text-lg rounded-xl bg-neutral-900 text-white border border-neutral-600 focus:ring-2 focus:ring-[var(--color-accent-blue)]/50 placeholder:text-neutral-500 transition-all"
																	placeholder={
																		currentQuestion.placeholder
																	}
																	required={
																		currentQuestion.required
																	}
																	autoFocus
																/>
															)
														case "select":
															return (
																<select
																	value={
																		answers[
																			currentQuestion
																				.id
																		] || ""
																	}
																	onChange={(
																		e
																	) =>
																		handleAnswer(
																			currentQuestion.id,
																			e
																				.target
																				.value
																		)
																	}
																	className="w-full px-4 py-3 text-lg rounded-xl bg-neutral-900 text-white border border-neutral-600 focus:ring-2 focus:ring-[var(--color-accent-blue)]/50 appearance-none"
																	required={
																		currentQuestion.required
																	}
																>
																	{currentQuestion.options.map(
																		(
																			option
																		) => (
																			<option
																				key={
																					option.value
																				}
																				value={
																					option.value
																				}
																				disabled={
																					option.disabled
																				}
																				className="text-black bg-white"
																			>
																				{
																					option.label
																				}
																			</option>
																		)
																	)}
																</select>
															)
														case "textarea":
															return (
																<textarea
																	value={
																		answers[
																			currentQuestion
																				.id
																		] || ""
																	}
																	onChange={(
																		e
																	) =>
																		handleAnswer(
																			currentQuestion.id,
																			e
																				.target
																				.value
																		)
																	}
																	className="w-full px-4 py-3 text-lg rounded-xl bg-neutral-900 text-white border border-neutral-600 focus:ring-2 focus:ring-[var(--color-accent-blue)]/50 placeholder:text-neutral-500 min-h-[140px] resize-y"
																	placeholder={
																		currentQuestion.placeholder
																	}
																	autoFocus
																/>
															)
														case "location":
															return (
																<div className="space-y-4">
																	<input
																		type="text"
																		placeholder="Or enter Locality, City, State..."
																		value={
																			typeof answers[
																				currentQuestion
																					.id
																			] ===
																			"string"
																				? answers[
																						currentQuestion
																							.id
																					]
																				: ""
																		}
																		onChange={(
																			e
																		) =>
																			handleAnswer(
																				"location",
																				e
																					.target
																					.value
																			)
																		}
																		className="w-full py-3 px-4 text-lg rounded-xl bg-neutral-900 text-white border border-neutral-600 focus:ring-2 focus:ring-[var(--color-accent-blue)]/50 placeholder:text-neutral-500 transition-all"
																	/>
																	<div className="flex items-center gap-4">
																		<hr className="flex-grow border-neutral-700" />
																		<span className="text-neutral-500 text-sm">
																			OR
																		</span>
																		<hr className="flex-grow border-neutral-700" />
																	</div>
																	<button
																		type="button"
																		onClick={
																			handleGetLocation
																		}
																		disabled={
																			locationState.loading
																		}
																		className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl bg-neutral-700 text-white hover:bg-neutral-600 transition-colors disabled:opacity-50"
																	>
																		{locationState.loading ? (
																			<IconLoader
																				className="animate-spin"
																				size={
																					20
																				}
																			/>
																		) : (
																			<IconMapPin
																				size={
																					20
																				}
																			/>
																		)}
																		<span>
																			Share
																			Current
																			Location
																		</span>
																	</button>
																	{locationState.data &&
																		!locationState.loading && (
																			<div className="flex items-center justify-center gap-2 text-[var(--color-accent-green)] text-sm">
																				<IconMapPinFilled
																					size={
																						16
																					}
																				/>
																				<span>
																					Location
																					captured!
																				</span>
																			</div>
																		)}
																</div>
															)
														case "single-choice":
															return (
																<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
																	{currentQuestion.options.map(
																		(
																			option
																		) => {
																			const optionValue =
																				typeof option ===
																				"object"
																					? option.value
																					: option
																			const optionLabel =
																				typeof option ===
																				"object"
																					? option.label
																					: option

																			return (
																				<button
																					type="button"
																					key={
																						optionValue
																					}
																					onClick={() =>
																						handleAnswer(
																							currentQuestion.id,
																							option
																						)
																					}
																					className={cn(
																						"p-5 rounded-xl border-2 text-center font-semibold transition-all duration-200 text-lg",
																						answers[
																							currentQuestion
																								.id
																						] ===
																							optionValue
																							? "bg-[var(--color-accent-blue)] border-[var(--color-accent-blue)] text-white"
																							: "bg-transparent border-neutral-600 hover:border-blue-500/50"
																					)}
																				>
																					{
																						optionLabel
																					}
																				</button>
																			)
																		}
																	)}
																</div>
															)
														case "multi-choice":
															return (
																<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
																	{currentQuestion.options.map(
																		(
																			option
																		) => (
																			<button
																				type="button"
																				key={
																					option
																				}
																				onClick={() =>
																					handleMultiChoice(
																						currentQuestion.id,
																						option
																					)
																				}
																				className={cn(
																					"p-5 rounded-xl border-2 text-center font-semibold transition-all duration-200 flex items-center justify-center gap-2 text-lg",
																					(
																						answers[
																							currentQuestion
																								.id
																						] ||
																						[]
																					).includes(
																						option
																					)
																						? "bg-[var(--color-accent-blue)] border-[var(--color-accent-blue)] text-white"
																						: "bg-transparent border-neutral-600 hover:border-blue-500/50"
																				)}
																			>
																				{(
																					answers[
																						currentQuestion
																							.id
																					] ||
																					[]
																				).includes(
																					option
																				) && (
																					<IconCheck
																						size={
																							20
																						}
																					/>
																				)}
																				{
																					option
																				}
																			</button>
																		)
																	)}
																</div>
															)
														default:
															return null
													}
												})()}
											</div>
										</motion.div>
									)}
								</AnimatePresence>
								{isInputVisible && (
									<BlinkingInstructions
										text={
											currentQuestion.type === "textarea"
												? "Press Shift + Enter for a new line"
												: "Press Enter to continue • ← to go back"
										}
									/>
								)}
							</motion.div>
						</AnimatePresence>
					</motion.div>
				)

			case "submitting":
				return (
					<motion.div
						key="submitting"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="text-center"
					>
						<IconLoader className="w-16 h-16 animate-spin text-[var(--color-accent-blue)] mx-auto mb-6" />
						<h1 className="text-3xl font-bold">
							Personalizing your experience...
						</h1>
					</motion.div>
				)

			case "whatsNext":
				const nextStepCards = [
					{
						icon: (
							<IconPlugConnected
								size={32}
								className="text-blue-400"
							/>
						),
						title: "Connect Your Apps",
						description:
							"Unlock Sentient's full power by connecting to Gmail, Calendar, and more.",
						buttonText: "Go to Integrations",
						onClick: () => router.push("/integrations")
					},
					{
						icon: (
							<IconSparkles
								size={32}
								className="text-yellow-400"
							/>
						),
						title: "Explore What's Possible",
						description:
							"See examples of what you can automate and achieve with your new AI.",
						buttonText: "See Use Cases",
						onClick: () => router.push("/home")
					}
				]
				return (
					<motion.div
						key="whatsNext"
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						className="text-center max-w-4xl"
					>
						<h1 className="text-5xl font-bold mb-4">
							You're All Set, {answers["user-name"] || "Friend"}!
						</h1>
						<p className="text-xl text-neutral-400 mb-12">
							Here are a few things you can do to get started.
						</p>
						<div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
							{nextStepCards.map((card, i) => (
								<motion.div
									key={card.title}
									initial={{ opacity: 0, y: 20 }}
									animate={{
										opacity: 1,
										y: 0,
										transition: { delay: 0.2 + i * 0.15 }
									}}
									className="bg-neutral-800/50 border border-neutral-700 p-6 rounded-2xl flex flex-col items-center text-center"
								>
									<div className="mb-4">{card.icon}</div>
									<h3 className="text-xl font-semibold mb-2">
										{card.title}
									</h3>
									<p className="text-neutral-400 text-sm flex-grow mb-6">
										{card.description}
									</p>
									<button
										onClick={card.onClick}
										className="mt-auto w-full py-2.5 px-4 rounded-lg bg-neutral-700 hover:bg-[var(--color-accent-blue)] text-white font-medium transition-colors flex items-center justify-center gap-2"
									>
										{card.buttonText}{" "}
										<IconArrowRight size={16} />
									</button>
								</motion.div>
							))}
						</div>
						<button
							onClick={() => router.push("/home")}
							className="text-neutral-400 hover:text-white underline"
						>
							Or, just take me to the app
						</button>
					</motion.div>
				)

			case "complete":
				return (
					<motion.div
						key="complete"
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						className="text-center"
					>
						<CheckFilled className="w-24 h-24 text-[var(--color-accent-green)] mx-auto mb-6" />
						<h1 className="text-5xl font-bold mb-4">
							All Set, {answers["user-name"] || "Friend"}!
						</h1>
						<p className="text-xl text-neutral-400">
							Your personal AI companion is ready.
						</p>
						<p className="text-lg text-neutral-500 mt-4">
							Redirecting you to home...
						</p>
					</motion.div>
				)

			default:
				return null
		}
	}

	return (
		<div className="relative flex flex-col items-center justify-center min-h-screen w-full bg-black text-white p-4 overflow-hidden">
			{/* Lamp Glow Effect */}
			<div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-screen-lg h-[300px] bg-[var(--color-accent-blue)]/10 rounded-full blur-3xl pointer-events-none" />

			<AnimatePresence mode="wait">{renderContent()}</AnimatePresence>
		</div>
	)
}

export default OnboardingPage
