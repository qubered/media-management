import type { SomeCompanionConfigField } from '@companion-module/base'

// A type alias (not an interface) so it structurally satisfies @companion-module/base's
// JsonObject constraint on TManifest['config'] — see main.ts's InstanceBase<ModuleSchema>.
export type ModuleConfig = {
	host: string
	port: number
	useHttps: boolean
	pollIntervalSeconds: number
}

export function GetConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'textinput',
			id: 'host',
			label: 'Lectern server host',
			tooltip: 'IP address or hostname of the machine running the Lectern Library server',
			width: 6,
			default: '',
		},
		{
			type: 'number',
			id: 'port',
			label: 'Port',
			width: 3,
			min: 1,
			max: 65535,
			default: 3000,
		},
		{
			type: 'checkbox',
			id: 'useHttps',
			label: 'HTTPS',
			width: 3,
			default: false,
		},
		{
			type: 'number',
			id: 'pollIntervalSeconds',
			label: 'Library refresh interval (seconds)',
			tooltip:
				'How often to re-fetch presets, lecterns, and schedules from the server so action/feedback dropdowns stay current. Use the "Refresh library" action to update immediately after a change.',
			width: 6,
			min: 5,
			max: 300,
			default: 20,
		},
	]
}

export function getBaseUrl(config: ModuleConfig): string {
	const protocol = config.useHttps ? 'https' : 'http'
	return `${protocol}://${config.host}:${config.port}`
}
