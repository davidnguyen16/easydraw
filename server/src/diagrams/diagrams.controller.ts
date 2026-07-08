import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { DiagramsService } from './diagrams.service';
import { CreateDiagramDto } from './dto/create-diagram.dto';
import { UpdateDiagramDto } from './dto/update-diagram.dto';

@Controller('diagrams')
export class DiagramsController {
  constructor(private readonly diagramsService: DiagramsService) {}

  @Get()
  findAll() {
    return this.diagramsService.findAll();
  }

  @Post()
  create(@Body() body: CreateDiagramDto) {
    return this.diagramsService.create(body.title, body.data);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.diagramsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateDiagramDto) {
    return this.diagramsService.update(id, body);   
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.diagramsService.remove(id);
  }
}