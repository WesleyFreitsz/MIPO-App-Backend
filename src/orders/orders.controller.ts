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
  CreateOrderDto,
  OpenTabDto,
  StaffFeedQueryDto,
  TabsQueryDto,
  UpdateOrderStatusDto,
} from './dto/order.dto';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post('tabs')
  openTab(@CurrentUser() user: AuthenticatedUser, @Body() dto: OpenTabDto) {
    return this.ordersService.openTab(user.userId, dto);
  }

  @Get('tabs/mine')
  getMyTab(@CurrentUser() user: AuthenticatedUser) {
    return this.ordersService.getMyTab(user.userId);
  }

  @Roles(UserRole.ADMIN, UserRole.WAITER)
  @Get('tabs')
  listTabs(@Query() query: TabsQueryDto) {
    return this.ordersService.listTabs(query.status);
  }

  @Roles(UserRole.ADMIN, UserRole.WAITER)
  @Patch('tabs/:id/close')
  closeTab(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ordersService.closeTab(user.userId, id);
  }

  @Roles(UserRole.ADMIN, UserRole.WAITER)
  @Get('staff/feed')
  staffFeed(@Query() query: StaffFeedQueryDto) {
    return this.ordersService.staffFeed(query.status);
  }

  @Roles(UserRole.ADMIN, UserRole.WAITER)
  @Get('staff/today')
  staffToday() {
    return this.ordersService.staffToday();
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateOrderDto) {
    return this.ordersService.createOrder(user.userId, dto);
  }

  @Roles(UserRole.ADMIN, UserRole.WAITER)
  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(user.userId, id, dto);
  }

  @Delete(':id')
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ordersService.cancelOwnOrder(user.userId, id);
  }
}
