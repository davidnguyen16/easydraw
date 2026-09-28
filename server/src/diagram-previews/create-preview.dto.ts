import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePreviewDto {
  @IsUUID('4')
  clientRequestId!: string;

  @IsInt()
  @Min(1)
  @Max(8192)
  width!: number;

  @IsInt()
  @Min(1)
  @Max(8192)
  height!: number;

  @IsString()
  @MaxLength(5592430)
  image!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  clientRevision?: number;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  hint?: string;

  @IsOptional()
  @IsUUID('4')
  basePreviewId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  feedback?: string;
}
