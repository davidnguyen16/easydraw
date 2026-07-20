import { IsIn, IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateDiagramDto {
    @IsOptional()
    @IsString()
    @MinLength(1)
    title?: string;

    @IsOptional()
    @IsIn(['draft', 'complete', 'archived'])
    status?: string;
    
    @IsOptional()
    @IsObject()
    data?: Record<string, any>;
}