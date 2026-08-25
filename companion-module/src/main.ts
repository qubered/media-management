import { InstanceBase, InstanceStatus, type SomeCompanionConfigField } from '@companion-module/base'
import { UpdateActions, type ActionsSchema } from './actions.js'
import { LecternApi } from './api.js'
import { getBaseUrl, GetConfigFields, type ModuleConfig } from './config.js'
import { UpdateFeedbacks, type FeedbacksSchema } from './feedbacks.js'
import { DeviceHealthCache, LibraryStore, SendResultCache } from './state.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateLibraryVariables, UpdateVariableDefinitions, type VariablesSchema } from './variables.js'

export type ModuleSchema = {
	config: ModuleConfig
	secrets: undefined
	actions: ActionsSchema
	feedbacks: FeedbacksSchema
	variables: VariablesSchema
}

export { UpgradeScripts }

export default class ModuleInstance extends InstanceBase<ModuleSchema> {
	config!: ModuleConfig // Set in init()
	api!: LecternApi // Set in init()

	readonly library = new LibraryStore()
	readonly sendCache = new SendResultCache()
	readonly healthCache = new DeviceHealthCache()

	private pollTimer: ReturnType<typeof setInterval> | undefined

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: ModuleConfig): Promise<void> {
		this.config = config
		this.api = new LecternApi(() => getBaseUrl(this.config))

		this.updateVariableDefinitions()
		await this.refreshLibrary()
		this.startPolling()
	}

	async destroy(): Promise<void> {
		this.stopPolling()
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		this.config = config
		this.stopPolling()
		await this.refreshLibrary()
		this.startPolling()
	}

	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	private startPolling(): void {
		const seconds = Math.max(5, this.config.pollIntervalSeconds || 20)
		this.pollTimer = setInterval(() => {
			void this.refreshLibrary()
		}, seconds * 1000)
	}

	private stopPolling(): void {
		if (this.pollTimer) clearInterval(this.pollTimer)
		this.pollTimer = undefined
	}

	/**
	 * Re-fetches presets/lecterns/schedules from the server and rebuilds every action/feedback
	 * dropdown that lists them, so a rename or new preset on the server shows up here without
	 * anyone needing to know or copy an id. Called on init, on config change, on a timer, and
	 * from the "Refresh library" action for an immediate update after a known server-side change.
	 */
	async refreshLibrary(): Promise<void> {
		if (!this.config.host) {
			this.updateStatus(InstanceStatus.BadConfig, 'Set the Lectern server host in the module config')
			this.setVariableValues({ connection_status: 'not configured' })
		} else {
			try {
				await this.library.refresh(this.api)
				this.updateStatus(InstanceStatus.Ok)
				this.setVariableValues({ connection_status: 'connected' })
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err)
				this.updateStatus(InstanceStatus.ConnectionFailure, message)
				this.setVariableValues({ connection_status: `error: ${message}` })
			}
		}

		this.updateActions()
		this.updateFeedbacks()
		UpdateLibraryVariables(this)
		this.checkFeedbacks('schedule_enabled', 'last_send_status', 'device_online')
	}

	updateActions(): void {
		UpdateActions(this)
	}

	updateFeedbacks(): void {
		UpdateFeedbacks(this)
	}

	updateVariableDefinitions(): void {
		UpdateVariableDefinitions(this)
	}
}
