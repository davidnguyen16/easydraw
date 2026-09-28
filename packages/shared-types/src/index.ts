/** Stable identifiers shared by persistence, engines and document packs. */
export type DiagramId = string;
export type NodeId = string;
export type EdgeId = string;

export type ValidationIssueSeverity = 'error' | 'warning';

/** A machine-addressable validation problem suitable for UI presentation. */
export interface ValidationIssue {
  code: string;
  message: string;
  path?: string;
  severity: ValidationIssueSeverity;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export function createValidationResult(issues: ValidationIssue[]): ValidationResult {
  return {
    valid: !issues.some((issue) => issue.severity === 'error'),
    issues: [...issues],
  };
}
