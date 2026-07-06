import { Body, Controller, Get, Post } from '@nestjs/common';
import { DiagramsService } from './diagrams.service';
    
@Controller('diagrams')
export class DiagramsController {
  constructor(private readonly diagramsService: DiagramsService) {}

  @Get()
  findAll() {
    return this.diagramsService.findAll();
  }

    @Post()
    create(@Body() body: { title: string; data?: any }) {
      return this.diagramsService.create(body.title, body.data);
    }
}