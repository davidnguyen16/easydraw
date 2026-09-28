import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/** The server owns the approved graph. Never accept graph JSON in this request. */
export class CommitPreviewDto {
  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  documentHash!: string;

  @IsBoolean()
  acknowledgeStale!: boolean;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;
}
