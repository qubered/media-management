import type ModuleInstance from './main.js'

export type VariablesSchema = {
	connection_status: string
	preset_count: number
	device_count: number
	schedule_count: number
	last_send_preset: string
	last_send_result: string
	last_send_detail: string
	last_schedule_triggered: string
	last_schedule_result: string
}

export function UpdateVariableDefinitions(self: ModuleInstance): void {
	self.setVariableDefinitions({
		connection_status: { name: 'Connection status' },
		preset_count: { name: 'Presets in library' },
		device_count: { name: 'Registered lecterns' },
		schedule_count: { name: 'Schedules' },
		last_send_preset: { name: 'Last preset sent' },
		last_send_result: { name: 'Last send result (ok / partial / failed)' },
		last_send_detail: { name: 'Last send detail' },
		last_schedule_triggered: { name: 'Last schedule triggered' },
		last_schedule_result: { name: 'Last schedule trigger result' },
	})
}

export function UpdateLibraryVariables(self: ModuleInstance): void {
	self.setVariableValues({
		preset_count: self.library.presets.length,
		device_count: self.library.devices.length,
		schedule_count: self.library.schedules.length,
	})
}
