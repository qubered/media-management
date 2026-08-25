import type { DropdownChoice } from '@companion-module/base'
import { type DeviceHealth, type LecternApi, type LecternDevice, type PresetSummary, type Schedule } from './api.js'

/** Synthetic device choice meaning "every currently registered lectern". */
export const ALL_DEVICES_ID = '__all__'
/** Synthetic device choice meaning "any lectern", for feedback matching. */
export const ANY_DEVICE_ID = '__any__'

/** Caches the last pull of presets/devices/schedules so dropdowns never need a raw id typed in. */
export class LibraryStore {
	presets: PresetSummary[] = []
	devices: LecternDevice[] = []
	schedules: Schedule[] = []

	async refresh(api: LecternApi): Promise<void> {
		const [presets, devices, schedules] = await Promise.all([api.listPresets(), api.listDevices(), api.listSchedules()])
		this.presets = presets
		this.devices = devices
		this.schedules = schedules
	}

	presetChoices(): DropdownChoice[] {
		return this.presets.map((p) => ({ id: p.id, label: p.pinned ? `${p.name} ★` : p.name }))
	}

	deviceChoices(): DropdownChoice[] {
		return this.devices.map((d) => ({ id: d.id, label: `${d.name} (${d.host})` }))
	}

	deviceChoicesWithAll(): DropdownChoice[] {
		return [{ id: ALL_DEVICES_ID, label: 'All lecterns' }, ...this.deviceChoices()]
	}

	deviceChoicesWithAny(): DropdownChoice[] {
		return [{ id: ANY_DEVICE_ID, label: 'Any lectern' }, ...this.deviceChoices()]
	}

	scheduleChoices(): DropdownChoice[] {
		return this.schedules.map((s) => ({ id: s.id, label: s.name }))
	}

	findSchedule(id: string): Schedule | undefined {
		return this.schedules.find((s) => s.id === id)
	}

	findPreset(id: string): PresetSummary | undefined {
		return this.presets.find((p) => p.id === id)
	}

	/** Expands the "all lecterns" synthetic choice, or an empty selection, to every currently known device id. */
	resolveDeviceIds(selected: string[]): string[] {
		if (selected.length === 0 || selected.includes(ALL_DEVICES_ID)) {
			return this.devices.map((d) => d.id)
		}
		return selected.filter((id) => id !== ALL_DEVICES_ID)
	}
}

interface SendRecord {
	ok: boolean
	message: string
	at: number
}

/** Tracks the result of the most recent send per preset+device pair, for the "last send" feedback. */
export class SendResultCache {
	private results = new Map<string, SendRecord>()

	record(presetId: string, deviceId: string, ok: boolean, message: string): void {
		this.results.set(`${presetId}:${deviceId}`, { ok, message, at: Date.now() })
	}

	get(presetId: string, deviceId: string): SendRecord | undefined {
		return this.results.get(`${presetId}:${deviceId}`)
	}

	private matching(presetId: string, deviceId: string | typeof ANY_DEVICE_ID): SendRecord[] {
		const out: SendRecord[] = []
		for (const [key, record] of this.results) {
			const [recordPresetId, recordDeviceId] = key.split(':')
			if (recordPresetId !== presetId) continue
			if (deviceId !== ANY_DEVICE_ID && recordDeviceId !== deviceId) continue
			out.push(record)
		}
		return out
	}

	/** True once at least one send has landed for this preset/device filter and every one of them succeeded. */
	allSucceeded(presetId: string, deviceId: string): boolean {
		const matches = this.matching(presetId, deviceId)
		return matches.length > 0 && matches.every((r) => r.ok)
	}

	/** True if any send for this preset/device filter has failed. */
	anyFailed(presetId: string, deviceId: string): boolean {
		return this.matching(presetId, deviceId).some((r) => !r.ok)
	}
}

/** Tracks the last on-demand health check per device, for the "lectern online" feedback. */
export class DeviceHealthCache {
	private health = new Map<string, DeviceHealth>()

	set(deviceId: string, health: DeviceHealth): void {
		this.health.set(deviceId, health)
	}

	get(deviceId: string): DeviceHealth | undefined {
		return this.health.get(deviceId)
	}
}
