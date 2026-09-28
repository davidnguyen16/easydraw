import { IsString, MaxLength } from 'class-validator';

export class ThumbnailDto {
  /** `data:image/webp;base64,…` (or png/jpeg); at most ~300 KB decoded. */
  @IsString()
  @MaxLength(450_000)
  image!: string;
}
