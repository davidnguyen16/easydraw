import { IsIn, IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateDiagramDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsIn(['erd', 'uml', 'flowchart', 'dfd'])
  type!: string;
  
  @IsOptional()
  @IsObject()
  data?: Record<string, any>;
}