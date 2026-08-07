import type { ConnectionEdgeData, EdgeLineStyle, EdgeRouting } from '../../edges/types';
import type { NodeShape } from '../types';
import NetworkConnectionIcon from './NetworkConnectionIcon';

export type NetworkConnectionKind =
	| 'ethernet'
	| 'fiber'
	| 'serial-wan'
	| 'wireless'
	| 'vpn-tunnel'
	| 'trunk'
	| 'link-aggregation'
	| 'logical-dashed';

interface NetworkConnectionDefinition {
	id: string;
	label: string;
	kind: NetworkConnectionKind;
	searchAliases: readonly string[];
	routing: EdgeRouting;
	lineStyle: EdgeLineStyle;
	strokeWidth: number;
	strokeColor: string;
	/** Orthogonal presets use a stable two-corner footprint on initial drop. */
	footprint: 'straight' | 'curved' | 'orthogonal';
	defaultLabel?: string;
}

const NETWORK_CONNECTION_DEFINITIONS = [
	{
		id: 'NetworkEthernetConnection',
		label: 'Ethernet',
		kind: 'ethernet',
		searchAliases: ['wired', 'LAN cable', 'copper', 'RJ45', 'network cable'],
		routing: 'straight',
		lineStyle: 'solid',
		strokeWidth: 1.8,
		strokeColor: '#2c2c2a',
		footprint: 'straight'
	},
	{
		id: 'NetworkFiberConnection',
		label: 'Fiber',
		kind: 'fiber',
		searchAliases: ['fibre', 'optical', 'fiber optic', 'optical cable'],
		routing: 'straight',
		lineStyle: 'solid',
		strokeWidth: 2.4,
		strokeColor: '#a6192e',
		footprint: 'straight'
	},
	{
		id: 'NetworkSerialWanConnection',
		label: 'Serial / WAN',
		kind: 'serial-wan',
		searchAliases: ['serial', 'WAN', 'wide area network', 'leased line'],
		routing: 'curved',
		lineStyle: 'dashed',
		strokeWidth: 1.8,
		strokeColor: '#2c2c2a',
		footprint: 'curved'
	},
	{
		id: 'NetworkWirelessConnection',
		label: 'Wireless',
		kind: 'wireless',
		searchAliases: ['Wi-Fi', 'WiFi', 'WLAN', 'radio link', 'wireless link'],
		routing: 'curved',
		lineStyle: 'dotted',
		strokeWidth: 2,
		strokeColor: '#a6192e',
		footprint: 'curved'
	},
	{
		id: 'NetworkVpnTunnelConnection',
		label: 'VPN Tunnel',
		kind: 'vpn-tunnel',
		searchAliases: ['VPN', 'tunnel', 'encrypted link', 'secure link'],
		routing: 'orthogonal',
		lineStyle: 'dashed',
		strokeWidth: 3,
		strokeColor: '#a6192e',
		footprint: 'orthogonal'
	},
	{
		id: 'NetworkTrunkConnection',
		label: 'Trunk',
		kind: 'trunk',
		searchAliases: ['VLAN trunk', 'tagged link', '802.1Q', 'dot1q'],
		routing: 'straight',
		lineStyle: 'solid',
		strokeWidth: 3,
		strokeColor: '#2c2c2a',
		footprint: 'straight'
	},
	{
		id: 'NetworkLinkAggregationConnection',
		label: 'Link Aggregation',
		kind: 'link-aggregation',
		searchAliases: ['LAG', 'LACP', 'EtherChannel', 'port channel', 'bonded link'],
		routing: 'straight',
		lineStyle: 'solid',
		strokeWidth: 4,
		strokeColor: '#a6192e',
		footprint: 'straight',
		defaultLabel: 'LAG'
	},
	{
		id: 'NetworkLogicalDashedConnection',
		label: 'Logical / Dashed Link',
		kind: 'logical-dashed',
		searchAliases: ['logical', 'dashed', 'virtual link', 'dependency'],
		routing: 'orthogonal',
		lineStyle: 'dashed',
		strokeWidth: 1.4,
		strokeColor: '#7a7770',
		footprint: 'orthogonal'
	}
] as const satisfies readonly NetworkConnectionDefinition[];

function createPresetData(
	definition: NetworkConnectionDefinition,
	center: { x: number; y: number }
): ConnectionEdgeData {
	const bendPoints =
		definition.footprint === 'orthogonal'
			? [
					{ x: center.x, y: center.y + 30 },
					{ x: center.x, y: center.y - 30 }
				]
			: [];

	return {
		bendPoints,
		routing: definition.routing,
		lineStyle: definition.lineStyle,
		lineCap: 'round',
		strokeWidth: definition.strokeWidth,
		strokeColor: definition.strokeColor,
		networkLinkKind: definition.kind,
		...(definition.defaultLabel
			? {
					labels: [
						{
							id: 'network-link-label',
							t: 0.5,
							text: definition.defaultLabel
						}
					]
				}
			: {})
	};
}

/**
 * Network links are palette presets, not canvas nodes. Dropping one reuses the
 * editor's native floating-connection model, so endpoints, whole-edge moving,
 * labels, routing, and ConnectionStylePanel editing all work unchanged.
 */
export const networkConnectionShapes: readonly NodeShape[] = NETWORK_CONNECTION_DEFINITIONS.map(
	(definition) => ({
		id: definition.id,
		label: definition.label,
		category: 'network',
		paletteGroup: 'connections',
		searchAliases: definition.searchAliases,
		icon: NetworkConnectionIcon,
		paletteIconProps: { kind: definition.kind },
		defaultData: () => ({}),
		edgePreset: (center) => {
			const diagonal = definition.footprint !== 'straight';

			return {
				source: { x: center.x - 80, y: center.y + (diagonal ? 30 : 0) },
				target: { x: center.x + 80, y: center.y - (diagonal ? 30 : 0) },
				data: createPresetData(definition, center)
			};
		}
	})
);
