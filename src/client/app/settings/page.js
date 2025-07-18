"use client"

import toast from "react-hot-toast"
import {
	IconLoader,
	IconDeviceLaptop,
	IconWorld,
	IconPalette,
	IconUser,
	IconClock,
	IconHeart,
	IconBriefcase,
	IconMoodHappy,
	IconListCheck,
	IconMapPin,
	IconChevronDown,
	IconX,
	IconFlask,
	IconPlus,
	IconMessageChatbot,
	IconBrandWhatsapp,
	IconBrandLinkedin,
	IconHelpCircle
} from "@tabler/icons-react"
import { useState, useEffect, useCallback } from "react"
import { Tooltip } from "react-tooltip"
import { cn } from "@utils/cn"

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

const questionSections = {
	essentials: {
		title: "The Essentials",
		icon: <IconDeviceLaptop />
	},
	context: {
		title: "About You",
		icon: <IconWorld />
	},
	personality: {
		title: "AI Personality",
		icon: <IconPalette />
	}
}

const questions = [
	{
		id: "user-name",
		question: "What should I call you?",
		type: "text-input",
		required: true,
		placeholder: "e.g., Alex",
		section: "essentials",
		icon: <IconUser />
	},
	{
		id: "timezone",
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
		section: "essentials",
		icon: <IconClock />
	},
	{
		id: "location",
		question: "Where are you located?",
		type: "location",
		section: "context",
		icon: <IconMapPin />
	},
	{
		id: "professional-context",
		question: "What's your professional world like?",
		type: "textarea",
		placeholder:
			"e.g., I'm a software developer at a startup, aiming to become a team lead...",
		section: "context",
		icon: <IconBriefcase />
	},
	{
		id: "personal-context",
		question: "What about your personal life and hobbies?",
		type: "textarea",
		placeholder:
			"e.g., I enjoy hiking on weekends, I'm learning to play the guitar...",
		section: "context",
		icon: <IconHeart />
	},
	{
		id: "communication-style",
		question: "How would you like me to communicate with you?",
		type: "single-choice",
		required: true,
		options: [
			"Casual & Friendly",
			"Professional & Formal",
			"Concise & To-the-point",
			"Enthusiastic & Witty"
		],
		section: "personality",
		icon: <IconMoodHappy />
	},
	{
		id: "core-priorities",
		question: "What are your top priorities? (Select up to 3)",
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
		section: "personality",
		icon: <IconListCheck />
	}
]

const WhatsAppSettings = () => {
	const [whatsappNumber, setWhatsappNumber] = useState("")
	const [isLoading, setIsLoading] = useState(true)
	const [isSaving, setIsSaving] = useState(false)

	const fetchWhatsAppNumber = useCallback(async () => {
		setIsLoading(true)
		try {
			const response = await fetch("/api/settings/whatsapp")
			if (!response.ok)
				throw new Error("Failed to fetch WhatsApp number.")
			const data = await response.json()
			setWhatsappNumber(data.whatsapp_number || "")
		} catch (error) {
			toast.error(error.message)
		} finally {
			setIsLoading(false)
		}
	}, [])

	useEffect(() => {
		fetchWhatsAppNumber()
	}, [fetchWhatsAppNumber])

	const handleSave = async () => {
		setIsSaving(true)
		try {
			const response = await fetch("/api/settings/whatsapp", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ whatsapp_number: whatsappNumber })
			})
			const data = await response.json()
			if (!response.ok) {
				throw new Error(data.error || "Failed to save number.")
			}
			toast.success("WhatsApp number saved successfully!")
		} catch (error) {
			toast.error(error.message)
		} finally {
			setIsSaving(false)
		}
	}

	const handleRemove = async () => {
		setIsSaving(true)
		try {
			const response = await fetch("/api/settings/whatsapp", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ whatsapp_number: "" }) // Send empty string to remove
			})
			if (!response.ok) throw new Error("Failed to remove number.")
			setWhatsappNumber("")
			toast.success("WhatsApp notifications disabled.")
		} catch (error) {
			toast.error(error.message)
		} finally {
			setIsSaving(false)
		}
	}

	return (
		<section>
			<h2 className="text-xl font-semibold mb-5 text-gray-300 border-b border-[var(--color-primary-surface-elevated)] pb-2">
				WhatsApp Notifications
			</h2>
			<div className="bg-[var(--color-primary-surface)]/50 p-4 md:p-6 rounded-lg border border-[var(--color-primary-surface-elevated)]">
				<p className="text-gray-400 text-sm mb-4">
					Receive important notifications directly to your WhatsApp.
					Enter your number including the country code (e.g.,
					14155552671).
				</p>
				{isLoading ? (
					<div className="flex justify-center mt-4">
						<IconLoader className="w-6 h-6 animate-spin text-[var(--color-accent-blue)]" />
					</div>
				) : (
					<div className="flex flex-col sm:flex-row gap-2">
						<div className="relative flex-grow">
							<IconBrandWhatsapp
								className="absolute left-3 top-1/2 -translate-y-1/2 text-green-500"
								size={20}
							/>
							<input
								type="tel"
								value={whatsappNumber}
								onChange={(e) =>
									setWhatsappNumber(e.target.value)
								}
								placeholder="Enter WhatsApp Number"
								className="w-full pl-10 pr-4 bg-[var(--color-primary-surface-elevated)] border border-neutral-600 rounded-md py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-blue)]"
							/>
						</div>
						<div className="flex gap-2 justify-end">
							<button
								onClick={handleSave}
								disabled={isSaving}
								className="flex items-center py-2 px-4 rounded-md bg-[var(--color-accent-blue)] hover:bg-[var(--color-accent-blue-hover)] text-white font-medium transition-colors"
							>
								{isSaving ? (
									<IconLoader className="w-4 h-4 mr-2 animate-spin" />
								) : (
									<IconPlus className="w-4 h-4 mr-2" />
								)}
								Save
							</button>
							{whatsappNumber && (
								<button
									onClick={handleRemove}
									disabled={isSaving}
									className="flex items-center py-2 px-4 rounded-md bg-[var(--color-accent-red)]/80 hover:bg-[var(--color-accent-red)] text-white font-medium transition-colors"
								>
									<IconX className="w-4 h-4 mr-2" /> Remove
								</button>
							)}
						</div>
					</div>
				)}
			</div>
		</section>
	)
}

const LinkedInSettings = () => {
	const [linkedinUrl, setLinkedinUrl] = useState("")
	const [isLoading, setIsLoading] = useState(true)
	const [isSaving, setIsSaving] = useState(false)

	const fetchLinkedInUrl = useCallback(async () => {
		setIsLoading(true)
		try {
			const response = await fetch("/api/settings/linkedin")
			if (!response.ok) throw new Error("Failed to fetch LinkedIn URL.")
			const data = await response.json()
			setLinkedinUrl(data.linkedin_url || "")
		} catch (error) {
			toast.error(error.message)
		} finally {
			setIsLoading(false)
		}
	}, [])

	useEffect(() => {
		fetchLinkedInUrl()
	}, [fetchLinkedInUrl])

	const handleSave = async () => {
		setIsSaving(true)
		try {
			const response = await fetch("/api/settings/linkedin", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ linkedin_url: linkedinUrl })
			})
			const data = await response.json()
			if (!response.ok) {
				throw new Error(data.error || "Failed to save LinkedIn URL.")
			}
			toast.success(data.message || "LinkedIn URL saved successfully!")
		} catch (error) {
			toast.error(error.message)
		} finally {
			setIsSaving(false)
		}
	}

	const handleRemove = async () => {
		setIsSaving(true)
		try {
			const response = await fetch("/api/settings/linkedin", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ linkedin_url: "" }) // Send empty string to remove
			})
			if (!response.ok) throw new Error("Failed to remove URL.")
			setLinkedinUrl("")
			toast.success("LinkedIn URL removed.")
		} catch (error) {
			toast.error(error.message)
		} finally {
			setIsSaving(false)
		}
	}

	const hasUrl = linkedinUrl && linkedinUrl.trim() !== ""

	return (
		<section>
			<h2 className="text-xl font-semibold mb-5 text-gray-300 border-b border-[var(--color-primary-surface-elevated)] pb-2">
				LinkedIn Profile
			</h2>
			<div className="bg-[var(--color-primary-surface)]/50 p-4 md:p-6 rounded-lg border border-[var(--color-primary-surface-elevated)]">
				<p className="text-gray-400 text-sm mb-4">
					Connect your LinkedIn profile to help Sentient understand
					your professional background. This will be used to enrich
					your personal memory.
				</p>
				{isLoading ? (
					<div className="flex justify-center mt-4">
						<IconLoader className="w-6 h-6 animate-spin text-[var(--color-accent-blue)]" />
					</div>
				) : (
					<div className="flex flex-col sm:flex-row gap-2">
						<div className="relative flex-grow">
							<IconBrandLinkedin
								className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400"
								size={20}
							/>
							<input
								type="url"
								value={linkedinUrl}
								onChange={(e) => setLinkedinUrl(e.target.value)}
								placeholder="https://www.linkedin.com/in/your-profile"
								className="w-full pl-10 pr-4 bg-[var(--color-primary-surface-elevated)] border border-neutral-600 rounded-md py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-blue)]"
							/>
						</div>
						<div className="flex gap-2 justify-end">
							<button
								onClick={handleSave}
								disabled={isSaving}
								className="flex items-center py-2 px-4 rounded-md bg-[var(--color-accent-blue)] hover:bg-[var(--color-accent-blue-hover)] text-white font-medium transition-colors"
							>
								{isSaving ? (
									<IconLoader className="w-4 h-4 mr-2 animate-spin" />
								) : (
									<IconPlus className="w-4 h-4 mr-2" />
								)}
								{hasUrl ? "Update" : "Save"}
							</button>
							{hasUrl && (
								<button
									onClick={handleRemove}
									disabled={isSaving}
									className="flex items-center py-2 px-4 rounded-md bg-[var(--color-accent-red)]/80 hover:bg-[var(--color-accent-red)] text-white font-medium transition-colors"
								>
									<IconX className="w-4 h-4 mr-2" /> Remove
								</button>
							)}
						</div>
					</div>
				)}
			</div>
		</section>
	)
}

const TestingTools = () => {
	const [serviceName, setServiceName] = useState("gmail")
	const [eventData, setEventData] = useState(
		'{\n  "subject": "Project Alpha Kick-off",\n  "body": "Hi team, let\'s schedule a meeting for next Tuesday to discuss the Project Alpha kick-off. John, please prepare the presentation."\n}'
	)
	const [isSubmitting, setIsSubmitting] = useState(false)

	const handleSubmit = async (e) => {
		e.preventDefault()
		setIsSubmitting(true)
		let parsedData
		try {
			parsedData = JSON.parse(eventData)
		} catch (error) {
			toast.error("Invalid JSON in event data.")
			setIsSubmitting(false)
			return
		}

		try {
			const response = await fetch("/api/testing/inject-context", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					service_name: serviceName,
					event_data: parsedData
				})
			})
			const result = await response.json()
			if (!response.ok) {
				throw new Error(result.error || "Failed to inject event.")
			}
			toast.success(
				`Event injected successfully! Event ID: ${result.event_id}`
			)
		} catch (error) {
			toast.error(error.message)
		} finally {
			setIsSubmitting(false)
		}
	}

	const handleServiceChange = (e) => {
		const newService = e.target.value
		setServiceName(newService)
		if (newService === "gmail") {
			setEventData(
				'{\n  "subject": "Project Alpha Kick-off",\n  "body": "Hi team, let\'s schedule a meeting for next Tuesday to discuss the Project Alpha kick-off. John, please prepare the presentation."\n}'
			)
		} else if (newService === "gcalendar") {
			setEventData(
				'{\n  "summary": "Finalize Q3 report",\n  "description": "Need to finalize the Q3 sales report with Sarah before the end of the week."\n}'
			)
		}
	}

	const [whatsAppNumber, setWhatsAppNumber] = useState("")
	const [isVerifying, setIsVerifying] = useState(false)
	const [isSending, setIsSending] = useState(false)
	const [verificationResult, setVerificationResult] = useState({
		status: null,
		message: ""
	})

	const handleVerifyWhatsApp = async () => {
		if (!whatsAppNumber) {
			toast.error("Please enter a phone number to verify.")
			return
		}
		setIsVerifying(true)
		setVerificationResult({ status: null, message: "Verifying..." })
		try {
			const response = await fetch("/api/testing/whatsapp/verify", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ phone_number: whatsAppNumber })
			})
			const result = await response.json()
			if (!response.ok) {
				throw new Error(result.detail || "Verification request failed.")
			}

			if (result.numberExists) {
				toast.success("Verification successful!")
				setVerificationResult({
					status: "success",
					message: `Number is valid. Chat ID: ${result.chatId}`
				})
			} else {
				toast.error("Number not found on WhatsApp.")
				setVerificationResult({
					status: "failure",
					message:
						"This phone number does not appear to be registered on WhatsApp."
				})
			}
		} catch (error) {
			toast.error(error.message)
			setVerificationResult({ status: "failure", message: error.message })
		} finally {
			setIsVerifying(false)
		}
	}

	const handleSendTestWhatsApp = async () => {
		if (!whatsAppNumber) {
			toast.error("Please enter a phone number to send a message to.")
			return
		}
		setIsSending(true)
		try {
			const response = await fetch("/api/testing/whatsapp", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ phone_number: whatsAppNumber })
			})
			const result = await response.json()
			if (!response.ok) {
				throw new Error(
					result.detail || "Failed to send test notification."
				)
			}
			toast.success("Test notification sent successfully!")
		} catch (error) {
			toast.error(`Send failed: ${error.message}`)
		} finally {
			setIsSending(false)
		}
	}

	return (
		<section>
			<h2 className="text-xl font-semibold mb-5 text-gray-300 border-b border-[var(--color-primary-surface-elevated)] pb-2 flex items-center gap-2">
				<IconFlask />
				Developer Tools
			</h2>
			<div className="bg-[var(--color-primary-surface)]/50 p-4 md:p-6 rounded-lg border border-[var(--color-primary-surface-elevated)]">
				<h3 className="font-semibold text-lg text-white mb-2">
					Inject Context Event
				</h3>
				<p className="text-gray-400 text-sm mb-4">
					Simulate a polling event by manually injecting context data
					into the processing pipeline. This is useful for testing the
					extractor and planner workers.
				</p>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<label
							htmlFor="serviceName"
							className="block text-sm font-medium text-gray-300 mb-1"
						>
							Service
						</label>
						<select
							id="serviceName"
							value={serviceName}
							onChange={handleServiceChange}
							className="w-full bg-[var(--color-primary-surface-elevated)] border border-neutral-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-blue)]"
						>
							<option value="gmail">Gmail</option>
							<option value="gcalendar">Google Calendar</option>
						</select>
					</div>
					<div>
						<label
							htmlFor="eventData"
							className="block text-sm font-medium text-gray-300 mb-1"
						>
							Event Data (JSON)
						</label>
						<textarea
							id="eventData"
							value={eventData}
							onChange={(e) => setEventData(e.target.value)}
							rows={8}
							className="w-full font-mono text-xs bg-[var(--color-primary-surface-elevated)] border border-neutral-600 rounded-md px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-blue)]"
							placeholder='e.g., { "subject": "Hello", "body": "World" }'
						/>
					</div>
					<div className="flex justify-end">
						<button
							type="submit"
							disabled={isSubmitting}
							className="flex items-center py-2 px-4 rounded-md bg-[var(--color-accent-blue)] hover:bg-[var(--color-accent-blue-hover)] text-white font-medium transition-colors disabled:opacity-50"
						>
							{isSubmitting ? (
								<IconLoader className="w-5 h-5 animate-spin" />
							) : (
								"Inject Event"
							)}
						</button>
					</div>
				</form>
			</div>
			{/* WhatsApp Test Tools */}
			<div className="bg-[var(--color-primary-surface)]/50 p-4 md:p-6 rounded-lg border border-[var(--color-primary-surface-elevated)] mt-6">
				<h3 className="font-semibold text-lg text-white mb-2">
					Test WhatsApp Integration
				</h3>
				<p className="text-gray-400 text-sm mb-4">
					Verify a phone number's existence on WhatsApp and then send
					a test message. The number must include the country code
					(e.g., +14155552671).
				</p>
				<div className="flex flex-col sm:flex-row gap-2">
					<div className="relative flex-grow">
						<IconBrandWhatsapp
							className="absolute left-3 top-1/2 -translate-y-1/2 text-green-500"
							size={20}
						/>
						<input
							type="tel"
							value={whatsAppNumber}
							onChange={(e) => {
								setWhatsAppNumber(e.target.value)
								setVerificationResult({
									status: null,
									message: ""
								}) // Reset on change
							}}
							placeholder="Enter WhatsApp Number with country code"
							className="w-full pl-10 pr-4 bg-[var(--color-primary-surface-elevated)] border border-neutral-600 rounded-md py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-blue)]"
						/>
					</div>
					<div className="flex gap-2 justify-end">
						<button
							onClick={handleVerifyWhatsApp}
							disabled={isVerifying || isSending}
							className="flex items-center justify-center py-2 px-4 rounded-md bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors disabled:opacity-50"
						>
							{isVerifying ? (
								<IconLoader className="w-5 h-5 animate-spin" />
							) : (
								"Verify"
							)}
						</button>
						<button
							onClick={handleSendTestWhatsApp}
							disabled={isSending || isVerifying}
							className="flex items-center justify-center py-2 px-4 rounded-md bg-[var(--color-accent-blue)] hover:bg-[var(--color-accent-blue-hover)] text-white font-medium transition-colors disabled:opacity-50"
						>
							{isSending ? (
								<IconLoader className="w-5 h-5 animate-spin" />
							) : (
								"Send Test"
							)}
						</button>
					</div>
				</div>
				{verificationResult.message && (
					<p
						className={cn(
							"text-sm mt-3",
							verificationResult.status === "success"
								? "text-green-400"
								: "text-red-400"
						)}
					>
						{verificationResult.message}
					</p>
				)}
			</div>
		</section>
	)
}

const AIPersonalitySettings = () => {
	const [settings, setSettings] = useState({
		agentName: "Sentient",
		responseVerbosity: "Balanced",
		humorLevel: "Balanced",
		useEmojis: true,
		quietHours: { enabled: false, start: "22:00", end: "08:00" },
		notificationControls: {
			taskNeedsApproval: true,
			taskCompleted: true,
			taskFailed: false,
			proactiveSummary: false,
			importantInsights: false
		}
	})
	const [isLoading, setIsLoading] = useState(true)
	const [isSaving, setIsSaving] = useState(false)
	const [isOpen, setIsOpen] = useState(true)

	const fetchSettings = useCallback(async () => {
		setIsLoading(true)
		try {
			const response = await fetch("/api/settings/ai-personality")
			if (!response.ok) throw new Error("Failed to fetch AI settings.")
			const data = await response.json()
			setSettings(data)
		} catch (error) {
			toast.error(error.message)
		} finally {
			setIsLoading(false)
		}
	}, [])

	useEffect(() => {
		fetchSettings()
	}, [fetchSettings])

	const handleSave = async () => {
		setIsSaving(true)
		try {
			const response = await fetch("/api/settings/ai-personality", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(settings)
			})
			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(errorData.error || "Failed to save settings.")
			}
			toast.success("AI settings updated successfully!")
		} catch (error) {
			toast.error(error.message)
		} finally {
			setIsSaving(false)
		}
	}

	const handleInputChange = (field, value) => {
		setSettings((prev) => ({ ...prev, [field]: value }))
	}

	const handleQuietHoursChange = (field, value) => {
		setSettings((prev) => ({
			...prev,
			quietHours: { ...prev.quietHours, [field]: value }
		}))
	}

	const handleNotificationChange = (field) => {
		setSettings((prev) => ({
			...prev,
			notificationControls: {
				...prev.notificationControls,
				[field]: !prev.notificationControls[field]
			}
		}))
	}

	if (isLoading) {
		return (
			<div className="flex justify-center items-center p-8">
				<IconLoader className="animate-spin" />
			</div>
		)
	}

	return (
		<section>
			<div className="flex justify-between items-center mb-5">
				<button
					onClick={() => setIsOpen(!isOpen)}
					className="w-full flex justify-between items-center py-2 text-left"
				>
					<h2 className="text-xl font-semibold text-gray-300 flex items-center gap-3">
						<IconMessageChatbot /> AI Behavior & Personality
					</h2>
					<IconChevronDown
						className={cn(
							"transition-transform duration-200",
							isOpen && "rotate-180"
						)}
					/>
				</button>
			</div>
			{isOpen && (
				<div className="space-y-6">
					{/* Persona Settings */}
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						<div>
							<label className="block text-sm font-medium text-gray-200 mb-2">
								Agent Name
							</label>
							<input
								type="text"
								value={settings.agentName}
								onChange={(e) =>
									handleInputChange(
										"agentName",
										e.target.value
									)
								}
								className="w-full bg-[var(--color-primary-surface-elevated)] border border-neutral-600 rounded-md px-3 py-2 text-white placeholder-gray-400"
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-200 mb-2">
								Response Verbosity
							</label>
							<select
								value={settings.responseVerbosity}
								onChange={(e) =>
									handleInputChange(
										"responseVerbosity",
										e.target.value
									)
								}
								className="w-full bg-[var(--color-primary-surface-elevated)] border border-neutral-600 rounded-md px-3 py-2 text-white"
							>
								<option value="Concise">Concise</option>
								<option value="Balanced">Balanced</option>
								<option value="Detailed">Detailed</option>
							</select>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-200 mb-2">
								Humor & Formality
							</label>
							<select
								value={settings.humorLevel}
								onChange={(e) =>
									handleInputChange(
										"humorLevel",
										e.target.value
									)
								}
								className="w-full bg-[var(--color-primary-surface-elevated)] border border-neutral-600 rounded-md px-3 py-2 text-white"
							>
								<option value="Strictly Formal">
									Strictly Formal
								</option>
								<option value="Balanced">Balanced</option>
								<option value="Witty & Humorous">
									Witty & Humorous
								</option>
							</select>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-200 mb-2">
								Emoji Usage
							</label>
							<div className="flex items-center gap-2 p-2 bg-[var(--color-primary-surface-elevated)] rounded-md">
								<input
									type="checkbox"
									id="emoji-toggle"
									checked={settings.useEmojis}
									onChange={(e) =>
										handleInputChange(
											"useEmojis",
											e.target.checked
										)
									}
									className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
								/>
								<label
									htmlFor="emoji-toggle"
									className="text-white"
								>
									Use emojis in conversations
								</label>
							</div>
						</div>
					</div>
					{/* Quiet Hours */}
					<div>
						<label className="block text-sm font-medium text-gray-200 mb-2">
							Quiet Hours (Do Not Disturb)
						</label>
						<div className="flex items-center gap-4 bg-[var(--color-primary-surface-elevated)] p-3 rounded-md">
							<input
								type="checkbox"
								id="quiet-hours-toggle"
								checked={settings.quietHours.enabled}
								onChange={(e) =>
									handleQuietHoursChange(
										"enabled",
										e.target.checked
									)
								}
								className="h-4 w-4 rounded border-gray-300"
							/>
							<label
								htmlFor="quiet-hours-toggle"
								className="text-white"
							>
								Enable Quiet Hours
							</label>
							{settings.quietHours.enabled && (
								<div className="flex items-center gap-2">
									<input
										type="time"
										value={settings.quietHours.start}
										onChange={(e) =>
											handleQuietHoursChange(
												"start",
												e.target.value
											)
										}
										className="bg-neutral-700 border border-neutral-600 rounded-md px-2 py-1 text-white"
									/>
									<span className="text-gray-400">to</span>
									<input
										type="time"
										value={settings.quietHours.end}
										onChange={(e) =>
											handleQuietHoursChange(
												"end",
												e.target.value
											)
										}
										className="bg-neutral-700 border border-neutral-600 rounded-md px-2 py-1 text-white"
									/>
								</div>
							)}
						</div>
					</div>
					{/* Notification Controls */}
					<div>
						<label className="block text-sm font-medium text-gray-200 mb-2">
							Granular Notification Controls
						</label>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 bg-[var(--color-primary-surface-elevated)] p-4 rounded-md">
							{Object.entries({
								taskNeedsApproval:
									"When a task needs my approval",
								taskCompleted:
									"When a task is completed successfully",
								taskFailed: "When a task fails",
								proactiveSummary: "Proactive daily summary",
								importantInsights:
									"Important insights found in my data"
							}).map(([key, label]) => (
								<div
									key={key}
									className="flex items-center gap-2"
								>
									<input
										type="checkbox"
										id={key}
										checked={
											settings.notificationControls[key]
										}
										onChange={() =>
											handleNotificationChange(key)
										}
										className="h-4 w-4 rounded border-gray-300"
									/>
									<label htmlFor={key} className="text-white">
										{label}
									</label>
								</div>
							))}
						</div>
					</div>
					{/* Save Button */}
					<div className="flex justify-end mt-6">
						<button
							onClick={handleSave}
							disabled={isSaving}
							className="py-2 px-6 rounded-md bg-[var(--color-accent-green)] hover:bg-[var(--color-accent-green-hover)] text-white font-medium transition-colors flex items-center"
						>
							{isSaving ? (
								<IconLoader className="w-5 h-5 animate-spin" />
							) : (
								"Save AI Settings"
							)}
						</button>
					</div>
				</div>
			)}
		</section>
	)
}

const ProfileSettings = ({ initialData, onSave, isSaving }) => {
	const [formData, setFormData] = useState(initialData || {})
	const [openSections, setOpenSections] = useState({
		essentials: true,
		context: true,
		personality: true
	})

	useEffect(() => {
		setFormData(initialData || {})
	}, [initialData])

	const handleAnswer = (questionId, answer) => {
		setFormData((prev) => ({ ...prev, [questionId]: answer }))
	}

	const handleMultiChoice = (questionId, option) => {
		const currentAnswers = formData[questionId] || []
		const limit = questions.find((q) => q.id === questionId)?.limit || 1
		const newAnswers = currentAnswers.includes(option)
			? currentAnswers.filter((item) => item !== option)
			: currentAnswers.length < limit
				? [...currentAnswers, option]
				: currentAnswers
		setFormData((prev) => ({ ...prev, [questionId]: newAnswers }))
	}

	return (
		<section>
			<div className="flex justify-between items-center">
				<h2 className="text-xl font-semibold text-gray-300 border-b border-[var(--color-primary-surface-elevated)] pb-2 flex-grow">
					About You
				</h2>
				<button
					onClick={() => onSave(formData)}
					disabled={isSaving}
					className="ml-4 py-2 px-4 rounded-md bg-[var(--color-accent-blue)] hover:bg-[var(--color-accent-blue-hover)] text-white font-medium transition-colors flex items-center"
				>
					{isSaving ? (
						<IconLoader className="w-5 h-5 animate-spin" />
					) : (
						"Save Profile"
					)}
				</button>
			</div>
			<p className="text-gray-400 text-sm mt-2 mb-6">
				This information helps me personalize my responses and actions
				for you.
			</p>

			<div className="space-y-8">
				{Object.entries(questionSections).map(
					([key, { title, icon }]) => (
						<div key={key}>
							<button
								onClick={() =>
									setOpenSections((p) => ({
										...p,
										[key]: !p[key]
									}))
								}
								className="w-full flex justify-between items-center py-2 text-left"
							>
								<h3 className="text-lg font-semibold text-gray-300 flex items-center gap-3">
									{icon}
									{title}
								</h3>
								<IconChevronDown
									className={cn(
										"transition-transform duration-200",
										openSections[key] && "rotate-180"
									)}
								/>
							</button>
							{openSections[key] && (
								<div className="space-y-6 mt-4 pl-8 border-l-2 border-[var(--color-primary-surface-elevated)]">
									{questions
										.filter((q) => q.section === key)
										.map((q) => (
											<div
												key={q.id}
												className="min-h-[68px]"
											>
												<label className="block text-sm font-medium text-gray-200 mb-2">
													{q.question}
												</label>
												{(() => {
													switch (q.type) {
														case "text-input":
															return (
																// eslint-disable-line
																<input
																	type="text"
																	value={
																		formData[
																			q.id
																		] || ""
																	}
																	onChange={(
																		e
																	) =>
																		handleAnswer(
																			q.id,
																			e
																				.target
																				.value
																		)
																	}
																	className="w-full bg-[var(--color-primary-surface-elevated)] border border-neutral-600 rounded-md px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-blue)]"
																	placeholder={
																		q.placeholder
																	}
																/>
															)
														case "textarea":
															return (
																// eslint-disable-line
																<textarea
																	value={
																		formData[
																			q.id
																		] || ""
																	}
																	onChange={(
																		e
																	) =>
																		handleAnswer(
																			q.id,
																			e
																				.target
																				.value
																		)
																	}
																	rows={3}
																	className="w-full bg-[var(--color-primary-surface-elevated)] border border-neutral-600 rounded-md px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-blue)]"
																	placeholder={
																		q.placeholder
																	}
																/>
															)
														case "select":
															return (
																// eslint-disable-line
																<select
																	value={
																		formData[
																			q.id
																		] || ""
																	}
																	onChange={(
																		e
																	) =>
																		handleAnswer(
																			q.id,
																			e
																				.target
																				.value
																		)
																	}
																	className="w-full bg-[var(--color-primary-surface-elevated)] border border-neutral-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-blue)]"
																>
																	{q.options.map(
																		(
																			opt
																		) => (
																			<option
																				key={
																					opt.value
																				}
																				value={
																					opt.value
																				}
																			>
																				{
																					opt.label
																				}
																			</option>
																		)
																	)}
																</select>
															)
														case "single-choice":
														case "multi-choice":
															return (
																<div className="flex flex-wrap gap-2">
																	{q.options.map(
																		(
																			opt
																		) => (
																			<button
																				key={
																					opt
																				}
																				onClick={() =>
																					q.type ===
																					"single-choice"
																						? handleAnswer(
																								q.id,
																								opt
																							)
																						: handleMultiChoice(
																								q.id,
																								opt
																							)
																				}
																				className={cn(
																					"px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-colors",
																					(
																						Array.isArray(
																							formData[
																								q
																									.id
																							]
																						)
																							? formData[
																									q
																										.id
																								].includes(
																									opt
																								)
																							: formData[
																									q
																										.id
																								] ===
																								opt
																					)
																						? "bg-[var(--color-accent-blue)] border-[var(--color-accent-blue)] text-white"
																						: "bg-transparent border-[var(--color-primary-surface-elevated)] text-gray-300 hover:border-[var(--color-accent-blue)]"
																				)}
																			>
																				{
																					opt
																				}
																			</button>
																		)
																	)}
																</div>
															)
														case "location": // Simplified for now
															const locationValue =
																formData[q.id]
															const isGpsLocation =
																typeof locationValue ===
																	"object" &&
																locationValue !==
																	null &&
																locationValue.latitude

															if (isGpsLocation) {
																return (
																	<div className="flex items-center gap-2">
																		<p className="w-full bg-[var(--color-primary-surface)] border border-neutral-700 rounded-md px-3 py-2 text-gray-300">
																			{`Lat: ${locationValue.latitude?.toFixed(
																				4
																			)}, Lon: ${locationValue.longitude?.toFixed(
																				4
																			)} (Detected)`}
																		</p>
																		<button
																			onClick={() =>
																				handleAnswer(
																					q.id,
																					""
																				)
																			}
																			className="p-2 text-gray-400 hover:text-white hover:bg-neutral-600 rounded-md"
																			title="Clear and enter manually"
																		>
																			<IconX
																				size={
																					18
																				}
																			/>
																		</button>
																	</div>
																)
															}
															return (
																<input
																	type="text"
																	value={
																		formData[
																			q.id
																		] || ""
																	}
																	onChange={(
																		e
																	) =>
																		handleAnswer(
																			q.id,
																			e
																				.target
																				.value
																		)
																	}
																	className="w-full bg-[var(--color-primary-surface-elevated)] border border-neutral-600 rounded-md px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-blue)]"
																	placeholder="City, Country"
																/>
															)
														default:
															return null
													}
												})()}
											</div>
										))}
								</div>
							)}
						</div>
					)
				)}
			</div>
		</section>
	)
}

const ProfilePage = () => {
	const [profileData, setProfileData] = useState(null)
	const [isSavingProfile, setIsSavingProfile] = useState(false)

	const handleSaveProfile = async (newOnboardingData) => {
		setIsSavingProfile(true)
		try {
			const payload = {
				onboardingAnswers: newOnboardingData,
				personalInfo: {
					name: newOnboardingData["user-name"],
					location: newOnboardingData["location"],
					timezone: newOnboardingData["timezone"]
				},
				preferences: {
					communicationStyle:
						newOnboardingData["communication-style"],
					corePriorities: newOnboardingData["core-priorities"]
				}
			}

			const response = await fetch("/api/settings/profile", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload)
			})

			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(errorData.error || "Failed to save profile")
			}
			toast.success("Profile updated successfully!")
			fetchData() // Refresh data to show changes
		} catch (error) {
			toast.error(`Error saving profile: ${error.message}`)
		} finally {
			setIsSavingProfile(false)
		}
	}

	const fetchData = useCallback(async () => {
		try {
			const [response, profileResponse] = await Promise.all([
				fetch("/api/user/data"),
				fetch("/api/user/profile")
			])
			if (!response.ok) {
				const errorData = await response.json()
				throw new Error(
					errorData.message || "Failed to fetch user data"
				)
			}
			if (!profileResponse.ok)
				throw new Error("Failed to fetch user profile")
			const result = await response.json()
			const profile = await profileResponse.json()
			if (result.data) {
				setProfileData({ ...profile, ...result.data })
			}
		} catch (error) {
			toast.error(`Failed to fetch user data: ${error.message}`)
		}
	}, [])

	useEffect(() => {
		fetchData()
	}, [fetchData])

	const ProfileHeader = () => (
		<div className="flex items-center gap-6 mb-10">
			<img
				src={profileData?.picture || "/images/half-logo-dark.svg"}
				alt="Profile"
				className="w-24 h-24 rounded-full border-4 border-[var(--color-primary-surface-elevated)] shadow-lg"
			/>
			<div>
				<h1 className="text-3xl lg:text-4xl font-semibold text-[var(--color-text-primary)]">
					{profileData?.personalInfo?.name || "Your Profile"}
				</h1>
				<p className="text-[var(--color-text-secondary)] mt-1">
					Manage your settings and how Sentient interacts with you.
				</p>
			</div>
		</div>
	)

	return (
		<div className="flex h-screen bg-[var(--color-primary-background)] text-[var(--color-text-primary)] overflow-x-hidden pl-0 md:pl-20">
			<Tooltip id="settings-tooltip" style={{ zIndex: 9999 }} />
			<Tooltip id="page-help-tooltip" style={{ zIndex: 9999 }} />
			<div className="flex-1 flex flex-col overflow-hidden relative">
				<main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-10 custom-scrollbar">
					<HelpTooltip content="Customize your experience here. Teach Sentient about yourself, change its personality, manage notifications, and connect your LinkedIn profile." />
					<div className="w-full max-w-5xl mx-auto space-y-10">
						<ProfileHeader />
						<ProfileSettings
							initialData={profileData?.onboardingAnswers}
							onSave={handleSaveProfile}
							isSaving={isSavingProfile}
						/>
						<AIPersonalitySettings />
						<WhatsAppSettings />
						<LinkedInSettings />
						{process.env.NEXT_PUBLIC_ENVIRONMENT !== "prod" && (
							<TestingTools />
						)}
					</div>
				</main>
			</div>
		</div>
	)
}

export default ProfilePage
