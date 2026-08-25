import { combineRgb } from '@companion-module/base'
import type ModuleInstance from './main.js'
import { ANY_DEVICE_ID } from './state.js'

export type FeedbacksSchema = {
	schedule_enabled: { type: 'boolean'; options: { scheduleId: string } }
	last_send_status: { type: 'boolean'; options: { presetId: string; deviceId: string; expect: string } }
	device_online: { type: 'boolean'; options: { deviceId: string } }
}

export function UpdateFeedbacks(self: ModuleInstance): void {
	self.setFeedbackDefinitions({
		schedule_enabled: {
			type: 'boolean',
			name: 'Schedule is enabled',
			defaultStyle: { bgcolor: combineRgb(0, 153, 0), color: combineRgb(255, 255, 255) },
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
			callback: (feedback) => {
				if (!feedback.options.scheduleId) return false
				return self.library.findSchedule(feedback.options.scheduleId)?.enabled ?? false
			},
		},

		last_send_status: {
			type: 'boolean',
			name: 'Last send result',
			description: 'Reflects the result of the most recent "Send preset" or "Trigger schedule" action for this preset.',
			defaultStyle: { bgcolor: combineRgb(0, 153, 0), color: combineRgb(255, 255, 255) },
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
					id: 'deviceId',
					type: 'dropdown',
					label: 'Lectern',
					choices: self.library.deviceChoicesWithAny(),
					default: ANY_DEVICE_ID,
					minChoicesForSearch: 1,
				},
				{
					id: 'expect',
					type: 'dropdown',
					label: 'Match when',
					choices: [
						{ id: 'ok', label: 'Sent successfully' },
						{ id: 'failed', label: 'Any send failed' },
					],
					default: 'ok',
				},
			],
			callback: (feedback) => {
				const { presetId, deviceId, expect } = feedback.options
				if (!presetId) return false
				const targetDevice = deviceId || ANY_DEVICE_ID
				return expect === 'failed'
					? self.sendCache.anyFailed(presetId, targetDevice)
					: self.sendCache.allSucceeded(presetId, targetDevice)
			},
		},

		device_online: {
			type: 'boolean',
			name: 'Lectern online (last check)',
			description:
				'Reflects the result of the most recent "Check lectern health" action — this does not poll on its own, trigger the action first (e.g. on a timer).',
			defaultStyle: { bgcolor: combineRgb(0, 153, 0), color: combineRgb(255, 255, 255) },
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
			callback: (feedback) => {
				if (!feedback.options.deviceId) return false
				const health = self.healthCache.get(feedback.options.deviceId)
				return health ? health.network.ok && health.app.ok : false
			},
		},
	})
}
