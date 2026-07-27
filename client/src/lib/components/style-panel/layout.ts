/**
 * Shared geometry for the floating node/connection style panels.
 *
 * Canvas navigation also consumes these values so its usable viewport always
 * ends at the panel's left edge. Keep the visual panel and scrolling maths on
 * this single source of truth.
 */
export const FLOATING_STYLE_PANEL_WIDTH_PX = 280;
export const FLOATING_STYLE_PANEL_RIGHT_GAP_PX = 16;
export const FLOATING_STYLE_PANEL_INSET_PX =
	FLOATING_STYLE_PANEL_WIDTH_PX + FLOATING_STYLE_PANEL_RIGHT_GAP_PX;
