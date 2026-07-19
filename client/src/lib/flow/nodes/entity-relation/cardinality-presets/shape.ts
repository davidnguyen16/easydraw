import type { CardinalityPresetConfig } from '../shared/cardinality-preset';
import { createCardinalityPreset } from '../shared/cardinality-preset';
import OneIcon from './one-icon.svelte';
import ZeroToOneIcon from './zero-to-one-icon.svelte';
import ManyIcon from './many-icon.svelte';
import ManyToManyIcon from './many-to-many-icon.svelte';
import OneOptionalToManyOptionalIcon from './one-optional-to-many-optional-icon.svelte';
import OneMandatoryToManyOptionalIcon from './one-mandatory-to-many-optional-icon.svelte';
import OneMandatoryToOneOptionalIcon from './one-mandatory-to-one-optional-icon.svelte';
import OneOptionalToOneOptionalIcon from './one-optional-to-one-optional-icon.svelte';
import OneMandatoryToManyMandatoryIcon from './one-mandatory-to-many-mandatory-icon.svelte';
import OneOptionalToManyMandatoryIcon from './one-optional-to-many-mandatory-icon.svelte';
import ManyMandatoryToManyMandatoryIcon from './many-mandatory-to-many-mandatory-icon.svelte';
import ManyOptionalToManyMandatoryIcon from './many-optional-to-many-mandatory-icon.svelte';
import ManyOptionalToManyOptionalIcon from './many-optional-to-many-optional-icon.svelte';

const CARDINALITY_PRESETS = [
	{
		id: 'OneConnection',
		label: '1',
		icon: OneIcon,
		markerEnd: 'bar'
	},
	{
		id: 'ZeroToOneConnection',
		label: '0 to 1',
		icon: ZeroToOneIcon,
		markerEnd: 'circle-bar'
	},
	{
		id: 'ManyConnection',
		label: 'Many',
		icon: ManyIcon,
		markerEnd: 'crowfoot'
	},
	{
		id: 'ManyToManyConnection',
		label: 'Many to Many',
		icon: ManyToManyIcon,
		markerStart: 'crowfoot',
		markerEnd: 'crowfoot'
	},
	{
		id: 'OneOptionalToManyOptionalConnection',
		label: '1 Optional to Many Optional',
		icon: OneOptionalToManyOptionalIcon,
		markerStart: 'circle-bar',
		markerEnd: 'circle-crowfoot'
	},
	{
		id: 'OneMandatoryToManyOptionalConnection',
		label: '1 Mandatory to Many Optional',
		icon: OneMandatoryToManyOptionalIcon,
		markerStart: 'bar-double',
		markerEnd: 'circle-crowfoot'
	},
	{
		id: 'OneMandatoryToOneOptionalConnection',
		label: '1 Mandatory to 1 Optional',
		icon: OneMandatoryToOneOptionalIcon,
		markerStart: 'bar-double',
		markerEnd: 'circle-bar'
	},
	{
		id: 'OneOptionalToOneOptionalConnection',
		label: '1 Optional to 1 Optional',
		icon: OneOptionalToOneOptionalIcon,
		markerStart: 'circle-bar',
		markerEnd: 'circle-bar'
	},
	{
		id: 'OneMandatoryToManyMandatoryConnection',
		label: '1 Mandatory to Many Mandatory',
		icon: OneMandatoryToManyMandatoryIcon,
		markerStart: 'bar-double',
		markerEnd: 'bar-crowfoot'
	},
	{
		id: 'OneOptionalToManyMandatoryConnection',
		label: '1 Optional to Many Mandatory',
		icon: OneOptionalToManyMandatoryIcon,
		markerStart: 'circle-bar',
		markerEnd: 'bar-crowfoot'
	},
	{
		id: 'ManyMandatoryToManyMandatoryConnection',
		label: 'Many Mandatory to Many Mandatory',
		icon: ManyMandatoryToManyMandatoryIcon,
		markerStart: 'bar-crowfoot',
		markerEnd: 'bar-crowfoot'
	},
	{
		id: 'ManyOptionalToManyMandatoryConnection',
		label: 'Many Optional to Many Mandatory',
		icon: ManyOptionalToManyMandatoryIcon,
		markerStart: 'circle-crowfoot',
		markerEnd: 'bar-crowfoot'
	},
	{
		id: 'ManyOptionalToManyOptionalConnection',
		label: 'Many Optional to Many Optional',
		icon: ManyOptionalToManyOptionalIcon,
		markerStart: 'circle-crowfoot',
		markerEnd: 'circle-crowfoot'
	}
] as const satisfies readonly CardinalityPresetConfig[];

export const additionalCardinalityShapes = CARDINALITY_PRESETS.map(createCardinalityPreset);
