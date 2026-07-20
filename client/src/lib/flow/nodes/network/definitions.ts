import type { PaletteGroupId } from '../types';
import type { NetworkSymbolId } from './symbols';

export type NetworkNodeKind = 'device' | 'container';

export interface NetworkHandleBounds {
	top: number;
	right: number;
	bottom: number;
	left: number;
}

export interface NetworkDefinition {
	id: string;
	label: string;
	paletteGroup: PaletteGroupId;
	searchAliases: readonly string[];
	symbol: NetworkSymbolId;
	kind: NetworkNodeKind;
	defaultWidth: number;
	defaultHeight: number;
	minWidth: number;
	minHeight: number;
	keepAspectRatio: boolean;
	/** Optional crop of the shared 100x80 artboard for tall, narrow symbols. */
	viewBox?: string;
	/** Handle positions, as percentages of the rendered node box. */
	handleBounds?: NetworkHandleBounds;
}

const CHASSIS_HANDLES = { top: 25, right: 93, bottom: 78.75, left: 7 } as const;
const SERVER_HANDLES = { top: 5.5, right: 92, bottom: 94.5, left: 8 } as const;

const HANDLE_BOUNDS_BY_SYMBOL: Partial<Record<NetworkSymbolId, NetworkHandleBounds>> = {
	router: { top: 18.75, right: 92, bottom: 81.25, left: 8 },
	'wireless-router': CHASSIS_HANDLES,
	'switch-l2': CHASSIS_HANDLES,
	'switch-l3': CHASSIS_HANDLES,
	hub: CHASSIS_HANDLES,
	bridge: CHASSIS_HANDLES,
	gateway: CHASSIS_HANDLES,
	modem: CHASSIS_HANDLES,
	'access-point': { top: 45, right: 73, bottom: 80, left: 27 },
	'wireless-controller': CHASSIS_HANDLES,
	firewall: { top: 13.75, right: 85, bottom: 86.25, left: 15 },
	'ids-ips': CHASSIS_HANDLES,
	'vpn-gateway': CHASSIS_HANDLES,
	'load-balancer': CHASSIS_HANDLES,
	proxy: CHASSIS_HANDLES,
	'nat-gateway': CHASSIS_HANDLES,
	desktop: { top: 8.75, right: 87, bottom: 86.25, left: 13 },
	laptop: { top: 8.75, right: 82, bottom: 87.5, left: 18 },
	printer: { top: 8.75, right: 81, bottom: 90, left: 19 },
	'ip-phone': { top: 12.5, right: 82, bottom: 87.5, left: 18 },
	smartphone: { top: 4, right: 91, bottom: 96, left: 9 },
	tablet: { top: 4, right: 94, bottom: 96, left: 6 },
	'iot-device': { top: 15, right: 75, bottom: 87.5, left: 25 },
	'ip-camera': { top: 33.75, right: 80, bottom: 85, left: 8 },
	server: SERVER_HANDLES,
	'database-server': SERVER_HANDLES,
	'nas-storage': SERVER_HANDLES,
	internet: { top: 11.25, right: 81, bottom: 88.75, left: 19 },
	cloud: { top: 17.5, right: 89, bottom: 75, left: 12 },
	isp: { top: 17.5, right: 89, bottom: 75, left: 12 },
	'data-center': { top: 8.75, right: 83, bottom: 87.5, left: 17 },
	'branch-office': { top: 8.75, right: 83, bottom: 87.5, left: 17 },
	'cell-tower': { top: 20, right: 84, bottom: 85, left: 16 },
	satellite: { top: 36.25, right: 92, bottom: 88.75, left: 9 }
};

const device = (
	id: string,
	label: string,
	paletteGroup: PaletteGroupId,
	symbol: NetworkSymbolId,
	searchAliases: readonly string[] = [],
	size: {
		width?: number;
		height?: number;
		minWidth?: number;
		minHeight?: number;
		viewBox?: string;
	} = {}
): NetworkDefinition => ({
	id,
	label,
	paletteGroup,
	searchAliases,
	symbol,
	kind: 'device',
	defaultWidth: size.width ?? 104,
	defaultHeight: size.height ?? 84,
	minWidth: size.minWidth ?? 56,
	minHeight: size.minHeight ?? 44,
	keepAspectRatio: true,
	viewBox: size.viewBox,
	handleBounds: HANDLE_BOUNDS_BY_SYMBOL[symbol]
});

const container = (
	id: string,
	label: string,
	symbol: NetworkSymbolId,
	searchAliases: readonly string[] = []
): NetworkDefinition => ({
	id,
	label,
	paletteGroup: 'zones-containers',
	searchAliases,
	symbol,
	kind: 'container',
	defaultWidth: 320,
	defaultHeight: 220,
	minWidth: 160,
	minHeight: 100,
	keepAspectRatio: false
});

/**
 * Vendor-neutral network catalog. The ids are persistence keys, so keep them
 * stable even if a display label changes later.
 */
export const NETWORK_DEFINITIONS = [
	device('NetworkRouterNode', 'Router', 'network-devices', 'router', [
		'network router',
		'routing'
	]),
	device('NetworkWirelessRouterNode', 'Wireless Router', 'network-devices', 'wireless-router', [
		'wifi router',
		'wireless gateway'
	]),
	device('NetworkLayer2SwitchNode', 'Layer 2 Switch', 'network-devices', 'switch-l2', [
		'l2 switch',
		'ethernet switch'
	]),
	device('NetworkLayer3SwitchNode', 'Layer 3 Switch', 'network-devices', 'switch-l3', [
		'l3 switch',
		'multilayer switch'
	]),
	device('NetworkHubNode', 'Hub', 'network-devices', 'hub', ['network hub']),
	device('NetworkBridgeNode', 'Bridge', 'network-devices', 'bridge', ['network bridge']),
	device('NetworkGatewayNode', 'Gateway', 'network-devices', 'gateway', ['network gateway']),
	device('NetworkModemNode', 'Modem', 'network-devices', 'modem', ['broadband modem']),
	device('NetworkAccessPointNode', 'Access Point', 'network-devices', 'access-point', [
		'ap',
		'wifi access point'
	]),
	device(
		'NetworkWirelessLanControllerNode',
		'Wireless LAN Controller',
		'network-devices',
		'wireless-controller',
		['wlc', 'wifi controller']
	),

	device('NetworkFirewallNode', 'Firewall', 'security-traffic', 'firewall', [
		'network security',
		'packet filter'
	]),
	device('NetworkIdsIpsNode', 'IDS / IPS', 'security-traffic', 'ids-ips', [
		'intrusion detection',
		'intrusion prevention'
	]),
	device('NetworkVpnGatewayNode', 'VPN Gateway', 'security-traffic', 'vpn-gateway', [
		'virtual private network',
		'vpn concentrator'
	]),
	device('NetworkLoadBalancerNode', 'Load Balancer', 'security-traffic', 'load-balancer', [
		'load balancing',
		'traffic manager'
	]),
	device('NetworkProxyNode', 'Proxy', 'security-traffic', 'proxy', [
		'proxy server',
		'reverse proxy'
	]),
	device('NetworkNatGatewayNode', 'NAT Gateway', 'security-traffic', 'nat-gateway', [
		'network address translation',
		'nat'
	]),

	device('NetworkDesktopPcNode', 'Desktop PC', 'end-devices', 'desktop', [
		'computer',
		'workstation',
		'client'
	]),
	device('NetworkLaptopNode', 'Laptop', 'end-devices', 'laptop', ['notebook', 'client']),
	device('NetworkPrinterNode', 'Printer', 'end-devices', 'printer', ['network printer']),
	device('NetworkIpPhoneNode', 'IP Phone', 'end-devices', 'ip-phone', [
		'voip phone',
		'telephone'
	]),
	device(
		'NetworkSmartphoneNode',
		'Smartphone',
		'end-devices',
		'smartphone',
		['mobile phone', 'cell phone'],
		{ width: 68, height: 94, minWidth: 42, minHeight: 58, viewBox: '27 2 46 76' }
	),
	device('NetworkTabletNode', 'Tablet', 'end-devices', 'tablet', ['mobile device'], {
		width: 78,
		height: 98,
		minWidth: 48,
		minHeight: 60,
		viewBox: '18 2 64 76'
	}),
	device('NetworkIotDeviceNode', 'IoT Device', 'end-devices', 'iot-device', [
		'internet of things',
		'sensor',
		'embedded device'
	]),
	device('NetworkIpCameraNode', 'IP Camera', 'end-devices', 'ip-camera', [
		'cctv',
		'security camera',
		'network camera'
	]),

	device(
		'NetworkServerNode',
		'Generic Server',
		'servers-storage',
		'server',
		['application server', 'compute'],
		{ width: 82, height: 100, minWidth: 50, minHeight: 60, viewBox: '18 3 64 74' }
	),
	device(
		'NetworkDatabaseServerNode',
		'Database Server',
		'servers-storage',
		'database-server',
		['db server', 'sql server'],
		{ width: 82, height: 100, minWidth: 50, minHeight: 60, viewBox: '18 3 64 74' }
	),
	device(
		'NetworkNasStorageNode',
		'NAS / Storage',
		'servers-storage',
		'nas-storage',
		['network attached storage', 'file storage'],
		{ width: 82, height: 100, minWidth: 50, minHeight: 60, viewBox: '18 3 64 74' }
	),

	device('NetworkInternetNode', 'Internet', 'wan-cloud', 'internet', ['world wide web', 'wan']),
	device('NetworkCloudNode', 'Cloud', 'wan-cloud', 'cloud', ['cloud network', 'cloud computing']),
	device('NetworkIspNode', 'ISP', 'wan-cloud', 'isp', ['internet service provider']),
	device('NetworkDataCenterNode', 'Data Center', 'wan-cloud', 'data-center', [
		'datacenter',
		'dc'
	]),
	device('NetworkBranchOfficeNode', 'Branch Office', 'wan-cloud', 'branch-office', [
		'branch site',
		'remote office'
	]),
	device(
		'NetworkCellularTowerNode',
		'Cellular Tower',
		'wan-cloud',
		'cell-tower',
		['cell tower', 'mobile tower', '5g tower'],
		{ width: 104, height: 96, minWidth: 62, minHeight: 58 }
	),
	device(
		'NetworkSatelliteNode',
		'Satellite',
		'wan-cloud',
		'satellite',
		['satellite network', 'space'],
		{ width: 112, height: 90, minWidth: 68, minHeight: 54 }
	),

	container('NetworkSubnetNode', 'Subnet', 'subnet', ['ip subnet', 'network segment']),
	container('NetworkVlanNode', 'VLAN', 'vlan', ['virtual lan', 'virtual local area network']),
	container('NetworkDmzNode', 'DMZ', 'dmz', ['demilitarized zone', 'perimeter network']),
	container('NetworkZoneNode', 'Network Zone', 'network-zone', [
		'security zone',
		'network boundary'
	]),
	container('NetworkRackClusterNode', 'Rack / Cluster', 'rack-cluster', [
		'server rack',
		'compute cluster',
		'node group'
	])
] as const satisfies readonly NetworkDefinition[];

export type NetworkNodeId = (typeof NETWORK_DEFINITIONS)[number]['id'];

const DEFINITION_BY_ID = new Map<string, NetworkDefinition>(
	NETWORK_DEFINITIONS.map((definition) => [definition.id, definition])
);

export function getNetworkDefinition(id: string | null | undefined): NetworkDefinition | undefined {
	return id ? DEFINITION_BY_ID.get(id) : undefined;
}
