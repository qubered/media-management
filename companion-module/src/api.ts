/**
 * A minimal typed REST client for the Lectern Library server.
 * Mirrors the shapes in the main app's src/lib/opal/types.ts and apiClient.ts —
 * this module has no shared package with that app, so the overlap is kept to
 * only the fields Companion actually needs.
 */

const REQUEST_TIMEOUT_MS = 8000

export interface PresetSummary {
	id: string
	name: string
	kind: 'image' | 'video'
	pinned: boolean
}

export interface LecternDevice {
	id: string
	name: string
	host: string
}

export type RecurrenceType = 'once' | 'daily' | 'weekly' | 'monthly' | 'interval'

export interface Schedule {
	id: string
	name: string
	presetId: string
	deviceIds: string[]
	recurrenceType: RecurrenceType
	enabled: boolean
	nextRunAt: number
	lastRunAt: number | null
}

export interface SendResult {
	deviceId: string
	ok: boolean
	message: string
}

export interface DeviceHealth {
	network: { ok: boolean; message: string }
	app: { ok: boolean; message: string; status?: string }
}

export class LecternApiError extends Error {}

export class LecternApi {
	constructor(private getBaseUrl: () => string) {}

	private async request<T>(path: string, init?: RequestInit): Promise<T> {
		const url = `${this.getBaseUrl()}${path}`
		let res: Response
		try {
			res = await fetch(url, {
				...init,
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
				headers: init?.body ? { 'Content-Type': 'application/json', ...init.headers } : init?.headers,
			})
		} catch (err) {
			throw new LecternApiError(err instanceof Error ? err.message : `Failed to reach ${url}`)
		}

		if (!res.ok) {
			const body = (await res.json().catch(() => ({}))) as { error?: string }
			throw new LecternApiError(body.error ?? `${path} failed (${res.status})`)
		}

		if (res.status === 204) return undefined as T
		return (await res.json()) as T
	}

	async listPresets(): Promise<PresetSummary[]> {
		return this.request('/api/presets')
	}

	async listDevices(): Promise<LecternDevice[]> {
		return this.request('/api/devices')
	}

	async listSchedules(): Promise<Schedule[]> {
		return this.request('/api/schedules')
	}

	async sendPreset(presetId: string, deviceIds: string[]): Promise<SendResult[]> {
		const body = await this.request<{ results: SendResult[] }>(`/api/presets/${presetId}/send`, {
			method: 'POST',
			body: JSON.stringify({ deviceIds }),
		})
		return body.results
	}

	async triggerSchedule(scheduleId: string): Promise<SendResult[]> {
		const body = await this.request<{ results: SendResult[] }>(`/api/schedules/${scheduleId}/trigger`, {
			method: 'POST',
		})
		return body.results
	}

	async setScheduleEnabled(scheduleId: string, enabled: boolean): Promise<Schedule> {
		return this.request(`/api/schedules/${scheduleId}`, {
			method: 'PATCH',
			body: JSON.stringify({ enabled }),
		})
	}

	async checkDeviceHealth(deviceId: string): Promise<DeviceHealth> {
		return this.request(`/api/devices/${deviceId}/health`)
	}
}
