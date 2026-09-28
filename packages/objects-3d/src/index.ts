/**
 * Starter set of 3D objects for data centres and offices: 48 recipes as
 * JSON, in the same format the editor's Object tab produces. Nothing here is
 * wired into the app — the set is seeded into an account's private library
 * (`scripts/seed-objects-3d.mjs`) and used by the samples, and
 * a user can add, change or delete every one of them from the editor.
 *
 * To add an object: drop a `recipes/<id>.json` file next to the others
 * (export one from the editor's Object tab) and import it below.
 */
import { validateVisual3DRecipe, type Visual3DRecipe } from '@easydraw/diagram-schema';
import armchair from '../recipes/armchair.json' with { type: 'json' };
import bladeChassis from '../recipes/blade-chassis.json' with { type: 'json' };
import bookshelf from '../recipes/bookshelf.json' with { type: 'json' };
import cabinetGlass from '../recipes/cabinet-glass.json' with { type: 'json' };
import cableTray from '../recipes/cable-tray.json' with { type: 'json' };
import cage from '../recipes/cage.json' with { type: 'json' };
import coffeeTable from '../recipes/coffee-table.json' with { type: 'json' };
import conferenceChair from '../recipes/conference-chair.json' with { type: 'json' };
import cooling from '../recipes/cooling.json' with { type: 'json' };
import cracUnit from '../recipes/crac-unit.json' with { type: 'json' };
import crashCart from '../recipes/crash-cart.json' with { type: 'json' };
import desk from '../recipes/desk.json' with { type: 'json' };
import door from '../recipes/door.json' with { type: 'json' };
import extinguisher from '../recipes/extinguisher.json' with { type: 'json' };
import filingCabinet from '../recipes/filing-cabinet.json' with { type: 'json' };
import firePanel from '../recipes/fire-panel.json' with { type: 'json' };
import floorTile from '../recipes/floor-tile.json' with { type: 'json' };
import generator from '../recipes/generator.json' with { type: 'json' };
import glassPartition from '../recipes/glass-partition.json' with { type: 'json' };
import kitchenCounter from '../recipes/kitchen-counter.json' with { type: 'json' };
import laptop from '../recipes/laptop.json' with { type: 'json' };
import lockers from '../recipes/lockers.json' with { type: 'json' };
import meetingTable from '../recipes/meeting-table.json' with { type: 'json' };
import monitor from '../recipes/monitor.json' with { type: 'json' };
import officeChair from '../recipes/office-chair.json' with { type: 'json' };
import patchPanel from '../recipes/patch-panel.json' with { type: 'json' };
import pdu from '../recipes/pdu.json' with { type: 'json' };
import person from '../recipes/person.json' with { type: 'json' };
import phoneBooth from '../recipes/phone-booth.json' with { type: 'json' };
import plant from '../recipes/plant.json' with { type: 'json' };
import printer from '../recipes/printer.json' with { type: 'json' };
import rack from '../recipes/rack.json' with { type: 'json' };
import receptionDesk from '../recipes/reception-desk.json' with { type: 'json' };
import securityCamera from '../recipes/security-camera.json' with { type: 'json' };
import server1u from '../recipes/server-1u.json' with { type: 'json' };
import signStand from '../recipes/sign-stand.json' with { type: 'json' };
import sofa from '../recipes/sofa.json' with { type: 'json' };
import standingDesk from '../recipes/standing-desk.json' with { type: 'json' };
import storage from '../recipes/storage.json' with { type: 'json' };
import networkSwitch from '../recipes/switch.json' with { type: 'json' };
import tvScreen from '../recipes/tv-screen.json' with { type: 'json' };
import ups from '../recipes/ups.json' with { type: 'json' };
import wall from '../recipes/wall.json' with { type: 'json' };
import wallClock from '../recipes/wall-clock.json' with { type: 'json' };
import waterCooler from '../recipes/water-cooler.json' with { type: 'json' };
import whiteboard from '../recipes/whiteboard.json' with { type: 'json' };
import wifiController from '../recipes/wifi-controller.json' with { type: 'json' };
import workstation from '../recipes/workstation.json' with { type: 'json' };

export interface Object3DDefinition {
  id: string;
  name: string;
  group: string;
  recipe: Visual3DRecipe;
}

const raw: unknown[] = [
  armchair,
  bladeChassis,
  bookshelf,
  cabinetGlass,
  cableTray,
  cage,
  coffeeTable,
  conferenceChair,
  cooling,
  cracUnit,
  crashCart,
  desk,
  door,
  extinguisher,
  filingCabinet,
  firePanel,
  floorTile,
  generator,
  glassPartition,
  kitchenCounter,
  laptop,
  lockers,
  meetingTable,
  monitor,
  officeChair,
  patchPanel,
  pdu,
  person,
  phoneBooth,
  plant,
  printer,
  rack,
  receptionDesk,
  securityCamera,
  server1u,
  signStand,
  sofa,
  standingDesk,
  storage,
  networkSwitch,
  tvScreen,
  ups,
  wall,
  wallClock,
  waterCooler,
  whiteboard,
  wifiController,
  workstation,
];

function isDefinition(value: unknown): value is Object3DDefinition {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && typeof v.name === 'string' && typeof v.group === 'string' && validateVisual3DRecipe(v.recipe).valid;
}

export const OBJECTS_3D: readonly Object3DDefinition[] = raw.filter(isDefinition);

export function getObject3D(id: string): Object3DDefinition | undefined {
  return OBJECTS_3D.find((object) => object.id === id);
}
