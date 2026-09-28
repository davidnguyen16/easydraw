import { Transform } from 'class-transformer';
import {
  IsObject,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateObject3DDto {
  /** The private library (CustomNodeSection) the object is filed under. */
  @IsUUID()
  sectionId: string;

  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  /** A Visual3D recipe; validated against the shared schema in the service. */
  @IsObject()
  recipe: Record<string, unknown>;
}

export class UpdateObject3DDto {
  /** Move the object to another of the caller's libraries. */
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsUUID()
  sectionId?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsObject()
  recipe?: Record<string, unknown>;
}
