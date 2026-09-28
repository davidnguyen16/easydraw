import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  ValidateIf,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Matches,
  Min,
  MinLength,
} from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateSectionDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;
}

export class UpdateSectionDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder?: number;
}

export class UpdateNodeDto extends UpdateSectionDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsUUID()
  sectionId?: string;
}

export class CreateUploadDto {
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fileName: string;

  @IsIn(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
  contentType: string;

  @IsInt()
  @Min(1)
  @Max(104857600)
  byteSize: number;
}

export class ResolveAssetsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @Matches(/^[a-zA-Z0-9_-]{1,128}$/, { each: true })
  assetIds: string[];

  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsIn(['image', 'thumbnail'])
  variant?: 'image' | 'thumbnail';
}
