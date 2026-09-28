import { Transform } from 'class-transformer';
import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Editor kinds. The four historical diagram kinds are still accepted and become a category. */
export const DIAGRAM_TYPES = ['diagram', 'whiteboard'] as const;
export const LEGACY_DIAGRAM_TYPES: Record<string, string> = {
  erd: 'ERD',
  uml: 'UML',
  flowchart: 'Flowchart',
  dfd: 'DFD',
};

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateDiagramDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsIn([...DIAGRAM_TYPES, ...Object.keys(LEGACY_DIAGRAM_TYPES)])
  type?: string;

  /** Free label chosen by the owner: "ERD", "Network", "Data centre"… */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  category?: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, any>;
}
