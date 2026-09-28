import { Transform } from 'class-transformer';
import {
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateDiagramDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  /** A string relabels the diagram; null clears the label. */
  @ValidateIf(
    (_object, value: unknown) => value !== undefined && value !== null,
  )
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  category?: string | null;

  @IsOptional()
  @IsIn(['draft', 'complete', 'archived'])
  status?: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, any>;
}
