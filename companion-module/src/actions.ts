import type ModuleInstance from './main.js'

export type ActionsSchema = {
	send_preset: { options: { presetId: string; deviceIds: string[] } }
	trigger_schedule: { options: { scheduleId: string } }
	enable_schedule: { options: { scheduleId: string } }
	disable_schedule: { options: { scheduleId: string } }
	toggle_schedule: { options: { scheduleId: string } }
	check_device_health: { options: { deviceId: string } }
	refresh_library: { options: Record<string, never> }
}

function describeError(err: unknown): string {
	return err instanceof Error ? err.message : String(err)
}

function summarizeResults(self: ModuleInstance, results: { deviceId: string; ok: boolean }[]): string {
	if (results.length === 0) return 'no lecterns targeted'
	return results
		.map(
			(r) =>
				`${self.library.devices.find((d) => d.id === r.deviceId)?.name ?? r.deviceId}: ${r.ok ? 'sent' : 'failed'}`,
		)
		.join(', ')
}

function resultOutcome(results: { ok: boolean }[]): 'ok' | 'partial' | 'failed' {
	if (results.length === 0) return 'failed'
	const failed = results.filter((r) => !r.ok).length
	if (failed === 0) return 'ok'
	if (failed === results.length) return 'failed'
	return 'partial'
}

export function UpdateActions(self: ModuleInstance): void {
	self.setActionDefinitions({
		send_preset: {
			name: 'Send preset to lectern(s)',
			options: [
				{
					id: 'presetId',
					type: 'dropdown',
					label: 'Preset',
					choices: self.library.presetChoices(),
					default: '',
					minChoicesForSearch: 1,
				},
				{
					id: 'deviceIds',
					type: 'multidropdown',
					label: 'Lecterns',
					tooltip: 'Leave empty, or select "All lecterns", to push to every registered lectern.',
					choices: self.library.deviceChoicesWithAll(),
					default: [],
				},
			],
			callback: async (event) => {
				const presetId = event.options.presetId
				if (!presetId) {
					self.log('warn', 'Send preset: no preset selected')
					return
				}
				const deviceIds = self.library.resolveDeviceIds(event.options.deviceIds ?? [])
				if (deviceIds.length === 0) {
					self.log('warn', 'Send preset: no lecterns registered on the server')
					return
				}

				const preset = self.library.findPreset(presetId)
				try {
					const results = await self.api.sendPreset(presetId, deviceIds)
					for (const r of results) self.sendCache.record(presetId, r.deviceId, r.ok, r.message)
					self.setVariableValues({
						last_send_preset: preset?.name ?? presetId,
						last_send_result: resultOutcome(results),
						last_send_detail: summarizeResults(self, results),
					})
				} catch (err) {
					self.log('error', `Send preset failed: ${describeError(err)}`)
					self.setVariableValues({
						last_send_preset: preset?.name ?? presetId,
						last_send_result: 'failed',
						last_send_detail: describeError(err),
					})
				}
				self.checkFeedbacks('last_send_status')
			},
		},

		trigger_schedule: {
			name: 'Trigger schedule now',
			options: [
				{
					id: 'scheduleId',
					type: 'dropdown',
					label: 'Schedule',
					choices: self.library.scheduleChoices(),
					default: '',
					minChoicesForSearch: 1,
				},
			],
			callback: async (event) => {
				const scheduleId = event.options.scheduleId
				if (!scheduleId) {
					self.log('warn', 'Trigger schedule: no schedule selected')
					return
				}
				const schedule = self.library.findSchedule(scheduleId)
				try {
					const results = await self.api.triggerSchedule(scheduleId)
					if (schedule) {
						for (const r of results) self.sendCache.record(schedule.presetId, r.deviceId, r.ok, r.message)
					}
					self.setVariableValues({
						last_schedule_triggered: schedule?.name ?? scheduleId,
						last_schedule_result: resultOutcome(results),
					})
				} catch (err) {
					self.log('error', `Trigger schedule failed: ${describeError(err)}`)
					self.setVariableValues({
						last_schedule_triggered: schedule?.name ?? scheduleId,
						last_schedule_result: 'failed',
					})
				}
				self.checkFeedbacks('last_send_status')
			},
		},

		enable_schedule: scheduleEnableAction(self, 'Enable schedule', true),
		disable_schedule: scheduleEnableAction(self, 'Disable schedule', false),

		toggle_schedule: {
			name: 'Toggle schedule enabled',
			options: [
				{
					id: 'scheduleId',
					type: 'dropdown',
					label: 'Schedule',
					choices: self.library.scheduleChoices(),
					default: '',
					minChoicesForSearch: 1,
				},
			],
			callback: async (event) => {
				const scheduleId = event.options.scheduleId
				if (!scheduleId) return
				const current = self.library.findSchedule(scheduleId)
				const next = !(current?.enabled ?? false)
				await setScheduleEnabled(self, scheduleId, next)
			},
		},

		check_device_health: {
			name: 'Check lectern health',
			options: [
				{
					id: 'deviceId',
					type: 'dropdown',
					label: 'Lectern',
					choices: self.library.deviceChoices(),
					default: '',
					minChoicesForSearch: 1,
				},
			],
			callback: async (event) => {
				const deviceId = event.options.deviceId
				if (!deviceId) return
				try {
					const health = await self.api.checkDeviceHealth(deviceId)
					self.healthCache.set(deviceId, health)
				} catch (err) {
					self.log('error', `Health check failed: ${describeError(err)}`)
				}
				self.checkFeedbacks('device_online')
			},
		},

		refresh_library: {
			name: 'Refresh library (presets, lecterns, schedules)',
			options: [],
			callback: async () => {
				await self.refreshLibrary()
			},
		},
	})
}

function scheduleEnableAction(self: ModuleInstance, name: string, enabled: boolean) {
	return {
		name,
		options: [
			{
				id: 'scheduleId' as const,
				type: 'dropdown' as const,
				label: 'Schedule',
				choices: self.library.scheduleChoices(),
				default: '',
				minChoicesForSearch: 1,
			},
		],
		callback: async (event: { options: { scheduleId: string } }) => {
			const scheduleId = event.options.scheduleId
			if (!scheduleId) return
			await setScheduleEnabled(self, scheduleId, enabled)
		},
	}
}

async function setScheduleEnabled(self: ModuleInstance, scheduleId: string, enabled: boolean): Promise<void> {
	const schedule = self.library.findSchedule(scheduleId)
	try {
		await self.api.setScheduleEnabled(scheduleId, enabled)
		if (schedule) schedule.enabled = enabled
	} catch (err) {
		self.log('error', `${enabled ? 'Enable' : 'Disable'} schedule failed: ${describeError(err)}`)
	}
	self.checkFeedbacks('schedule_enabled')
}
