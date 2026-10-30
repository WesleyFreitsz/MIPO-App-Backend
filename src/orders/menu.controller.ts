import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from 'src/auth/authenticated-user.interface';
import { UserRole } from 'src/users/entities/user.entity';
import { OrdersService } from './orders.service';
import {
  CreateMenuItemDto,
  MenuQueryDto,
  UpdateMenuItemDto,
} from './dto/menu.dto';

@Controller('menu')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MenuController {
  constructor(private ordersService: OrdersService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: MenuQueryDto) {
    return this.ordersService.listMenu(query, user.role === UserRole.ADMIN);
  }

  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateMenuItemDto) {
    return this.ordersService.createMenuItem(dto);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMenuItemDto,
  ) {
    return this.ordersService.updateMenuItem(id, dto);
  }

  @Roles(UserRole.ADMIN)
  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.ordersService.deleteMenuItem(id);
  }
}
