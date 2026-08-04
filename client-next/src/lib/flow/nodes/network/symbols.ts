export type NetworkPaintRole = 'none' | 'surface' | 'accent' | 'accent-soft' | 'ink' | 'muted';

interface PrimitiveStyle {
	fill?: NetworkPaintRole;
	stroke?: NetworkPaintRole;
	strokeWidth?: number;
	dash?: string;
	lineCap?: 'round' | 'butt' | 'square';
	lineJoin?: 'round' | 'bevel' | 'miter';
	opacity?: number;
	paletteHidden?: boolean;
}

export type NetworkPrimitive =
	| ({ kind: 'path'; d: string } & PrimitiveStyle)
	| ({
			kind: 'rect';
			x: number;
			y: number;
			width: number;
			height: number;
			rx?: number;
	  } & PrimitiveStyle)
	| ({ kind: 'circle'; cx: number; cy: number; r: number } & PrimitiveStyle)
	| ({ kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number } & PrimitiveStyle)
	| ({ kind: 'line'; x1: number; y1: number; x2: number; y2: number } & PrimitiveStyle)
	| ({ kind: 'polyline'; points: string } & PrimitiveStyle)
	| ({ kind: 'polygon'; points: string } & PrimitiveStyle)
	| ({
			kind: 'text';
			x: number;
			y: number;
			text: string;
			fontSize?: number;
			fontWeight?: number;
	  } & PrimitiveStyle);

export type NetworkSymbolId =
	| 'router'
	| 'wireless-router'
	| 'switch-l2'
	| 'switch-l3'
	| 'hub'
	| 'bridge'
	| 'gateway'
	| 'modem'
	| 'access-point'
	| 'wireless-controller'
	| 'firewall'
	| 'ids-ips'
	| 'vpn-gateway'
	| 'load-balancer'
	| 'proxy'
	| 'nat-gateway'
	| 'desktop'
	| 'laptop'
	| 'printer'
	| 'ip-phone'
	| 'smartphone'
	| 'tablet'
	| 'iot-device'
	| 'ip-camera'
	| 'server'
	| 'database-server'
	| 'nas-storage'
	| 'internet'
	| 'cloud'
	| 'isp'
	| 'data-center'
	| 'branch-office'
	| 'cell-tower'
	| 'satellite'
	| 'subnet'
	| 'vlan'
	| 'dmz'
	| 'network-zone'
	| 'rack-cluster';

const rect = (
	x: number,
	y: number,
	width: number,
	height: number,
	rx = 0,
	style: PrimitiveStyle = {}
): NetworkPrimitive => ({
	kind: 'rect',
	x,
	y,
	width,
	height,
	rx,
	fill: 'surface',
	stroke: 'ink',
	strokeWidth: 1.8,
	...style
});

const circle = (
	cx: number,
	cy: number,
	r: number,
	style: PrimitiveStyle = {}
): NetworkPrimitive => ({
	kind: 'circle',
	cx,
	cy,
	r,
	fill: 'surface',
	stroke: 'ink',
	strokeWidth: 1.8,
	...style
});

const ellipse = (
	cx: number,
	cy: number,
	rx: number,
	ry: number,
	style: PrimitiveStyle = {}
): NetworkPrimitive => ({
	kind: 'ellipse',
	cx,
	cy,
	rx,
	ry,
	fill: 'surface',
	stroke: 'ink',
	strokeWidth: 1.8,
	...style
});

const line = (
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	style: PrimitiveStyle = {}
): NetworkPrimitive => ({
	kind: 'line',
	x1,
	y1,
	x2,
	y2,
	fill: 'none',
	stroke: 'ink',
	strokeWidth: 1.8,
	lineCap: 'round',
	...style
});

const path = (d: string, style: PrimitiveStyle = {}): NetworkPrimitive => ({
	kind: 'path',
	d,
	fill: 'none',
	stroke: 'ink',
	strokeWidth: 1.8,
	lineCap: 'round',
	lineJoin: 'round',
	...style
});

const polyline = (points: string, style: PrimitiveStyle = {}): NetworkPrimitive => ({
	kind: 'polyline',
	points,
	fill: 'none',
	stroke: 'ink',
	strokeWidth: 1.8,
	lineCap: 'round',
	lineJoin: 'round',
	...style
});

const polygon = (points: string, style: PrimitiveStyle = {}): NetworkPrimitive => ({
	kind: 'polygon',
	points,
	fill: 'surface',
	stroke: 'ink',
	strokeWidth: 1.8,
	lineJoin: 'round',
	...style
});

const text = (
	x: number,
	y: number,
	value: string,
	fontSize = 12,
	style: PrimitiveStyle = {}
): NetworkPrimitive => ({
	kind: 'text',
	x,
	y,
	text: value,
	fontSize,
	fontWeight: 700,
	fill: 'accent',
	stroke: 'none',
	...style
});

const led = (cx: number, cy: number, accent = false): NetworkPrimitive =>
	circle(cx, cy, 1.9, {
		fill: accent ? 'accent' : 'muted',
		stroke: 'none'
	});

const port = (x: number, y: number): NetworkPrimitive =>
	rect(x, y, 8, 5, 1, { fill: 'surface', stroke: 'muted', strokeWidth: 1.2 });

const wifi = (cx = 50, top = 8): readonly NetworkPrimitive[] => [
	path(`M${cx - 20} ${top + 15} Q${cx} ${top - 3} ${cx + 20} ${top + 15}`, {
		stroke: 'accent',
		strokeWidth: 2
	}),
	path(`M${cx - 12} ${top + 20} Q${cx} ${top + 8} ${cx + 12} ${top + 20}`, {
		stroke: 'accent',
		strokeWidth: 2
	}),
	circle(cx, top + 25, 2.4, { fill: 'accent', stroke: 'none' })
];

const routeCross = (cx = 50, cy = 40): readonly NetworkPrimitive[] => [
	line(cx - 20, cy, cx + 20, cy, { stroke: 'accent', strokeWidth: 2.2 }),
	polyline(`${cx - 13},${cy - 6} ${cx - 20},${cy} ${cx - 13},${cy + 6}`, {
		stroke: 'accent',
		strokeWidth: 2.2
	}),
	polyline(`${cx + 13},${cy - 6} ${cx + 20},${cy} ${cx + 13},${cy + 6}`, {
		stroke: 'accent',
		strokeWidth: 2.2
	}),
	line(cx, cy - 16, cx, cy + 16, { stroke: 'accent', strokeWidth: 2.2 }),
	polyline(`${cx - 6},${cy - 9} ${cx},${cy - 16} ${cx + 6},${cy - 9}`, {
		stroke: 'accent',
		strokeWidth: 2.2
	}),
	polyline(`${cx - 6},${cy + 9} ${cx},${cy + 16} ${cx + 6},${cy + 9}`, {
		stroke: 'accent',
		strokeWidth: 2.2
	})
];

const chassis = (...details: NetworkPrimitive[]): readonly NetworkPrimitive[] => [
	rect(7, 20, 86, 43, 8, { fill: 'surface' }),
	rect(7, 49, 86, 14, 0, { fill: 'accent-soft', stroke: 'none' }),
	line(7, 49, 93, 49, { stroke: 'muted', strokeWidth: 1.2 }),
	led(17, 56, true),
	led(24, 56),
	...details
];

const switchPorts = (): readonly NetworkPrimitive[] => [
	port(42, 53),
	port(52, 53),
	port(62, 53),
	port(72, 53),
	port(82, 53)
];

const shield = (label?: string): readonly NetworkPrimitive[] => [
	path('M50 27 L66 33 V43 C66 53 59 59 50 63 C41 59 34 53 34 43 V33 Z', {
		fill: 'accent-soft',
		stroke: 'accent',
		strokeWidth: 2
	}),
	...(label ? [text(50, 47, label, label.length > 2 ? 7.5 : 10)] : [])
];

const serverRack = (...details: NetworkPrimitive[]): readonly NetworkPrimitive[] => [
	rect(23, 7, 54, 66, 6, { fill: 'surface' }),
	rect(29, 14, 42, 13, 3, { fill: 'accent-soft', stroke: 'muted', strokeWidth: 1.2 }),
	rect(29, 33, 42, 13, 3, { fill: 'accent-soft', stroke: 'muted', strokeWidth: 1.2 }),
	rect(29, 52, 42, 13, 3, { fill: 'accent-soft', stroke: 'muted', strokeWidth: 1.2 }),
	led(64, 20, true),
	led(64, 39),
	led(64, 58),
	...details
];

const cloud = (...details: NetworkPrimitive[]): readonly NetworkPrimitive[] => [
	path(
		'M27 60 H73 C84 60 89 53 89 45 C89 37 83 31 75 30 C72 20 64 14 54 14 C42 14 34 21 31 31 C20 31 12 38 12 47 C12 55 18 60 27 60 Z',
		{ fill: 'surface', stroke: 'ink', strokeWidth: 1.8 }
	),
	...details
];

const building = (...details: NetworkPrimitive[]): readonly NetworkPrimitive[] => [
	polygon('17,70 17,22 50,7 83,22 83,70', { fill: 'surface' }),
	line(17, 31, 83, 31, { stroke: 'muted', strokeWidth: 1.2 }),
	...details
];

const zoneFrame = (
	mark: readonly NetworkPrimitive[],
	style: PrimitiveStyle = {}
): readonly NetworkPrimitive[] => [
	rect(2, 2, 96, 76, 8, {
		fill: 'none',
		stroke: 'muted',
		strokeWidth: 1.6,
		...style
	}),
	rect(2, 2, 96, 15, 8, { fill: 'accent-soft', stroke: 'none' }),
	line(2, 17, 98, 17, { stroke: 'muted', strokeWidth: 1.2 }),
	...mark
];

const ROUTER = [ellipse(50, 40, 42, 25, { fill: 'surface' }), ...routeCross()] as const;

const WIRELESS_ROUTER = [
	...chassis(...switchPorts()),
	line(19, 20, 14, 7, { stroke: 'ink' }),
	line(81, 20, 86, 7, { stroke: 'ink' }),
	...wifi(50, 2)
] as const;

const SWITCH_L2 = [
	...chassis(...switchPorts()),
	line(34, 35, 66, 35, { stroke: 'accent', strokeWidth: 2.2 }),
	polyline('40,30 34,35 40,40', { stroke: 'accent', strokeWidth: 2.2 }),
	polyline('60,30 66,35 60,40', { stroke: 'accent', strokeWidth: 2.2 }),
	text(20, 36, 'L2', 9)
] as const;

const SWITCH_L3 = [
	...chassis(...switchPorts()),
	...routeCross(55, 35),
	text(20, 36, 'L3', 9)
] as const;

const HUB = [
	...chassis(...switchPorts()),
	circle(50, 34, 5, { fill: 'accent-soft', stroke: 'accent' }),
	line(50, 29, 50, 24, { stroke: 'accent' }),
	line(45, 34, 34, 34, { stroke: 'accent' }),
	line(55, 34, 66, 34, { stroke: 'accent' }),
	line(46, 38, 39, 44, { stroke: 'accent' }),
	line(54, 38, 61, 44, { stroke: 'accent' })
] as const;

const BRIDGE = [
	...chassis(port(33, 53), port(59, 53)),
	circle(34, 38, 4, { fill: 'accent', stroke: 'none' }),
	circle(66, 38, 4, { fill: 'accent', stroke: 'none' }),
	path('M34 38 Q50 21 66 38', { stroke: 'accent', strokeWidth: 2.2 }),
	line(34, 38, 66, 38, { stroke: 'accent', strokeWidth: 2.2 })
] as const;

const GATEWAY = [
	...chassis(),
	path('M36 47 V36 C36 27 44 24 50 24 C56 24 64 27 64 36 V47', {
		stroke: 'accent',
		strokeWidth: 2.2
	}),
	line(28, 40, 44, 40, { stroke: 'accent' }),
	polyline('38,34 44,40 38,46', { stroke: 'accent' }),
	line(72, 32, 56, 32, { stroke: 'accent' }),
	polyline('62,26 56,32 62,38', { stroke: 'accent' })
] as const;

const MODEM = [
	...chassis(...switchPorts().slice(0, 3)),
	path('M25 37 C31 24 37 50 43 37 C49 24 55 50 61 37 C67 24 73 50 79 37', {
		stroke: 'accent',
		strokeWidth: 2
	})
] as const;

const ACCESS_POINT = [
	ellipse(50, 50, 33, 14, { fill: 'surface' }),
	ellipse(50, 48, 22, 7, { fill: 'accent-soft', stroke: 'muted', strokeWidth: 1.2 }),
	led(50, 52, true),
	...wifi(50, 8)
] as const;

const WIRELESS_CONTROLLER = [
	...chassis(port(66, 53), port(76, 53), port(86, 53)),
	...wifi(50, 18),
	circle(35, 42, 3, { fill: 'accent', stroke: 'none' }),
	circle(50, 42, 3, { fill: 'accent', stroke: 'none' }),
	circle(65, 42, 3, { fill: 'accent', stroke: 'none' })
] as const;

const FIREWALL = [
	rect(15, 11, 70, 58, 6, { fill: 'accent-soft', stroke: 'accent', strokeWidth: 2 }),
	line(15, 30, 85, 30, { stroke: 'accent' }),
	line(15, 49, 85, 49, { stroke: 'accent' }),
	line(34, 11, 34, 30, { stroke: 'accent' }),
	line(66, 11, 66, 30, { stroke: 'accent' }),
	line(26, 30, 26, 49, { stroke: 'accent' }),
	line(54, 30, 54, 49, { stroke: 'accent' }),
	line(74, 49, 74, 69, { stroke: 'accent' }),
	line(43, 49, 43, 69, { stroke: 'accent' })
] as const;

const IDS_IPS = [
	...chassis(),
	...shield(),
	polyline('40,44 45,44 49,37 54,49 58,42 63,42', {
		stroke: 'accent',
		strokeWidth: 1.7
	})
] as const;

const VPN_GATEWAY = [
	...chassis(),
	path('M40 39 V34 C40 27 44 24 50 24 C56 24 60 27 60 34 V39', {
		stroke: 'accent',
		strokeWidth: 2
	}),
	rect(36, 38, 28, 17, 4, { fill: 'accent-soft', stroke: 'accent', strokeWidth: 2 }),
	circle(50, 46, 2, { fill: 'accent', stroke: 'none' }),
	line(50, 48, 50, 52, { stroke: 'accent', strokeWidth: 2 })
] as const;

const LOAD_BALANCER = [
	...chassis(),
	line(24, 35, 46, 35, { stroke: 'accent', strokeWidth: 2 }),
	line(46, 35, 58, 25, { stroke: 'accent', strokeWidth: 2 }),
	line(46, 35, 58, 35, { stroke: 'accent', strokeWidth: 2 }),
	line(46, 35, 58, 45, { stroke: 'accent', strokeWidth: 2 }),
	circle(64, 25, 4, { fill: 'accent-soft', stroke: 'accent' }),
	circle(64, 35, 4, { fill: 'accent-soft', stroke: 'accent' }),
	circle(64, 45, 4, { fill: 'accent-soft', stroke: 'accent' })
] as const;

const PROXY = [
	...chassis(),
	rect(23, 30, 15, 14, 3, { fill: 'accent-soft', stroke: 'accent' }),
	circle(50, 37, 6, { fill: 'surface', stroke: 'accent', strokeWidth: 2 }),
	rect(62, 30, 15, 14, 3, { fill: 'accent-soft', stroke: 'accent' }),
	line(38, 37, 44, 37, { stroke: 'accent' }),
	line(56, 37, 62, 37, { stroke: 'accent' })
] as const;

const NAT_GATEWAY = [
	...chassis(),
	text(50, 31, 'NAT', 10),
	line(29, 41, 71, 41, { stroke: 'accent', strokeWidth: 2 }),
	polyline('35,35 29,41 35,47', { stroke: 'accent', strokeWidth: 2 }),
	polyline('65,35 71,41 65,47', { stroke: 'accent', strokeWidth: 2 })
] as const;

const DESKTOP = [
	rect(13, 7, 74, 49, 5, { fill: 'surface' }),
	rect(20, 14, 60, 34, 2, { fill: 'accent-soft', stroke: 'muted', strokeWidth: 1.2 }),
	line(50, 56, 50, 67, { stroke: 'ink', strokeWidth: 2 }),
	line(35, 69, 65, 69, { stroke: 'ink', strokeWidth: 2.4 }),
	circle(50, 52, 1.8, { fill: 'accent', stroke: 'none' })
] as const;

const LAPTOP = [
	rect(18, 7, 64, 45, 5, { fill: 'surface' }),
	rect(24, 13, 52, 32, 2, { fill: 'accent-soft', stroke: 'muted', strokeWidth: 1.2 }),
	polygon('12,58 88,58 94,70 6,70', { fill: 'surface' }),
	line(38, 64, 62, 64, { stroke: 'muted', strokeWidth: 1.2 })
] as const;

const PRINTER = [
	rect(19, 25, 62, 36, 7, { fill: 'surface' }),
	rect(29, 7, 42, 28, 2, { fill: 'surface' }),
	rect(27, 47, 46, 25, 3, { fill: 'accent-soft', stroke: 'ink' }),
	line(35, 55, 65, 55, { stroke: 'muted' }),
	line(35, 62, 58, 62, { stroke: 'muted' }),
	led(70, 36, true)
] as const;

const IP_PHONE = [
	rect(18, 10, 64, 60, 9, { fill: 'surface' }),
	path('M28 18 C22 25 22 36 28 43 L37 37 C34 32 34 27 37 23 Z', {
		fill: 'accent-soft',
		stroke: 'accent',
		strokeWidth: 1.8
	}),
	rect(46, 18, 25, 15, 2, { fill: 'accent-soft', stroke: 'muted', strokeWidth: 1.2 }),
	...[
		[49, 41],
		[58, 41],
		[67, 41],
		[49, 50],
		[58, 50],
		[67, 50],
		[49, 59],
		[58, 59],
		[67, 59]
	].map(([cx, cy]) => circle(cx, cy, 2, { fill: 'muted', stroke: 'none' }))
] as const;

const SMARTPHONE = [
	rect(31, 5, 38, 70, 8, { fill: 'surface' }),
	rect(36, 13, 28, 49, 3, { fill: 'accent-soft', stroke: 'muted', strokeWidth: 1.2 }),
	circle(50, 68, 2.5, { fill: 'surface', stroke: 'accent', strokeWidth: 1.5 })
] as const;

const TABLET = [
	rect(22, 5, 56, 70, 8, { fill: 'surface' }),
	rect(28, 11, 44, 55, 3, { fill: 'accent-soft', stroke: 'muted', strokeWidth: 1.2 }),
	circle(50, 70, 2, { fill: 'accent', stroke: 'none' })
] as const;

const IOT_DEVICE = [
	rect(25, 18, 50, 46, 7, { fill: 'surface' }),
	rect(35, 28, 30, 26, 4, { fill: 'accent-soft', stroke: 'accent', strokeWidth: 1.8 }),
	...([31, 41, 51, 61] as const).flatMap((x) => [
		line(x, 12, x, 18, { stroke: 'muted' }),
		line(x, 64, x, 70, { stroke: 'muted' })
	]),
	...([25, 35, 45, 55] as const).flatMap((y) => [
		line(19, y, 25, y, { stroke: 'muted' }),
		line(75, y, 81, y, { stroke: 'muted' })
	]),
	...wifi(50, 14)
] as const;

const IP_CAMERA = [
	path('M18 27 H65 C74 27 80 34 80 42 C80 50 74 57 65 57 H18 Z', {
		fill: 'surface',
		stroke: 'ink'
	}),
	circle(66, 42, 11, { fill: 'accent-soft', stroke: 'accent', strokeWidth: 2 }),
	circle(66, 42, 5, { fill: 'ink', stroke: 'none' }),
	line(30, 57, 38, 67, { stroke: 'ink', strokeWidth: 2 }),
	line(26, 68, 50, 68, { stroke: 'ink', strokeWidth: 2.4 }),
	polygon('18,31 8,37 8,47 18,53', { fill: 'accent-soft', stroke: 'ink' })
] as const;

const SERVER = [...serverRack()] as const;

const DATABASE_SERVER = [
	...serverRack(),
	ellipse(50, 31, 12, 4, { fill: 'accent-soft', stroke: 'accent', strokeWidth: 1.5 }),
	path('M38 31 V43 C38 47 62 47 62 43 V31', { stroke: 'accent', strokeWidth: 1.5 }),
	path('M38 37 C38 41 62 41 62 37', { stroke: 'accent', strokeWidth: 1.2 })
] as const;

const NAS_STORAGE = [
	...serverRack(),
	rect(34, 18, 32, 9, 2, { fill: 'accent-soft', stroke: 'accent', strokeWidth: 1.3 }),
	rect(34, 34, 32, 9, 2, { fill: 'accent-soft', stroke: 'accent', strokeWidth: 1.3 }),
	rect(34, 50, 32, 9, 2, { fill: 'accent-soft', stroke: 'accent', strokeWidth: 1.3 })
] as const;

const INTERNET = [
	circle(50, 40, 31, { fill: 'surface' }),
	ellipse(50, 40, 14, 31, { fill: 'none', stroke: 'accent', strokeWidth: 1.6 }),
	line(19, 40, 81, 40, { stroke: 'accent', strokeWidth: 1.6 }),
	path('M25 25 C39 34 61 34 75 25', { stroke: 'accent', strokeWidth: 1.4 }),
	path('M25 55 C39 46 61 46 75 55', { stroke: 'accent', strokeWidth: 1.4 })
] as const;

const CLOUD = [...cloud()] as const;

const ISP = [
	...cloud(
		circle(38, 42, 3, { fill: 'accent', stroke: 'none' }),
		circle(50, 34, 3, { fill: 'accent', stroke: 'none' }),
		circle(62, 42, 3, { fill: 'accent', stroke: 'none' }),
		line(38, 42, 50, 34, { stroke: 'accent', strokeWidth: 1.5 }),
		line(50, 34, 62, 42, { stroke: 'accent', strokeWidth: 1.5 }),
		line(38, 42, 62, 42, { stroke: 'accent', strokeWidth: 1.5 })
	)
] as const;

const DATA_CENTER = [
	...building(
		rect(27, 39, 15, 9, 2, { fill: 'accent-soft', stroke: 'muted', strokeWidth: 1.1 }),
		rect(58, 39, 15, 9, 2, { fill: 'accent-soft', stroke: 'muted', strokeWidth: 1.1 }),
		rect(27, 53, 15, 9, 2, { fill: 'accent-soft', stroke: 'muted', strokeWidth: 1.1 }),
		rect(58, 53, 15, 9, 2, { fill: 'accent-soft', stroke: 'muted', strokeWidth: 1.1 }),
		line(50, 70, 50, 58, { stroke: 'accent', strokeWidth: 2 })
	)
] as const;

const BRANCH_OFFICE = [
	...building(
		rect(27, 39, 16, 13, 2, { fill: 'accent-soft', stroke: 'muted', strokeWidth: 1.1 }),
		rect(57, 39, 16, 13, 2, { fill: 'accent-soft', stroke: 'muted', strokeWidth: 1.1 }),
		rect(43, 55, 14, 15, 2, { fill: 'accent-soft', stroke: 'accent', strokeWidth: 1.3 })
	)
] as const;

const CELL_TOWER = [
	polygon('44,68 50,16 56,68', { fill: 'accent-soft', stroke: 'ink' }),
	line(35, 68, 65, 68, { stroke: 'ink', strokeWidth: 2.3 }),
	line(46, 52, 54, 52, { stroke: 'muted' }),
	line(47, 39, 53, 39, { stroke: 'muted' }),
	path('M39 25 Q28 36 39 47', { stroke: 'accent', strokeWidth: 2 }),
	path('M61 25 Q72 36 61 47', { stroke: 'accent', strokeWidth: 2 }),
	path('M33 18 Q16 36 33 54', { stroke: 'accent', strokeWidth: 1.7 }),
	path('M67 18 Q84 36 67 54', { stroke: 'accent', strokeWidth: 1.7 })
] as const;

const SATELLITE = [
	rect(39, 29, 22, 22, 4, { fill: 'surface' }),
	rect(9, 25, 25, 30, 2, { fill: 'accent-soft', stroke: 'accent', strokeWidth: 1.5 }),
	rect(66, 25, 25, 30, 2, { fill: 'accent-soft', stroke: 'accent', strokeWidth: 1.5 }),
	line(34, 40, 39, 40, { stroke: 'ink', strokeWidth: 2 }),
	line(61, 40, 66, 40, { stroke: 'ink', strokeWidth: 2 }),
	path('M47 51 L42 65', { stroke: 'ink', strokeWidth: 2 }),
	path('M42 65 Q50 71 58 65', { stroke: 'accent', strokeWidth: 2 }),
	path('M62 12 Q77 17 82 31', { stroke: 'accent', strokeWidth: 1.7 }),
	path('M66 6 Q86 13 92 33', { stroke: 'accent', strokeWidth: 1.5 })
] as const;

const SUBNET = [
	...zoneFrame(
		[
			circle(75, 9.5, 2.5, { fill: 'accent', stroke: 'none' }),
			circle(86, 9.5, 2.5, { fill: 'accent', stroke: 'none' }),
			line(77.5, 9.5, 83.5, 9.5, { stroke: 'accent', strokeWidth: 1.3 })
		],
		{ dash: '5 4' }
	)
] as const;

const VLAN = [
	...zoneFrame(
		[
			rect(70, 6, 8, 7, 1, { fill: 'surface', stroke: 'accent', strokeWidth: 1 }),
			rect(84, 6, 8, 7, 1, { fill: 'surface', stroke: 'accent', strokeWidth: 1 }),
			line(78, 9.5, 84, 9.5, { stroke: 'accent', strokeWidth: 1.3 })
		],
		{ dash: '7 3' }
	)
] as const;

const DMZ = [
	...zoneFrame(
		[
			path('M79 4.5 L86 7 V10.5 C86 13.5 83 15 79 16 C75 15 72 13.5 72 10.5 V7 Z', {
				fill: 'surface',
				stroke: 'accent',
				strokeWidth: 1.1
			})
		],
		{ dash: '3 3' }
	),
	rect(6, 21, 88, 52, 5, { fill: 'none', stroke: 'accent', strokeWidth: 1, dash: '3 3' })
] as const;

const NETWORK_ZONE = [
	...zoneFrame([
		circle(75, 9.5, 2.4, { fill: 'accent', stroke: 'none' }),
		line(78, 9.5, 91, 9.5, { stroke: 'accent', strokeWidth: 1.5 })
	])
] as const;

const RACK_CLUSTER = [
	...zoneFrame([
		rect(62, 6, 8, 7, 1, { fill: 'accent-soft', stroke: 'accent', strokeWidth: 1 }),
		rect(72, 6, 8, 7, 1, { fill: 'accent-soft', stroke: 'accent', strokeWidth: 1 }),
		rect(82, 6, 8, 7, 1, { fill: 'accent-soft', stroke: 'accent', strokeWidth: 1 })
	])
] as const;

export const NETWORK_SYMBOLS: Record<NetworkSymbolId, readonly NetworkPrimitive[]> = {
	router: ROUTER,
	'wireless-router': WIRELESS_ROUTER,
	'switch-l2': SWITCH_L2,
	'switch-l3': SWITCH_L3,
	hub: HUB,
	bridge: BRIDGE,
	gateway: GATEWAY,
	modem: MODEM,
	'access-point': ACCESS_POINT,
	'wireless-controller': WIRELESS_CONTROLLER,
	firewall: FIREWALL,
	'ids-ips': IDS_IPS,
	'vpn-gateway': VPN_GATEWAY,
	'load-balancer': LOAD_BALANCER,
	proxy: PROXY,
	'nat-gateway': NAT_GATEWAY,
	desktop: DESKTOP,
	laptop: LAPTOP,
	printer: PRINTER,
	'ip-phone': IP_PHONE,
	smartphone: SMARTPHONE,
	tablet: TABLET,
	'iot-device': IOT_DEVICE,
	'ip-camera': IP_CAMERA,
	server: SERVER,
	'database-server': DATABASE_SERVER,
	'nas-storage': NAS_STORAGE,
	internet: INTERNET,
	cloud: CLOUD,
	isp: ISP,
	'data-center': DATA_CENTER,
	'branch-office': BRANCH_OFFICE,
	'cell-tower': CELL_TOWER,
	satellite: SATELLITE,
	subnet: SUBNET,
	vlan: VLAN,
	dmz: DMZ,
	'network-zone': NETWORK_ZONE,
	'rack-cluster': RACK_CLUSTER
};
